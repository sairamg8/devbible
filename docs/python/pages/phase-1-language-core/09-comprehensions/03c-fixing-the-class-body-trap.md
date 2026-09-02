---
title: "Four ways out of the class body trap, only two of which you should ship"
sidebar_label: "3c · Fixing the class body trap"
sidebar_position: 96
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Execution model — resolution of names](https://docs.python.org/3.14/reference/executionmodel.html#resolution-of-names),
> [Annotation scopes](https://docs.python.org/3.14/reference/executionmodel.html#annotation-scopes),
> the Library Reference
> [`enum`](https://docs.python.org/3.14/library/enum.html),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html),
> and [PEP 572](https://peps.python.org/pep-0572/),
> [PEP 695](https://peps.python.org/pep-0695/).
> Target: **CPython 3.14**.

**There are four ways to make a class-body comprehension see the names it needs,
and the ranking matters: move it to a method, lift the constants to module
level, smuggle the value in as a default argument, or write a plain `for`
statement. The first two are fixes; the third is a curiosity you should be able
to read; the fourth works but leaves a class attribute behind that `Enum`,
`dataclasses` and ORM metaclasses will all pick up. This chunk also covers the
two related failures — the walrus that is a `SyntaxError` rather than a
`NameError`, and the annotation scopes that are the documented exception to the
whole rule.**

## 1 — Move it into a method or `classmethod`

Inside a method the normal function rules apply, and the class's names are
reached through the object rather than through name resolution:

```python
class Report:
    COLUMNS = ["id", "name"]
    WIDTH = 20

    @classmethod
    def padded(cls):
        return [c.ljust(cls.WIDTH) for c in cls.COLUMNS]
```

This is usually the right answer, and it has a second benefit nobody asks for
but everybody wants: the computation becomes lazy instead of running at import
time. A class-body comprehension runs when the module is first imported, in
whatever order the import graph happens to produce, before any configuration has
been loaded.

`__init_subclass__` is the same fix for the case where each subclass needs its
own derived value:

```python
class Base:
    COLUMNS: list[str] = []

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        cls.INDEX = {c: i for i, c in enumerate(cls.COLUMNS)}
```

`__init_subclass__` is a method, so its body is a function scope and the
comprehension can read `cls` freely.

## 2 — Lift the constants to module level

If the names are constants, they are not really class state; making them globals
removes the problem at the root, because nested scopes can always read globals:

```python
WIDTH = 20
COLUMNS = ["id", "name"]

class Report:
    padded = [c.ljust(WIDTH) for c in COLUMNS]      # both are globals now
```

The class can still expose them — `WIDTH = WIDTH` in the body is legal and
binds the class attribute from the global — but note that the comprehension is
reading the *global*, not the class attribute, so a subclass overriding `WIDTH`
will not change `padded`. That is a real semantic difference, and it is the
reason fix 1 is ranked above this one.

## 3 — Smuggle the value in as a default argument

Default arguments are evaluated in the enclosing scope at definition time, which
for a `lambda` written in a class body means the class body:

```python
class Report:
    WIDTH = 20
    COLUMNS = ["id", "name"]
    _pad = lambda c, w=WIDTH: c.ljust(w)          # w captured from the class body
    padded = [_pad(c) for c in COLUMNS]           # NameError: '_pad'
```

And there it fails anyway, because `_pad` is itself a class name the
comprehension cannot see. You would have to pass the callable in through the
leftmost iterable, which is where this technique degenerates into unreadable:

```python
padded = [f(c) for f in [lambda c, w=WIDTH: c.ljust(w)] for c in COLUMNS]
```

The leftmost iterable is a one-element list holding the closure, and `COLUMNS`
is in the *second* clause — which also cannot see the class body. So this
version does not work either without lifting `COLUMNS`. **Do not use this
approach.** It is documented here so that when you meet it in a codebase you can
recognise what the author was fighting and replace it with fix 1.

## 4 — Write the loop, then `del` the target

A `for` statement in a class body is not a nested code block. It executes
directly in the class namespace, so it can read every name defined so far:

```python
class Report:
    COLUMNS = ["id", "name"]
    WIDTH = 20
    padded = []
    for _c in COLUMNS:
        padded.append(_c.ljust(WIDTH))
    del _c                                   # otherwise Report._c exists
```

Two things about that `del`. First, it is required for correctness of the class's
public surface, not for tidiness: a `for` statement's target is not deleted when
the loop ends (the reference says *"Names in the target list are not deleted when
the loop is finished"*), so `_c` becomes a class attribute. Second, it raises
`NameError` if `COLUMNS` was empty, because the target was then never bound at
all — so on a possibly-empty iterable you need `del _c` guarded, or a leading
underscore and a shrug.

Where the stray attribute actually bites:

- **`dataclasses`** — an annotated leftover becomes a field; an unannotated one
  becomes a class attribute that shows up in `vars()`.
- **`enum.Enum`** — any non-descriptor, non-dunder class attribute becomes a
  *member*, so `Report._c` would be an enum member named `_c`. (Names with a
  single leading underscore are reserved by `enum`, which is its own error.)
- **ORM declarative bases** — SQLAlchemy and Django metaclasses scan the
  namespace and will either ignore it or complain, depending on its type.
- **`__slots__`** — a stray name is simply absent from slots and becomes a
  surprise class-level fallback.

## The `Enum` variant of the original trap

`Enum` bodies are class bodies, and the failure looks like a library bug:

```python
from enum import Enum

class Colour(Enum):
    NAMES = ["red", "green"]
    ALL = [n for n in NAMES]                           # works
    UPPER = [n.upper() for n in NAMES if n in NAMES]   # NameError: 'NAMES'
```

`Enum`'s metaclass installs a custom namespace mapping to detect duplicate
members, but the scope rule is a *compiler* rule and applies regardless of what
mapping the class body is executing into. There is a second problem here worth
noticing: `NAMES` and `ALL` become enum members, which is almost certainly not
what was wanted. Build the list at module level and reference it.

## A walrus here is a `SyntaxError`, not a `NameError`

PEP 572 closes the door explicitly:

> *"If the rules above were to result in the target being assigned in that
> class's scope, the assignment expression is expressly invalid."*

```python
class Example:
    [(j := i) for i in range(5)]     # SyntaxError
```

Also from PEP 572. The reason is that the walrus is defined to bind in the
containing scope, and the containing scope here is a class body the comprehension
cannot write to — so rather than pick a surprising behaviour, the language
rejects it at compile time. Note the failure mode difference: this one is caught
when the module is *compiled*, so it cannot reach production behind an untested
branch, unlike the `NameError` version. The rest of the walrus restriction
catalogue is in
[the walrus rules and scope](../05-truthiness/05b-walrus-rules-and-scope.md).

## Annotation scopes are the documented exception

The reference sentence that names comprehensions as blocked also carves out
annotation scopes: they *"have access to their enclosing class scopes"*. That is
why a PEP 695 type alias or a generic parameter bound can reference a class-level
name where a comprehension cannot:

```python
class A:
    type Alias = Nested
    class Nested: pass
```

That example is from the reference — and note it works even though `Nested` is
defined *after* the alias, because an annotation scope is lazily evaluated. It is
worth knowing so that "nested scopes can never see class scope" does not become a
rule you over-apply: annotation scopes are the exception, and they are the only
one.

## Gotchas

**★ Symptom — a class-body comprehension was "fixed" by moving the constants to
module level, and now a subclass overriding the constant has no effect.** Cause:
the comprehension now reads the global, which subclassing cannot change, and it
ran once at import time. Fix: use a `classmethod` or `__init_subclass__` so the
derived value is computed per class from `cls`.

**★ Symptom — converting a class-body comprehension to a `for` loop fixes the
`NameError` but adds a stray class attribute.** Cause: a `for` statement in a
class body binds its target in the class namespace and the reference says loop
targets are not deleted when the loop finishes. Fix: `del` the target after the
loop — and be aware that the `del` itself raises `NameError` when the iterable
was empty.

**★ Symptom — a `dataclass` gains an unexpected field, or an `Enum` gains an
unexpected member, after a loop was added to the class body.** Cause: the loop
target became a class attribute and the decorator or metaclass picked it up. Fix:
`del` the target, or better, do not build data in the class body at all — put it
in `__init_subclass__` or a module-level constant.

**Symptom — `SyntaxError` rather than `NameError` from a class-body
comprehension.** Cause: it contains a walrus; PEP 572 makes an assignment
expression that would bind in a class scope *"expressly invalid"*. Fix: compute
the value on a separate line in the class body, where a plain assignment is fine.

**Symptom — a class-level derived value is wrong because it was computed before
configuration was loaded.** Cause: class bodies run at import time, in import
order. Fix: this is the strongest argument for fix 1 — a `classmethod` or a
cached property computes on first use, after the application has started.

**Symptom — the default-argument workaround still raises `NameError`.** Cause:
the smuggled closure is itself a class-body name, and the comprehension cannot
see *that* either; only the leftmost iterable escapes. Fix: abandon the
workaround; it cannot be made to work without also lifting the iterable, at which
point fix 2 is simpler.

**Symptom — a type alias inside a class resolves a class name and a
comprehension on the next line does not.** Cause: annotation scopes are the
documented exception to the class-scope rule; comprehensions are not. Fix:
nothing — but do not generalise from the alias working to the comprehension
working.

## Interview questions

**★ Q: How do you fix a class-body comprehension that cannot see a class
attribute?**
Move it into a method or `classmethod` where `cls.X` is an attribute lookup
rather than a name lookup — that is both the correct fix and a lazy one, since
class bodies otherwise run at import time. The second option is to lift the
constants to module level so they become globals, which every nested scope can
read; the cost is that subclass overrides no longer affect the derived value. A
plain `for` statement in the class body also works, because it is not a separate
code block, but its target leaks into the class namespace and must be deleted.

**★ Q: What is wrong with the `for`-loop-in-a-class-body fix?**
The loop target becomes a class attribute — loop targets are not deleted when the
loop finishes — so the class ends up with a stray member. `dataclasses` may turn
it into a field, `Enum` will turn it into a member, and ORM metaclasses will scan
it. You must `del` it, and the `del` will itself raise if the iterable was empty.

**Q: What happens if you put a walrus in a class-body comprehension?**
`SyntaxError` at compile time. PEP 572 says an assignment expression whose target
would be assigned in a class scope is *"expressly invalid"*, because the walrus
binds in the containing scope and the comprehension cannot write to a class
namespace. Being a compile-time error, it cannot hide in an untested branch the
way the `NameError` can.

**Q: Is there any nested scope that can see class scope?**
Yes — annotation scopes. The reference's sentence about comprehensions ends
*"but it does not include annotation scopes, which have access to their enclosing
class scopes"*. That is why a PEP 695 type alias inside a class can refer to a
name defined later in the same class body: the alias is lazily evaluated in a
scope that keeps its class-body access.

**Q: Why does a `for` statement in a class body not have this problem?**
Because it is not a separate code block. It executes directly in the class body's
namespace, so it can read every name defined so far — and its target is bound
there too, which is exactly why it leaks.

**Q: Is `__init_subclass__` a real fix or a trick?**
A real fix, and the right one when each subclass needs its own derived value. It
is an ordinary method, so its body is a function scope with full access to `cls`,
and it runs once per subclass definition rather than once at import of the base
module.

---

← Prev: [The class body trap](03b-the-class-body-trap.md) · Index: [Comprehensions](README.md) · Next → [PEP 709 inlining](04-pep-709-inlining.md)
