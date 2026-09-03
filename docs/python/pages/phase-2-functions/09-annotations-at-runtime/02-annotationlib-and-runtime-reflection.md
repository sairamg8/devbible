---
title: "The annotationlib module: canonical reflection, Format enums, and framework integration"
sidebar_label: "02 · annotationlib & reflection"
sidebar_position: 91
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against [PEP 749](https://peps.python.org/pep-0749/), [Python 3.14 annotationlib documentation](https://docs.python.org/3.14/library/annotationlib.html).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**With PEP 749, Python 3.14 introduces `annotationlib` as the standard library's dedicated subsystem for introspecting type annotations. Rather than relying on splintered legacy utilities (`typing.get_type_hints()` or manual `obj.__annotations__` reads), modern libraries use `annotationlib.get_annotations()`. This function provides a clean, unified reflection interface across functions, classes, and modules, handling descriptor unwrapping and exposing the standardized `Format` enum. For backend frameworks such as Pydantic, FastAPI, and Beanie, `annotationlib` accelerates application boot times and provides crash-resilient forward references via `Format.FORWARDREF`.**

## The `annotationlib` module overview

Before Python 3.14, annotation retrieval was fragmented across three conflicting APIs:
1. `obj.__annotations__` (raw dictionary access; failed on un-evaluated or missing annotations).
2. `inspect.get_annotations()` (added in Python 3.10; solid but lacked format selection).
3. `typing.get_type_hints()` (evaluated string annotations, but often crashed on unresolvable forward references).

In Python 3.14, `annotationlib.get_annotations` becomes the canonical reflection mechanism:

```python
import annotationlib
from annotationlib import Format

def create_order(item_id: int, quantity: int = 1) -> bool:
    return True

# Canonical extraction in Python 3.14:
annotations = annotationlib.get_annotations(create_order, format=Format.VALUE)
# Returns: {'item_id': <class 'int'>, 'quantity': <class 'int'>, 'return': <class 'bool'>}
```

## Exploring the `Format` enum

The `annotationlib.Format` enum governs how `annotationlib` evaluates annotations via the target's `__annotate__` function:

```python
from annotationlib import get_annotations, Format

# 1. Format.VALUE (default): Real evaluated types
val_types = get_annotations(create_order, format=Format.VALUE)

# 2. Format.STRING: Exact source-code strings without evaluation
src_types = get_annotations(create_order, format=Format.STRING)

# 3. Format.FORWARDREF: Resilient evaluation with proxy objects
# Returns real types for existing classes, and ForwardRef proxies for missing classes
```

### Crash-resilient reflection with `Format.FORWARDREF`

When introspecting models that reference types defined in other modules or later in the codebase, `Format.VALUE` raises a `NameError` if an identifier is missing. `Format.FORWARDREF` prevents this failure:

```python
from annotationlib import get_annotations, Format

def register_webhook(url: str, payload: PendingPayload) -> None:
    pass

# PendingPayload is NOT defined yet:
# format=Format.VALUE would raise NameError: name 'PendingPayload' is not defined

# format=Format.FORWARDREF safely returns an annotationlib.ForwardRef proxy:
hints = get_annotations(register_webhook, format=Format.FORWARDREF)
# hints['payload'] is ForwardRef('PendingPayload')
```

Validation frameworks use `Format.FORWARDREF` to parse schema structures without crashing if a type is not yet imported.

## Class reflection and inheritance

Calling `annotationlib.get_annotations(cls)` returns annotations declared directly on that specific class. To collect all fields in an inheritance hierarchy, frameworks traverse the class's Method Resolution Order (MRO):

```python
import annotationlib
from annotationlib import Format

class BaseModel:
    id: int

class UserRecord(BaseModel):
    username: str

def get_full_schema(cls) -> dict:
    fields = {}
    for base in reversed(cls.__mro__):
        fields.update(annotationlib.get_annotations(base, format=Format.VALUE))
    return fields

# get_full_schema(UserRecord) yields: {'id': <class 'int'>, 'username': <class 'str'>}
```

## Performance benefits in backend services

In large web applications (e.g. FastAPI services with hundreds of Pydantic models):
- **Prior to Python 3.14:** Every type annotation in every model was evaluated immediately during `import` time, significantly increasing service startup and test initialization times.
- **In Python 3.14:** Type annotations are compiled into `__annotate__` bytecode and never evaluated until `get_annotations` is called. Applications boot faster and consume less memory during cold starts.

## Gotchas

### Assuming `get_annotations` on classes includes base class fields
**Symptom.** Subclasses appear to be missing fields defined on their parent classes.
**Cause.** `annotationlib.get_annotations(SubClass)` only inspects `SubClass.__dict__`.
**Fix.** Traverse `cls.__mro__` in reverse order to build complete inheritance schemas.

### Circular import deadlocks under `Format.VALUE`
**Symptom.** `NameError` during schema generation when two models reference each other across module boundaries.
**Cause.** Calling `Format.VALUE` forces immediate evaluation of the cross-module symbol.
**Fix.** Use `format=Format.FORWARDREF` during initial schema discovery, resolving types later once all modules are loaded.

## Interview questions

**★ Q: What is the recommended way to inspect type annotations at runtime in Python 3.14+?**
Use `annotationlib.get_annotations(obj, format=Format.VALUE)`. The `annotationlib` module (introduced in Python 3.14 via PEP 749) replaces legacy fragmented methods, correctly unrolls descriptors, supports the new `__annotate__` protocol, and allows selecting evaluation formats.

**★ Q: How does `Format.FORWARDREF` prevent crashes in runtime type inspection tools?**
When evaluating annotations, if an identifier is not found in the lexical scope, standard evaluation (`Format.VALUE`) raises a `NameError`. With `Format.FORWARDREF`, `annotationlib` catches the missing name and substitutes an `annotationlib.ForwardRef` proxy object, allowing the introspection process to complete successfully.

**★ Q: How does Python 3.14's deferred annotation system improve application startup performance?**
Under deferred evaluation (PEP 649), annotations are stored in separate code objects and are not executed when modules are imported. Large applications with thousands of typed functions and schemas avoid running hundreds of thousands of type expressions during boot, dramatically reducing cold-start latency.

**Q: Does `annotationlib.get_annotations()` on a class automatically return inherited annotations?**
No. It returns only the annotations defined directly on the specified class. To inspect all inherited annotations, a framework must iterate through `cls.__mro__` and aggregate the annotations from each base class.

**Q: What is the difference between `Format.VALUE` and `Format.STRING` in `annotationlib`?**
`Format.VALUE` evaluates annotations in their definition scope and returns actual Python type objects (such as `<class 'int'>`). `Format.STRING` does not evaluate expressions; it returns the exact string text as written in the source code (such as `'int'`).

---

← [Deferred evaluation & __annotate__](01-deferred-evaluation-and-the-annotate-protocol.md) · [Topic index](README.md) · Next → [Recursion and the limit](../10-recursion-and-the-limit/README.md)
