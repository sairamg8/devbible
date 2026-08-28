---
title: "if TYPE_CHECKING removes an import that never had a runtime purpose, and PEP 649 finally makes it work unquoted"
sidebar_label: "6c · Type-checking-only imports"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [`typing.TYPE_CHECKING`](https://docs.python.org/3.14/library/typing.html#typing.TYPE_CHECKING)
> and [`typing.get_type_hints`](https://docs.python.org/3.14/library/typing.html#typing.get_type_hints),
> [What's New In Python 3.14 — deferred evaluation of annotations](https://docs.python.org/3.14/whatsnew/3.14.html),
> [`annotationlib`](https://docs.python.org/3.14/library/annotationlib.html),
> [PEP 649](https://peps.python.org/pep-0649/) and
> [PEP 749](https://peps.python.org/pep-0749/).
> Target: **CPython 3.14**.

**A large share of real circular imports are not dependencies at all — they are
two modules that mention each other's types in annotations. `if TYPE_CHECKING:`
deletes that import from the running program while leaving it visible to every
static tool. Before 3.14 the pattern needed quotes or a `__future__` import to
survive; PEP 649 made annotations lazy by default, so it now works as written.
What has not changed, and what catches everyone, is that any library which
*reads* your annotations at runtime still needs the name to resolve.**

## The import that only a type checker needs

Half of all real-world cycles exist solely because two modules annotate each
other's types. That import has no runtime purpose at all.

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from db import Session             # never imported at runtime

def save(session: "Session") -> None:  # quotes needed on 3.13 and earlier
    ...
```

The `typing` documentation states the constant's contract and the mechanism:

> *"A special constant that is assumed to be `True` by static type checkers. It's
> `False` at runtime."*

> *"A module which is expensive to import, and which only contain types used for
> typing annotations, can be safely imported inside an `if TYPE_CHECKING:` block.
> This prevents the module from actually being imported at runtime; annotations
> aren't eagerly evaluated (see PEP 649) so using undefined symbols in
> annotations is harmless — as long as you don't later examine them."*

## What 3.14 changes: PEP 649 and PEP 749

Before 3.14, that pattern needed help — either string annotations, or
`from __future__ import annotations` at the top of every file using it. On 3.14
it works as written:

> *"The annotations on functions, classes, and modules are no longer evaluated
> eagerly. Instead, annotations are stored in special-purpose annotate functions
> and evaluated only when necessary (except if `from __future__ import
> annotations` is used)."*

> *"This change is designed to improve performance and usability of annotations
> in Python in most circumstances. The runtime cost for defining annotations is
> minimized, but it remains possible to introspect annotations at runtime. It is
> no longer necessary to enclose annotations in strings if they contain forward
> references."*

So on 3.14, `def save(session: Session) -> None:` with `Session` imported under
`if TYPE_CHECKING:` is valid and costs nothing at import. Two caveats, both
sharp:

**1. Anything that *reads* the annotations still needs the name.** The
`get_type_hints` documentation is explicit:

> *"If `Format.VALUE` is used and any forward references in the annotations of
> *obj* are not resolvable, a `NameError` exception is raised. For example, this
> can happen with names imported under `if TYPE_CHECKING`."*

That is the runtime-introspection stack — dataclass field resolution, validation
libraries, dependency-injection frameworks, serialisers. If a library resolves
your annotations, the type must be importable at runtime, and `if TYPE_CHECKING`
is the wrong tool. The documented escape hatch when you control the reader:

> *"If you occasionally need to examine type annotations at runtime which may
> contain undefined symbols, use `annotationlib.get_annotations` with a `format`
> parameter of `Format.STRING` or `Format.FORWARDREF` to safely retrieve the
> annotations without raising `NameError`."*

**2. It only helps *annotations*.** A `TYPE_CHECKING` import used in a
`cast(Session, x)` call, an `isinstance` check, a base class, or any runtime
expression raises `NameError`. The name exists for the type checker and nowhere
else.

If you must support 3.13 and earlier from the same source, keep quoting the
annotations or add `from __future__ import annotations` — the latter is still
supported on 3.14, and the What's New note flags it as the one case where
annotations are *not* stored as annotate functions.

## The full pattern, written out

```python
from __future__ import annotations   # only if you must also run on 3.13 or older
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from myapp.db import Session
    from myapp.models import User

def save(session: Session, user: User) -> None:
    session.add(user)
```

On 3.14 the `__future__` line is unnecessary and the annotations are stored as
annotate functions, evaluated only if something asks. On 3.13 and earlier it is
required, and it turns the annotations into strings instead. Both work; do not
mix modes within a file and expect introspection to behave the same.

## When it is the wrong tool

`if TYPE_CHECKING` is only correct when the name is used **exclusively in
annotations**. Every other use is a runtime expression:

| Use | Works under `TYPE_CHECKING`? |
|---|---|
| `def f(x: Session) -> None` | yes on 3.14; yes on older with `__future__` or quotes |
| `x: Session = ...` (a variable annotation) | yes — the annotation is not evaluated |
| `class Repo(Session):` | **no** — a base class is evaluated at class creation |
| `isinstance(x, Session)` | **no** — a runtime call |
| `cast(Session, x)` | **no** — quote it: `cast("Session", x)` |
| `Session()` anywhere | **no** |
| a `@dataclass` field whose type a library resolves | **no** — see below |
| a default argument value | **no** |

## The runtime-introspection trap

This is the failure that actually reaches production. Anything that resolves
annotations — dataclass machinery that inspects field types, validation
libraries, dependency-injection frameworks, serialisers, ORM mappers — calls
something equivalent to `get_type_hints`, and the documentation states the
consequence directly:

> *"If `Format.VALUE` is used and any forward references in the annotations of
> *obj* are not resolvable, a `NameError` exception is raised. For example, this
> can happen with names imported under `if TYPE_CHECKING`. More generally, any
> kind of exception can be raised if an annotation contains invalid Python
> code."*

So the rule is: **if a library reads the annotation, the type must be genuinely
importable.** In that situation the cycle is real and needs one of the structural
fixes from [chunk 6b](06b-breaking-circular-imports.md) — usually extraction of
the shared type into a third module.

When you own the code doing the reading, 3.14 gives you a safe way to read
annotations that may not resolve:

> *"If you occasionally need to examine type annotations at runtime which may
> contain undefined symbols, use `annotationlib.get_annotations` with a `format`
> parameter of `Format.STRING` or `Format.FORWARDREF` to safely retrieve the
> annotations without raising `NameError`."*

The three formats are described in the 3.14 release notes as `VALUE` (*"which
evaluates annotations to runtime values, similar to the behavior in earlier
Python versions"*), `FORWARDREF` (*"which replaces undefined names with special
markers"*) and `STRING` (*"which returns annotations as strings"*). A tool that
only needs to *display* or *compare* annotations should ask for `STRING`; one
that needs to resolve what it can should ask for `FORWARDREF`.

## The second use: import cost, not cycles

The same mechanism removes startup cost even where there is no cycle. The
`typing` docs put this use first:

> *"A module which is expensive to import, and which only contain types used for
> typing annotations, can be safely imported inside an `if TYPE_CHECKING:`
> block."*

A library that annotates against `numpy.ndarray` or a large protocol module can
declare the relationship for type checkers without making every importer load it.
That belongs with the rest of the startup-cost material in [11 · Startup and
import cost](../11-startup-and-import-cost/README.md).

## Gotchas

**Symptom:** a `TYPE_CHECKING` import breaks a dataclass, a validation library or a DI framework at runtime
**Cause:** those tools resolve annotations, and the docs state a `NameError` is raised for names imported under `if TYPE_CHECKING` when `Format.VALUE` is used
**Fix:** import the type normally for anything the runtime inspects. Reserve `TYPE_CHECKING` for annotations that only the checker reads

**Symptom:** a name imported under `if TYPE_CHECKING` raises `NameError` in a `cast()` or an `isinstance()`
**Cause:** the block does not execute at runtime; only *annotations* are lazily evaluated, not arbitrary expressions
**Fix:** for `cast`, quote the type — `cast("Session", x)`. For `isinstance`, you need a real runtime import

**Symptom:** annotations that worked on 3.13 with `from __future__ import annotations` behave differently on 3.14
**Cause:** the `__future__` import is the documented exception to PEP 649 — with it, annotations remain plain strings rather than becoming annotate functions
**Fix:** pick one mode per file and know which. Removing the `__future__` import on 3.14 gives you real deferred annotations; keeping it gives you strings

**Symptom:** inverting the dependency turned one cycle into two
**Cause:** the callback still imports concrete types from the caller for annotation purposes
**Fix:** annotate against a `typing.Protocol` defined in the lower module, or move the annotation behind `if TYPE_CHECKING`

**Symptom:** a class that inherits from a `TYPE_CHECKING`-imported name raises `NameError` at import
**Cause:** base classes are evaluated when the class statement executes; only annotations are deferred
**Fix:** import the base class normally. If that recreates a cycle, the base class is shared behaviour and belongs in a third module

**Symptom:** the type checker is happy and the code fails at runtime with `NameError`
**Cause:** the name was used somewhere that is not an annotation — a `cast`, a default value, a decorator argument
**Fix:** grep for uses outside annotations. `cast` accepts a string; the others need a real import

**Symptom:** removing `from __future__ import annotations` on 3.14 changed what `__annotations__` contains
**Cause:** with the `__future__` import, annotations are strings; without it on 3.14 they are produced by annotate functions and evaluate to real objects
**Fix:** decide per file, and read annotations through `annotationlib.get_annotations` with an explicit format rather than touching `__annotations__` directly

**Symptom:** a `TYPE_CHECKING` block is flagged as an unused import by a linter
**Cause:** the names are only referenced inside string or deferred annotations, which some configurations do not analyse
**Fix:** configure the linter for `TYPE_CHECKING` blocks — most support it natively and several can move imports into one automatically

## Interview questions

**★ What is `if TYPE_CHECKING` for, and what does it not do?**
It is a constant that static checkers treat as `True` and that is `False` at
runtime, so an import inside it never executes in the running program. It removes
import cost and breaks type-only cycles. It does *not* make the name available to
anything that runs — a `cast`, an `isinstance`, a base class or a library that
resolves annotations at runtime will raise `NameError`. The `get_type_hints` docs
call out that exact case.

**★ What did PEP 649 change about this on 3.14?**
Annotations are no longer evaluated when a function or class is defined; they are
stored in annotate functions and evaluated only when something asks for them. So
a type imported under `if TYPE_CHECKING` can be used unquoted in an annotation
without a `from __future__ import annotations`. What has not changed is that
anything actually reading the annotations in `VALUE` format still needs the name
to resolve; `annotationlib.get_annotations` with `Format.STRING` or
`Format.FORWARDREF` is the documented way to read them safely.

**A cycle exists because two modules annotate each other's types. What do you do?**
`if TYPE_CHECKING` on both sides. It costs nothing at runtime and the checker
still sees everything. The only thing to verify is that nothing resolves those
annotations at runtime — dataclasses, validation and DI frameworks do — in which
case the type must be genuinely importable, and the fix becomes extraction into a
third module instead.

**Why is `if TYPE_CHECKING` not simply the answer to every circular import?**
Because it only removes imports that have no runtime purpose. If either module
actually calls, subclasses, instantiates or `isinstance`-checks the other's
objects, the dependency is real and has to be solved structurally. It also fails
silently in the direction that matters least — the type checker keeps working —
so a team can convince itself a cycle is fixed when it has only been hidden from
one of the two consumers.

**How do you read annotations safely in a library, on 3.14?**
`annotationlib.get_annotations` with `Format.STRING` if you only need to display
or compare them, or `Format.FORWARDREF` if you want to resolve what you can and
leave markers for the rest. `Format.VALUE` reproduces the pre-3.14 behaviour and
raises `NameError` for anything imported under `if TYPE_CHECKING`. Choosing the
format explicitly is what makes a library work with codebases that use the
pattern.

---

← Prev: [Breaking circular imports](06b-breaking-circular-imports.md) · Index: [Imports](README.md) · Next → [09 · `if __name__ == "__main__"`](../09-name-main/README.md)
