---
title: "`None`: the singleton, the implicit return, and the methods that hand it back"
sidebar_label: "1 · What `None` is"
sidebar_position: 140
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html),
> [`list.sort`](https://docs.python.org/3.14/library/stdtypes.html#list.sort),
> [`sorted`](https://docs.python.org/3.14/library/functions.html#sorted),
> the Language Reference
> [The `return` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-return-statement)
> and [`object.__init__`](https://docs.python.org/3.14/reference/datamodel.html#object.__init__),
> and [PEP 8](https://peps.python.org/pep-0008/#programming-recommendations).
> Target: **CPython 3.14**.

**`None` is one object. The docs call it *"the sole instance of the `NoneType`
type"*, and that singleton guarantee is why `x is None` is the correct test and
`x == None` is not. It is also what Python hands you when a function ends
without returning anything — and, deliberately, what every mutating method
returns. `sorted(xs)` gives you a sorted list; `xs.sort()` gives you `None`.
That is not an oversight, it is a design rule, and the bug it prevents is worse
than the one it causes.**

## The singleton

> *"An object frequently used to represent the absence of a value, as when
> default arguments are not passed to a function. Assignments to `None` are
> illegal and raise a `SyntaxError`. `None` is the sole instance of the
> `NoneType` type."*

Three facts in one paragraph:

**There is exactly one.** Every `None` in your program is the same object, so
identity and equality can never disagree. That is what makes `is None` sound.

**You cannot rebind it.** `None = 5` is a `SyntaxError`, not a runtime error —
`None` has been a keyword since Python 3. (`True` and `False` joined it; in
Python 2 they were merely builtins you could reassign, which was a genuine
source of horror.)

**It is falsy**, and it is one of only two constants *defined* to be false. That
is what puts it at the centre of the
[empty-versus-missing](../05-truthiness/02-empty-versus-missing.md) problem:
`None` is falsy and so is every legitimately empty value, so truthiness cannot
tell them apart.

### `is None`, never `== None`

PEP 8 is unambiguous:

> *"Comparisons to singletons like None should always be done with `is` or `is
> not`, never the equality operators."*

Three reasons, in increasing order of how much they will actually hurt you:

1. **It is faster.** `is` is a pointer comparison; `==` dispatches through
   `__eq__`.
2. **It cannot be overridden.** A class is free to define `__eq__` such that
   `obj == None` is `True`. `obj is None` cannot lie.
3. **It is not a boolean everywhere.** A `numpy` array or a pandas `Series`
   compared with `==` returns an *array*, so `if arr == None:` raises the
   ambiguity error rather than answering. `arr is None` answers.

Point 3 is the one that turns this from style into correctness, and it is why
`ruff` flags `== None` as `E711`.

## Functions return `None` by default

A function that ends without a `return`, or with a bare `return`, returns
`None`. The reference is explicit that a bare `return` *"leaves the current
function call with the expression list (or `None`) as return value"*.

That is convenient and it produces one specific bug — the forgotten return:

```python
def normalise(name):
    name.strip().lower()          # computed, and thrown away
                                  # no return → returns None

user.name = normalise(raw)        # user.name is None
```

Nothing raises. The `AttributeError` or `TypeError` arrives somewhere else
entirely, usually at a template or a database write, with a traceback that does
not mention `normalise`.

The variant that survives review even longer is the *conditional* forgotten
return:

```python
def find_role(user):
    if user.is_admin:
        return "admin"
    elif user.is_staff:
        return "staff"
    # no else — every ordinary user gets None
```

Sometimes that is intended. Usually the author meant `return "user"`. There is
no way to tell from the code, which is exactly why a type annotation earns its
place here: `-> str` makes a checker flag the missing branch, and `-> str |
None` documents that `None` is a real answer.

## Mutating methods return `None` — on purpose

```python
xs = [3, 1, 2]
ys = xs.sort()            # ys is None!  xs is now [1, 2, 3]
ys = sorted(xs)           # ys is [1, 2, 3], xs untouched
```

This is the most-hit instance of the rule, and the `list.sort` docs point at the
alternative directly, noting that `sorted()` is the version that returns a new
list. The same applies across the standard library:

| Returns `None` (mutates) | Returns a value |
|---|---|
| `list.sort()` | `sorted(xs)` |
| `list.reverse()` | `reversed(xs)`, `xs[::-1]` |
| `list.append()`, `.extend()`, `.insert()`, `.remove()` | — |
| `dict.update()` | `{**a, **b}`, `a \| b` |
| `set.add()`, `.update()`, `.discard()` | `a \| b`, `a & b` |
| `random.shuffle()` | `random.sample(xs, len(xs))` |
| `os.makedirs()` | — |

The design rule is **command–query separation**: a method either changes
something or reports something, not both. Returning `None` from a mutator makes
the chaining that would hide the mutation impossible:

```python
result = xs.sort().reverse()      # AttributeError: 'NoneType' has no 'reverse'
```

That error is the point. If `sort()` returned the list, that line would work and
would silently mutate `xs` twice while looking like a pure expression. The
`AttributeError` on `NoneType` is Python telling you that you asked a command
for an answer.

The exceptions worth knowing, because they break the pattern deliberately:
`dict.pop()`, `list.pop()`, `set.pop()` and `dict.setdefault()` all mutate
**and** return, because their entire purpose is to hand you the item they
removed or settled on.

## `__init__` must return `None`

```python
class C:
    def __init__(self):
        return self          # TypeError: __init__() should return None, not 'C'
```

The data model requires it, and the error is raised at construction time. It
follows from `__init__` being an initialiser rather than a constructor — `__new__`
makes the object, `__init__` configures it in place, so there is nothing to
return.

## Gotchas

**Symptom — a value is `None` and the traceback points somewhere unrelated.**
Cause: a function fell off the end without returning, so it returned `None`
implicitly, and the failure happens wherever that `None` is first used. Fix:
annotate the return type and run a checker; `-> str` makes the missing return a
reported error rather than a runtime surprise.

**Symptom — a function returns the right thing for some inputs and `None` for
others.** Cause: an `if`/`elif` chain with no `else`, so uncovered inputs fall
through to the implicit `None`. Fix: add the `else` — even if it raises. An
explicit `raise` for the impossible case is better documentation than an
accidental `None`.

**Symptom — `xs = xs.sort()` leaves `xs` as `None`.** Cause: `sort()` mutates
in place and returns `None`, by design. Fix: `xs.sort()` on its own line, or
`xs = sorted(xs)` if you want a new list. The same shape hits `reverse()`,
`update()`, `append()` and `shuffle()`.

**Symptom — `AttributeError: 'NoneType' object has no attribute 'append'` in a
chain.** Cause: a mutating method in the middle of the chain returned `None`.
Fix: this is the design working — split the chain into statements. A mutator is
a command; it does not answer.

**Symptom — `if x == None:` raises on a numpy array or a pandas Series.**
Cause: those types overload `==` to return an element-wise array, whose truth
value is ambiguous. Fix: `if x is None:` — which is what PEP 8 asks for anyway,
and what `ruff` `E711` flags.

**Symptom — a class whose `__eq__` returns `True` for `None` passes a `== None`
check it should have failed.** Cause: `==` is overridable and `is` is not. Fix:
`is None`. This is rarer than the numpy case but harder to debug, because
nothing raises.

**Symptom — `TypeError: __init__() should return None`.** Cause: `__init__`
returned a value; it is an initialiser, not a constructor, and the data model
requires `None`. Fix: return nothing. If you need to control what object is
produced, that is `__new__`.

**Symptom — a `dict.setdefault` or `list.pop` call looks inconsistent with the
"mutators return None" rule.** Cause: they are deliberate exceptions — their
purpose is to return the item they removed or settled on. Fix: none; know the
short list (`dict.pop`, `list.pop`, `set.pop`, `dict.setdefault`,
`dict.popitem`) and treat everything else as returning `None`.

**Symptom — a bare `return` and a missing `return` are treated as different by
a reviewer.** Cause: they are not — both produce `None`. Fix: use a bare
`return` deliberately as an early exit and let the fall-off-the-end case be the
one you annotate against; a checker cannot distinguish them either.

## Interview questions

**★ Q: Why `is None` rather than `== None`?**
`None` is the sole instance of `NoneType`, so identity is exactly the right
test; PEP 8 says comparisons to singletons *"should always be done with `is` or
`is not`"*. Beyond style: `is` cannot be overridden by a class's `__eq__`, and
it always yields a bool — `arr == None` on a numpy array returns an array and
then raises when used in an `if`. `ruff` flags `== None` as `E711`.

**★ Q: What does `xs.sort()` return?**
`None`. It sorts in place. `sorted(xs)` is the one that returns a new list. This
is command–query separation applied throughout the standard library: a method
either changes something or reports something. Returning `None` makes
`xs.sort().reverse()` fail loudly instead of silently mutating twice.

**★ Q: What does a function return if it has no `return` statement?**
`None`. So does a bare `return`. This produces the forgotten-return bug, where
the failure surfaces far from its cause, and the conditional variant where an
`if`/`elif` with no `else` returns `None` for uncovered inputs. A return
annotation plus a type checker is the practical defence.

**Q: Which mutating methods *do* return something?**
`list.pop`, `dict.pop`, `dict.popitem`, `set.pop` and `dict.setdefault` — all
cases where returning the affected item is the entire point. Everything else
that mutates returns `None`.

**Q: Can you assign to `None`?**
No — it is a keyword, so `None = 5` is a `SyntaxError`. The same is true of
`True` and `False` in Python 3. In Python 2 they were builtins and could be
rebound, which is one of the smaller reasons Python 3 exists.

**Q: Why must `__init__` return `None`?**
Because it initialises an object that `__new__` has already created; there is
nothing for it to return. Returning anything else raises `TypeError:
__init__() should return None` at construction. If you need to control which
object comes back, override `__new__`.

**Q: You see `result = config.update(overrides)`. What is wrong?**
`dict.update` mutates and returns `None`, so `result` is `None` and the
overrides have been written into `config` — probably a shared dict someone else
is holding. The non-mutating spellings are `{**config, **overrides}` or
`config | overrides`.

---

← Prev: [Unpacking](../13-unpacking/README.md) · Index: [`None` and the no-result contract](README.md) · Next → [Picking a no-result contract](02-picking-a-contract.md)
