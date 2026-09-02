---
title: "Assignment binds names to objects and never copies, so two names can be one object — and that single fact is most of Python's production bug surface"
sidebar_label: "07 · Assignment and aliasing"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [§7.2 Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements),
> [§7.5 `del`](https://docs.python.org/3.14/reference/simple_stmts.html#the-del-statement),
> [§8.7 Function definitions](https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions),
> [§3.1 Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types),
> [§6.10 Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons);
> the Library Reference
> [`copy`](https://docs.python.org/3.14/library/copy.html),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html),
> [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType),
> [`functools`](https://docs.python.org/3.14/library/functools.html),
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html),
> [Built-in Types](https://docs.python.org/3.14/library/stdtypes.html),
> [`id()`/`hash()`](https://docs.python.org/3.14/library/functions.html),
> [glossary](https://docs.python.org/3.14/glossary.html);
> the [Programming FAQ](https://docs.python.org/3.14/faq/programming.html);
> [PEP 416](https://peps.python.org/pep-0416/),
> [PEP 705](https://peps.python.org/pep-0705/);
> and the Ruff rules
> [B006](https://docs.astral.sh/ruff/rules/mutable-argument-default/),
> [B008](https://docs.astral.sh/ruff/rules/function-call-in-default-argument/),
> [B039](https://docs.astral.sh/ruff/rules/mutable-contextvar-default/),
> [RUF008](https://docs.astral.sh/ruff/rules/mutable-dataclass-default/),
> [RUF012](https://docs.astral.sh/ruff/rules/mutable-class-default/).
> Target: **CPython 3.14**.

**`x = y` does not copy anything. It binds the name `x` to the object `y`
already refers to, so afterwards there is one object with two names, and a
mutation through either is visible through both. That is the whole topic. From
it follow the list a function mutates behind your back, the default argument
that accumulates across every request a worker ever serves, the class attribute
shared by every instance, the `t[0] += [x]` that raises *and* mutates, and the
difference between `copy` and `deepcopy` that you will get wrong at least once
before you get it right. The syllabus tiers this Master because half-knowing it
produces bugs whose symptom is in a different module — and often a different
request — from the write that caused them.**

## The chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What `=` actually does](01-what-assignment-does.md)** | Binding, not copying; names have no type; the reference's definition; `a = b = []` sharing one object; left-to-right target order and `i, x[i] = 1, 2`; annotated assignment; the walrus |
| 1b | **[Targets, binding forms and `del`](01b-assignment-targets-and-del.md)** | Name vs attribute vs subscript vs slice targets; `x[:] = other` as in-place replace; starred targets allocate; `for`/`with`/`except`/`import` all bind; `except as e` is deleted; `del` unbinds a name, not an object; `global`/`nonlocal` |
| 2 | **[Identity, equality and `id()`](02-identity-and-id.md)** | `is` vs `==`; `id()` reuse after collection; which objects may be shared and why immutables are exempt; sentinels; membership's documented `x is e or x == e`; reference counts |
| 3 | **[Aliasing: two names, one object](03-aliasing.md)** | The FAQ walkthrough; the mutable/immutable table; the mutate/create pairs and the `None`-return convention; aliases you did not write down; leaky getters; shallow copies stopping one level down |
| 3b | **[Repetition and shared references](03b-repetition-and-shared-refs.md)** | `[[]] * 3` and the documented fix; when `* n` is safe; the 2-D grid; `dict.fromkeys(keys, [])` vs `defaultdict(list)`; `itertools.repeat`; the grouper idiom that depends on sharing |
| 4 | **[Augmented assignment](04-augmented-assignment.md)** | `__iadd__` in place for lists, rebinding for ints and tuples; target evaluated once; LHS before RHS; `list.__iadd__` accepts any iterable; `+=` and `UnboundLocalError`; `self.x += 1` forking a class attribute |
| 4b | **[Raises *and* mutates](04b-tuple-item-raises-and-mutates.md)** | `t[0] += [x]` in full; why the store is unconditional; frozen dataclasses, named tuples and `MappingProxyType` with the same shape; `counts[k] += 1` is not atomic |
| 5 | **[Function arguments](05-function-arguments.md)** | *"Arguments are passed by assignment"*; call by sharing; rebinding vs mutating, worked; `*args`/`**kwargs` as fresh containers; return values are aliases; when in-place APIs are right |
| 5b | **[Saying "don't touch mine"](05b-dont-touch-mine.md)** | Copy at one boundary; immutable parameter types; `Sequence`/`Mapping` annotations that enforce nothing; `typing.ReadOnly`; the mutation test; what Python does not give you (`const`, copy-on-write, deep freeze) |
| 6 | **[The mutable default argument](06-mutable-default-argument.md)** | Defaults evaluated once when `def` runs; the third-call prediction; `__defaults__` and `inspect.signature`; why the language does it this way; `datetime.now()` and `uuid4()` frozen at import |
| 6b | **[Fixing mutable defaults](06b-fixing-mutable-defaults.md)** | The `None` sentinel and why `x or []` is wrong; private sentinels; `()` as a default; factory parameters; the deliberate uses (`_cache={}`, `lambda i=i`); the long-lived-worker leak |
| 6c | **[Dataclass defaults and linting](06c-dataclass-defaults-and-linting.md)** | Why `@dataclass` raises `ValueError`; the unhashable-default heuristic and its hole; `field(default_factory=…)`; frozen plus immutable field types; the `eq`/`frozen`/`__hash__` table |
| 6d | **[Linting the whole family](06d-linting-mutable-defaults.md)** | B006/B008/B039/RUF008/RUF012 and what each catches; `ContextVar` defaults; the FastAPI allow-list instead of blanket `noqa`; what no linter can see |
| 7 | **[Class-attribute aliasing](07-class-attribute-aliasing.md)** | One list for every instance; reads fall back, writes create; the `__init__` fix; base-class registries shared by every subclass; diagnosing with `vars()` |
| 7b | **[Shadowing, `ClassVar` and descriptors](07b-shadowing-and-classvar.md)** | Class-level defaults as a real pattern; the permanent shadow an instance write creates; `del inst.attr`; descriptors as the documented exception; `__slots__` |
| 8 | **[Shallow copy](08-shallow-copy.md)** | The `copy` docs' definition; every spelling and which to prefer; what is and is not protected; copying user objects; why `copy.copy(t) is t`; where shallow is exactly right |
| 8b | **[deepcopy](08b-deepcopy.md)** | The two documented problems; the memo, cycles, and preserved sharing topology; what is not copied; pre-seeding the memo to exclude a session; cost; the JSON round trip that is not a copy |
| 8c | **[Copy hooks and uncopyable objects](08c-copy-hooks-and-uncopyable.md)** | `__copy__`, `__deepcopy__(memo)`, `__replace__`; the pickle fallback; registering in the memo before recursing; the singleton hook; `copy.replace()`; locks, sockets and sessions |
| 9 | **[Immutability is shallow too](09-immutability-is-shallow.md)** | What a tuple actually guarantees; `frozenset` and hashable members; `hash()` as a partial deep-immutability check; frozen dataclasses; `deepcopy` of a tuple; the thread-safety claim and its limit |
| 9b | **[Hashability and dict keys](09b-hashability-and-dict-keys.md)** | The wrong-bucket bug in full; what defining `__eq__` does to `__hash__`; the dataclass `eq`/`frozen` rules; `{1: 'a', True: 'c'}` collapsing; `lru_cache` requiring hashable arguments |
| 10 | **[Designing away aliasing](10-designing-away-aliasing.md)** | Values versus entities; `tuple`/`NamedTuple`/frozen dataclass/`frozenset`; `replace` instead of mutate; mutable inside, immutable at the seam; when immutability is the wrong call |
| 10b | **[Read-only views and boundaries](10b-read-only-views-and-boundaries.md)** | `MappingProxyType` as a live view, not a snapshot; why PEP 416 was rejected; view vs copy table; dict views; NumPy slices are views and list slices are copies; `memoryview` |
| 11 | **[Where it bites in real code](11-where-it-bites.md)** | The shared config; the template dict in a loop; the leaking test fixture; the request context that is per-process; the retry loop that accumulates |
| 11b | **[Publishing state, and diagnostics](11b-publishing-state-and-diagnostics.md)** | Getters that publish internals; the privilege-escalation "default"; serialising under mutation; `sort()` on someone else's list; the three diagnostics that find all of it |
| 11c | **[Caches, workers and ORM](11c-caches-workers-and-orm.md)** | `lru_cache` returning the same object; what the cache keeps alive; `lru_cache` on a method; per-process caches in a multi-worker server; `deepcopy` on a mapped instance; identity maps; test doubles that alias when the real cache does not |

## The one paragraph the whole topic expands

Assignment binds a name to an object; it never copies. So passing a list to a
function, storing it on `self`, returning it from a getter, putting it in a
cache or using it as a default all create *another route to the same object*,
and a write through any route is visible through all of them. Immutable objects
are exempt because there is no write — which is why the durable fix is not more
defensive copying but choosing immutable types at the seams and mutating only
data that nothing else can reach. When you must copy, know the depth you need:
a shallow copy protects the container and shares the contents, a deep copy
protects everything and copies far more than you meant, including things that
should never be copied at all. And when the symptom appears in a module that is
obviously correct, the write happened somewhere else — wrap the object so
writing raises, and the traceback will name the culprit.

## Where this connects

- **[Phase 0 — Everything is an object](../../phase-0-runtime/07-everything-is-an-object/README.md)**
  is the layer below: what an object *is*, and why names are separate from it.
- **[Numbers](../02-numbers/README.md)** covers the immutable side —
  small-int caching and identity in
  [1c](../02-numbers/01c-identity-and-boundaries.md), `bool` identity traps in
  [4b](../02-numbers/04b-bool-identity-traps.md), and NaN in
  [6](../02-numbers/06-nan-inf-and-signed-zero.md), all of which this topic
  leans on.
- **[Strings](../03-strings/README.md)** is the worked example of immutability:
  no aliasing bug is possible with a `str`.
- **[`bytes` vs `str`](../04-bytes-and-encoding/README.md)** is where
  `bytearray` and `memoryview` — the mutable buffer and the view over it —
  actually get used.
- **Comprehensions** *(not written yet)* is the tool that fixes `[[]] * 3`, and
  the place where "build a new object per iteration" becomes idiom.
- **Functions and scope** in Phase 2 owns default arguments properly; this
  topic owns their aliasing half.
- **Concurrency** in Phase 6 is where "immutable objects are inherently
  thread-safe" stops being a nicety and becomes the design.

---

← Prev: [Comparisons](../06-comparisons/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [What `=` actually does](01-what-assignment-does.md)
