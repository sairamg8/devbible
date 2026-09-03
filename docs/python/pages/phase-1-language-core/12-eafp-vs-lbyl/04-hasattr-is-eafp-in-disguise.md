---
title: "hasattr is not a look: the documentation defines it as calling getattr and seeing whether AttributeError comes out, so the check runs your property, swallows its bugs, and lets every other exception through"
sidebar_label: "04 · hasattr is EAFP in disguise"
sidebar_position: 128
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`hasattr`](https://docs.python.org/3.14/library/functions.html#hasattr),
> [`getattr`](https://docs.python.org/3.14/library/functions.html#getattr),
> [`inspect.getattr_static`](https://docs.python.org/3.14/library/inspect.html#inspect.getattr_static),
> [Glossary: `duck-typing`](https://docs.python.org/3.14/glossary.html#term-duck-typing).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**The most-used LBYL construct in Python is not an `if` over a boolean — it is
`hasattr`, and the reference manual defines it in terms of the exception it is supposed
to spare you: *"This is implemented by calling `getattr(object, name)` and seeing whether
it raises an `AttributeError` or not."* Everything surprising about `hasattr` follows from
that one sentence. The attribute is actually fetched, so a property's body runs and its
side effects happen. An `AttributeError` raised *inside* that body is indistinguishable
from the attribute not existing, so a typo in your own property reports as "the object
does not have this". And any other exception is not caught, so `hasattr` can raise. It is
EAFP with the handler hidden, and knowing that is the difference between using it well
and being surprised by it twice a year.**

## The three spellings, and the one you should reach for

```python
class Settings:
    def __init__(self, overrides: dict[str, str]):
        self._overrides = overrides

    @property
    def region(self) -> str:
        return self._overrides["region"]        # KeyError if unset — note, not AttributeError


# LBYL — two attribute lookups on a hit, and the property body runs twice.
if hasattr(cfg, "region"):
    region = cfg.region
else:
    region = "us-east-1"

# EAFP — one lookup, and the handler states the assumption.
try:
    region = cfg.region
except AttributeError:
    region = "us-east-1"

# Neither — one lookup, fallback in the call. The shortest correct form.
region = getattr(cfg, "region", "us-east-1")
```

`getattr`'s third argument is documented plainly: *"If the named attribute does not
exist, default is returned if provided, otherwise `AttributeError` is raised."* That is
the same "third family" as `dict.get` and `set.discard` — a single operation carrying its
own fallback — and for attribute access it is almost always the answer.

⚠️ Watch the example's `region` property: it raises `KeyError`, not `AttributeError`. None
of the three spellings above handles that, and the `hasattr` version does not even
survive it — see the third consequence below.

## Consequence 1 — the check *runs* the attribute

Because `hasattr` calls `getattr`, a `property`, a `__getattr__` hook, a descriptor or a
lazily-loading ORM field all execute during the "look". If that code hits a database,
opens a file, spends time, or caches something, your pre-check did it too — and then the
real access did it again.

```python
class Invoice:
    @property
    def pdf(self) -> bytes:
        # Renders on first access. Expensive, and it writes to a cache directory.
        return render_pdf(self.id)


# 🔴 Renders the PDF twice: once to answer hasattr, once to use it.
if hasattr(invoice, "pdf"):
    store(invoice.pdf)

# One render.
try:
    store(invoice.pdf)
except AttributeError:
    log.info("no pdf for %s", invoice.id)
```

For attributes backed by plain instance state this costs nothing measurable. For anything
computed, it doubles the work and can double the side effects — and it is invisible at the
call site, because `hasattr` reads like an inspection.

## Consequence 2 — your bug becomes "the attribute does not exist"

This is the expensive one. `hasattr` returns `False` for *any* `AttributeError` out of the
attribute's own code, including one caused by a typo inside a property forty lines away.

```python
from dataclasses import dataclass, field


@dataclass
class Line:
    sku: str
    price: int


@dataclass
class Order:
    id: str
    lines: list[Line] = field(default_factory=list)

    @property
    def total(self) -> int:
        return sum(line.prcie for line in self.lines)     # typo: .prcie


order = Order(id="A-1", lines=[Line(sku="widget", price=1200)])
hasattr(order, "total")      # False — and the reason is a typo, not a missing attribute
```

Nothing raises. The branch that handles "no total available" runs, the order is treated as
untotalled, and the typo survives every test that only asserts the fallback path. The fix
is not to stop using properties — it is to make the check as narrow as the assumption:

```python
# If total is required, access it and let the AttributeError escape with its traceback,
# which names `line.prcie` — the actual defect.
total = order.total

# If it is genuinely optional, catch only around the access and log the exception object,
# so a masked bug still leaves evidence.
try:
    total = order.total
except AttributeError as exc:
    log.warning("no total for %s: %s", order.id, exc)
    total = None
```

There is one tool that asks about presence without running anything —
`inspect.getattr_static` — and it answers a *structural* question rather than "will this
access work". It belongs with the other structural checks, in
[duck typing and the type-shaped check](04b-duck-typing-and-the-type-shaped-check.md).

## Consequence 3 — `hasattr` can raise

The definition says it watches for `AttributeError`. It says nothing about anything else,
and nothing else is caught. A property that raises `KeyError`, `ValueError`,
`TimeoutError` or `RuntimeError` propagates that straight out of your "safe" check.

```python
cfg = Settings(overrides={})   # no "region" key at all

# 🔴 Raises KeyError — the check itself blows up, before any of your code runs.
if hasattr(cfg, "region"):
    deploy_to(cfg.region)

# The honest spelling: name the exception the property can actually raise.
try:
    region = cfg.region
except KeyError:
    region = "us-east-1"
deploy_to(region)
```

That is worth internalising, because the mental model most people carry is "`hasattr` is
the safe version". It is safe against exactly one exception type. If you need "does this
work at all", the honest spelling is a `try` naming the exceptions you actually expect —
and if you cannot name them, that is a signal about the object's design, not about your
error handling.

## Gotchas

**★ Symptom: a property's expensive work happens twice per request.** Cause: a `hasattr`
guard in front of the access — the check calls `getattr`, which runs the property, and
then the real access runs it again. Fix: access once inside a `try`, or use `getattr` with
a default.

```python
value = getattr(obj, "computed", None)
```

**★ Symptom: an object "does not have" an attribute that is plainly defined.** Cause: the
attribute's own code raised `AttributeError` — a typo, a missing dependency, a
`self.__dict__` access on a slotted class — and `hasattr` reports every `AttributeError`
as absence. Fix: access it directly and read the traceback; keep the handler only if
absence is genuinely expected, and log the exception object when you catch it.

**★ Symptom: `hasattr` raises.** Cause: the attribute raised something other than
`AttributeError`, which the documented implementation does not catch. Fix: name the real
exceptions in a `try`, or fix the attribute so it raises `AttributeError` (or does not
raise) — a property that raises `KeyError` is a leaky abstraction.

**★ Symptom: a `__getattr__` hook makes `hasattr` return `True` for everything.** Cause:
`__getattr__` that returns a value (or a stub) instead of raising `AttributeError` for
unknown names — every check passes, and the "missing" branch is unreachable. Fix: a
`__getattr__` must `raise AttributeError(name)` for names it does not handle; that is the
contract every presence test in the language is built on.

```python
def __getattr__(self, name):
    try:
        return self._fields[name]
    except KeyError:
        raise AttributeError(name) from None    # required, not optional
```

**Symptom: `hasattr(obj, "__secret")` is always `False` inside a class body.** Cause:
private name mangling *"happens at compilation time"*, so the real attribute is
`_ClassName__secret` while the string you passed is not mangled — the docs note this under
`getattr`. Fix: pass the mangled name, or stop reaching for double-underscore attributes
by string.

**Symptom: `try`/`except AttributeError` around a whole block hides a real
`AttributeError` from a nested call.** Cause: the handler is wider than the assumption —
`obj.a.b.c()` has four places to raise it, and code inside `c()` has more. Fix: one
attribute access per `try`, or `getattr` with a default per level.

**Symptom: an ORM object reports `hasattr(row, "author") is False` for a relationship that
exists.** Cause: lazy loading raised inside the descriptor — a detached session, a closed
connection — and the resulting error surfaced as `AttributeError`, or the loader itself
raised something `hasattr` let through. Fix: access it inside a `try` that names the ORM's
own exception, and treat "cannot load" as different from "not set", because it is.

**Symptom: `hasattr` is used to test for a method and the call fails anyway.** Cause: the
name resolving says nothing about the call working — wrong signature, a `NotImplementedError`
body, a `None` where a method was expected. Fix: if the next step is to call it, call it,
and handle the call's failure where it happens.

```python
handler = getattr(plugin, "on_close", None)
if handler is not None:
    handler(reason)          # a TypeError here is a plugin bug, and should escape
```

**Symptom: two `hasattr` calls in a row on the same object, and the second one is
`False`.** Cause: the first call ran a property whose side effect changed the object — a
lazy loader that consumed a one-shot stream, a cache that evicted, a generator that was
exhausted. Fix: fetch once into a local; the value is the thing you wanted, not the
answer to whether you could get it.

## Interview questions

**★ Is `hasattr` LBYL or EAFP?**
Both, depending on where you stand. At the call site it is LBYL — an explicit
pre-condition test before the access. Internally it is EAFP: the documentation defines it
as *"calling `getattr(object, name)` and seeing whether it raises an `AttributeError` or
not"*. That is why it inherits every property of the access itself — the side effects, the
cost, and the ambiguity between "absent" and "raised `AttributeError` while computing".

**★ What is the failure mode of `hasattr` on a property?**
Two, and they compound. The property *runs*, so any cost or side effect happens during
the check and again during the use; and any `AttributeError` raised inside its body is
reported as `False`, so a bug in your own code is indistinguishable from a missing
attribute. A typo in a property makes `hasattr` return `False`, the fallback branch runs,
and nothing anywhere records that an exception happened.

**★ Can `hasattr` raise an exception?**
Yes. It is documented to watch for `AttributeError` only, so a property or `__getattr__`
that raises `KeyError`, `TimeoutError`, `RuntimeError` or anything else propagates
through it. The idea that `hasattr` is "the safe way" is exactly one exception type wide.

**★ What must a `__getattr__` implementation do for `hasattr` to work at all?**
Raise `AttributeError` for names it does not handle. Every presence test in the language —
`hasattr`, `getattr` with a default, `try`/`except AttributeError` — is built on that
signal, so a hook that returns `None` or a stub for unknown names makes all of them report
`True` and quietly breaks duck typing for the whole object. Use
`raise AttributeError(name) from None` inside the hook's own miss branch.

**`getattr(obj, "x", None)` versus `try: obj.x except AttributeError`. Which and why?**
`getattr` with a default when the fallback is a value and absence is ordinary — it is one
operation, one line, and the default is visible at the call site. The `try` form when the
handler needs to do more than substitute a value: log, translate the error, choose a
different code path, or attach context. Never both, and never a `hasattr` in front of
either.

**Why is `getattr(obj, name, sentinel) is not sentinel` sometimes written instead of
`hasattr`?**
Because it makes the "absent" answer distinguishable from a legitimately falsy value, and
because it gets you the value in the same call rather than in a second lookup. It does
*not* fix the deeper issue: the attribute is still fetched, so the property still runs and
an `AttributeError` from inside it still reads as absence. It is a better spelling of the
same question, not a different question.

**A colleague guards every attribute access with `hasattr` "for safety". What do you tell
them?**
That the guard is an attribute access, so it doubles the work and can raise; that it
converts bugs in their own properties into a silent fallback path; and that the thing they
actually want — a default when the attribute is not set — has a one-call spelling in
`getattr(obj, name, default)`. The remaining legitimate use is capability branching in a
plugin or protocol loader, where the next step is a call and the check is a registration
decision.

---

← Prev: [Sequences, sets and nesting](03c-sequences-sets-and-nested-lookups.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Duck typing and type-shaped checks](04b-duck-typing-and-the-type-shaped-check.md)
