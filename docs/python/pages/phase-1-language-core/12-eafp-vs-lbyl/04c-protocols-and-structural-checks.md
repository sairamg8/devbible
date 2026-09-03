---
title: "A runtime-checkable protocol verifies that the names exist and nothing more — the typing documentation's own example is a standard-library class that passes a Callable check and cannot be called"
sidebar_label: "04c · Protocols and structural checks"
sidebar_position: 130
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`typing.runtime_checkable`](https://docs.python.org/3.14/library/typing.html#typing.runtime_checkable)
> (the presence-only note, the `ssl.SSLObject` example, the performance note, and both
> 3.12 changes),
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html)
> (footnote 1 on `__subclasshook__`),
> [`inspect.getattr_static`](https://docs.python.org/3.14/library/inspect.html#inspect.getattr_static),
> [`isinstance`](https://docs.python.org/3.14/library/functions.html#isinstance).
> Target: **Python 3.14**. Documentation-validated; **no timings** — the "surprisingly
> slow" claim below is the documentation's own wording, not a measurement made here.

**Structural checks are the respectable middle ground between "is this a `Duck`" and
"just call it", and Python has three of them: an ABC with a `__subclasshook__`, a
`@runtime_checkable` `Protocol`, and `inspect.getattr_static`. All three answer a question
about *shape*, and the documentation for each one states its own limits in writing — the
protocol note is the bluntest, offering `ssl.SSLObject` as a class that satisfies a
`Callable` check and cannot be instantiated. Knowing precisely what each one verifies is
what keeps a structural check from being read as a promise about behaviour.**

## Protocols: structure checked, behaviour not

`typing.runtime_checkable` makes a `Protocol` usable with `isinstance`, and the
documentation is careful about what that buys you:

> *"`@runtime_checkable` will check only the presence of the required methods or
> attributes, not their type signatures or types. For example, `ssl.SSLObject` is a class,
> therefore it passes an `issubclass()` check against `Callable`. However, the
> `ssl.SSLObject.__init__` method exists only to raise a `TypeError` with a more
> informative message, therefore making it impossible to call (instantiate)
> `ssl.SSLObject`."*

That is the whole lesson of this chunk in one example, from the standard library about
itself: **the structural check passed and the operation is impossible.** Two further notes
matter in practice:

> *"An `isinstance()` check against a runtime-checkable protocol can be surprisingly slow
> compared to an `isinstance()` check against a non-protocol class. Consider using
> alternative idioms such as `hasattr()` calls for structural checks in
> performance-sensitive code."*

> *Changed in version 3.12: The internal implementation of `isinstance()` checks against
> runtime-checkable protocols now uses `inspect.getattr_static()` to look up attributes
> (previously, `hasattr()` was used). As a result, some objects which used to be considered
> instances of a runtime-checkable protocol may no longer be considered instances of that
> protocol on Python 3.12+, and vice versa.*

So the language itself moved from the effective check to the structural one for protocol
membership — precisely because running a property to answer "is this a Closable" is the
wrong trade. That is the distinction to carry:

| Question | Tool | What it actually tests |
|---|---|---|
| Is this in a category, statically? | `isinstance` against a class or ABC | registration, inheritance, or a `__subclasshook__` |
| Does this have the members? | `isinstance` against a `@runtime_checkable` `Protocol`, or `hasattr` | **presence of names**, not signatures |
| Is this attribute *defined*, without running it? | `inspect.getattr_static` | the structure of the class and instance dicts |
| Will the operation work? | **do the operation** | the only test that answers this |

And the ABCs that appear to be capability checks are documented as thin: footnote 1 of
`collections.abc` says the one-method ABCs *"override `__subclasshook__()` to support
testing an interface by verifying the required methods are present and have not been set
to `None`"*, and adds *"this only works for simple interfaces. More complex interfaces
require registration or direct subclassing."* An `isinstance(x, Hashable)` is a check that
`__hash__` is not `None` — not that hashing this particular value succeeds, which it may
not (a tuple containing a list is a `Hashable` whose `hash()` raises `TypeError`).

## `inspect.getattr_static` — the structural look

For the rare case where you must ask about presence without executing anything:

> *"Retrieve attributes without triggering dynamic lookup via the descriptor protocol,
> `__getattr__()` or `__getattribute__()`."*

Its documented caveats cut both ways, and they are the reason it is not a "safe
`hasattr`":

> *"Note: this function may not be able to retrieve all attributes that getattr can fetch
> (like dynamically created attributes) and may find attributes that getattr can't (like
> descriptors that raise AttributeError). It can also return descriptors objects instead of
> instance members."*

> *"If the instance `__dict__` is shadowed by another member (for example a property) then
> this function will be unable to find instance members."*

Use it for introspection tooling — documentation generators, schema dumpers, debuggers,
framework internals that must not trigger user code — and not for control flow. The
documentation does not state what it raises when the attribute is missing and no default
is given, so pass a default rather than relying on a particular exception.

## Gotchas

**★ Symptom: an object passes a `@runtime_checkable` protocol check and then blows up on
the call.** Cause: the docs' own warning — the check verifies *"only the presence of the
required methods or attributes, not their type signatures or types"* — so a wrong
signature, a `NotImplementedError` body or an attribute set to a non-callable all pass.
Fix: treat the protocol check as dispatch, then handle the call's own failure where it
happens; do not add a second structural check.

```python
if isinstance(sink, Closable):
    try:
        sink.close()
    except TypeError as exc:       # wrong signature is a bug in the plugin, not a state
        raise PluginContractError(type(sink).__name__) from exc
```

**★ Symptom: an `isinstance(value, Hashable)` check passes and `hash(value)` raises
`TypeError`.** Cause: the ABC's `__subclasshook__` verifies that `__hash__` is present and
not `None`; a `tuple` satisfies that while containing a `list`, whose hashing fails at
call time. Fix: hash it inside a `try` if the value can be nested and user-supplied.

```python
try:
    seen.add(value)
except TypeError:
    seen.add(repr(value))          # or reject the input, but decide explicitly
```

**★ Symptom: `callable(obj)` is `True` and calling it raises `TypeError`.** Cause:
`callable` reports the presence of `__call__`, which says nothing about the signature — the
`ssl.SSLObject` case the `typing` docs cite is exactly this shape. Fix: call it and let
the `TypeError` from a wrong signature reach a developer, rather than converting it into a
fallback path.

**★ Symptom: the same protocol check gives different answers on 3.11 and 3.12+.** Cause:
the documented change of internal implementation from `hasattr` to
`inspect.getattr_static`, which the docs say may reclassify *"some objects … and vice
versa"*. Fix: do not encode protocol membership in persisted data or cross-version test
fixtures; check capability at the point of use.

**Symptom: a protocol check became slow enough to show in a profile.** Cause: a
runtime-checkable protocol `isinstance` is a structural walk, which the docs describe as
*"surprisingly slow compared to an `isinstance()` check against a non-protocol class"*.
Fix: the docs' own suggestion — `hasattr` for the hot structural check, with the knowledge
that `hasattr` runs the attribute.

**Symptom: monkey-patching a method onto a protocol class stopped affecting `isinstance`
results.** Cause: since 3.12 the members of a runtime-checkable protocol are *"considered
"frozen" at runtime as soon as the class has been created"*. Fix: define the protocol with
the members it needs; if the set is genuinely dynamic, it is not a protocol, it is a
registry.

**Symptom: `@runtime_checkable` raises `TypeError` at import time.** Cause: the decorator
*"raises `TypeError` when applied to a non-protocol class"* — the class must inherit from
`Protocol`. Fix: inherit from `Protocol`; if the class has real implementations, an ABC is
what you wanted.

**Symptom: `getattr_static` finds an attribute that plain access cannot reach, or misses
one that it can.** Cause: both are documented behaviours — it *"may find attributes that
getattr can't (like descriptors that raise AttributeError)"* and *"may not be able to
retrieve all attributes that getattr can fetch (like dynamically created attributes)"*.
Fix: pick the tool by question. Structural introspection: `getattr_static`. Will this
access work: do the access.

**Symptom: a framework's plugin loader runs user code during discovery.** Cause:
`hasattr` or plain `getattr` used to enumerate capabilities, which executes properties and
`__getattr__` hooks on objects the framework does not own. Fix: `inspect.getattr_static`
for discovery — which is exactly why CPython itself adopted it for protocol checks in
3.12 — and the real access at invocation time.

**Symptom: a structural check is used to decide whether data is safe to serialise, and a
`__getattr__`-based proxy passes everything.** Cause: presence checks are answered by the
proxy, not by the underlying object. Fix: serialise inside a `try` and handle
`TypeError`; a proxy that answers every name cannot be distinguished structurally, only
behaviourally.

## Interview questions

**★ Why is `isinstance(x, SomeProtocol)` not a guarantee that the call will work?**
Because it is a structural check by design: *"`@runtime_checkable` will check only the
presence of the required methods or attributes, not their type signatures or types."* The
documentation's own example is `ssl.SSLObject`, which passes an `issubclass` check against
`Callable` while being impossible to instantiate because its `__init__` exists only to
raise `TypeError`. The check tells you the names are there; only the call tells you the
call works.

**★ Why did CPython switch protocol `isinstance` from `hasattr` to
`inspect.getattr_static` in 3.12?**
Because `hasattr` *runs* the attribute, and running user properties to answer "is this
object a Closable" is the wrong trade for a membership test: it costs side effects, and an
`AttributeError` from inside a property would make the object drop out of the protocol.
`getattr_static` asks the structural question instead. The docs warn that the change can
reclassify objects in both directions, which is itself an argument against treating
protocol membership as a stable fact about an object.

**★ What does `isinstance(x, Hashable)` actually tell you?**
That `__hash__` is present and not set to `None` — footnote 1 of `collections.abc`
describes these one-method ABCs as overriding `__subclasshook__` *"to support testing an
interface by verifying the required methods are present and have not been set to
`None`"*, and says *"this only works for simple interfaces. More complex interfaces
require registration or direct subclassing."* It does not tell you that hashing *this
value* succeeds: a tuple containing a list satisfies the check and raises `TypeError` when
hashed. If you need the value hashable, hash it.

**★ Where does `inspect.getattr_static` belong?**
In tooling that must not execute user code: documentation generators, schema extraction,
debuggers, framework internals, and — as of 3.12 — CPython's own protocol checks. Not in
control flow, because its documented behaviour deliberately diverges from `getattr`'s in
both directions: it *"may not be able to retrieve all attributes that getattr can
fetch … and may find attributes that getattr can't"*. It answers "is this defined", not
"will this access work".

**Rank the four ways of asking "can this object do X", and say what each really tests.**
`isinstance` against a class or ABC tests registration, inheritance or a
`__subclasshook__` — a category. `isinstance` against a runtime-checkable protocol, and
`hasattr`, test the presence of names — structure, not signatures. `getattr_static` tests
the structure of the class and instance dictionaries without running anything. And doing
the operation tests whether the operation works, which is the only one of the four that
answers the question as asked. Choose the weakest tool that answers the question you
actually have.

**When is an ABC better than a protocol here?**
When you own both sides and want the failure at class-definition time rather than at call
time: an abstract method left unimplemented makes instantiation fail immediately, which is
a stronger guarantee than any runtime structural check. Protocols are for describing
objects you do *not* own — a third-party client, a duck-typed argument, a plugin — where
you cannot demand inheritance and structure is all you have.

**Does the type checker care which of these you use?**
Yes, and it is a real argument for the structural ones. `isinstance` narrows in the
checker's eyes — it is on mypy's documented list of narrowing constructs, alongside
`issubclass`, `type(x) is T`, `callable`, `is not None`, truthiness and `assert` — so a
protocol `isinstance` both dispatches at runtime and proves the type statically. A `try`
around the call does neither. That is the clearest case where a check earns its keep for
reasons that have nothing to do with avoiding an exception.

---

← Prev: [Duck typing and type-shaped checks](04b-duck-typing-and-the-type-shaped-check.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → **Where LBYL is right** *(not written yet)*
