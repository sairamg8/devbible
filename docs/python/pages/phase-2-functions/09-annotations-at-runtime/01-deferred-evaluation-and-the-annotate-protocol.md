---
title: "Runtime annotations in Python 3.14: PEP 649 deferred evaluation and the __annotate__ protocol"
sidebar_label: "01 · Deferred evaluation & __annotate__"
sidebar_position: 90
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference, What's New in Python 3.14, PEP 649, PEP 749.
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Python 3.14 resolves a decade of language friction by introducing deferred evaluation of annotations by default (PEP 649 and PEP 749). Historically, annotations were either evaluated eagerly at definition time (incurring startup penalties and triggering forward-reference `NameError` crashes) or converted into raw strings via `from __future__ import annotations` (breaking runtime type-inspection frameworks like Pydantic and FastAPI). In Python 3.14, the compiler encapsulates all annotations into a dedicated, internal callable named `__annotate__`. Annotations are never evaluated during module load; instead, they are computed lazily on demand in one of three formats (values, forward references, or source strings).**

## The evolution of Python annotations

Understanding Python 3.14's design requires reviewing the three eras of Python type annotations:

| Era | Behavior | Primary Pitfall |
|---|---|---|
| **Python 3.0–3.6** (PEP 3107) | **Eager Evaluation**: Expressions evaluated as regular code at definition time | Forward references crash with `NameError`; heavy import-time performance penalty |
| **Python 3.7–3.13** (PEP 563) | **Stringification**: `from __future__ import annotations` turned annotations into raw strings | Broke runtime libraries (Pydantic, FastAPI, dataclasses) that require real runtime types |
| **Python 3.14+** (PEP 649 & 749) | **Deferred Evaluation**: Compiled into `__annotate__` code objects; evaluated lazily | None: Native forward references + real runtime types without `eval()` |

## The `__annotate__` protocol

Under Python 3.14, defining a function with type annotations does not execute the annotation expressions:

```python
# Self-referential or forward-referencing types work natively without quotes:
def build_tree(value: int) -> TreeNode:
    return TreeNode(value)

# TreeNode is defined AFTER the function, yet the definition above never crashes:
class TreeNode:
    def __init__(self, value: int):
        self.value = value
```

Behind the scenes, the Python compiler generates an `__annotate__` function attached to `build_tree`:

```python
print(build_tree.__annotate__)
# <function build_tree.__annotate__ at 0x...>
```

`__annotate__` accepts an integer format argument specifying how annotations should be resolved.

## The three evaluation formats

PEP 749 standardizes three evaluation formats through the `annotationlib.Format` enum:

### 1. `Format.VALUE` (Format 1)
Evaluates expressions in the lexical scope where the function was created, returning real Python types:

```python
# Manually invoking __annotate__ in VALUE mode (1):
resolved = build_tree.__annotate__(1)
print(resolved)
# {'value': <class 'int'>, 'return': <class '__main__.TreeNode'>}
```

### 2. `Format.FORWARDREF` (Format 2)
Evaluates annotations to real types where possible, but if an identifier is not yet defined, it wraps the missing symbol in an `annotationlib.ForwardRef` proxy rather than crashing with a `NameError`.

### 3. `Format.SOURCE` (Format 3)
Returns annotations as raw source code strings without evaluating them, identical to PEP 563 stringification:

```python
source_strings = build_tree.__annotate__(3)
print(source_strings)
# {'value': 'int', 'return': 'TreeNode'}
```

## Backward compatibility with `__annotations__`

Existing code and third-party libraries that inspect `func.__annotations__` continue to function without modification:

1. When `func.__annotations__` is first accessed, Python invokes `func.__annotate__(1)` (VALUE mode).
2. The evaluated dictionary is cached in `func.__dict__["__annotations__"]`.
3. Subsequent accesses read directly from the cached dictionary.

```python
# Legacy attribute access triggers lazy evaluation transparently:
print(build_tree.__annotations__)
# {'value': <class 'int'>, 'return': <class '__main__.TreeNode'>}
```

## Gotchas

### Scope deletion before lazy evaluation
**Symptom.** `NameError: name 'User' is not defined` occurs late when calling an inspection library, long after module import succeeded.
**Cause.** The annotation was defined cleanly at module load, but an underlying imported type was deleted or overwritten before `__annotate__` was invoked.
**Fix.** Do not delete module imports used in type signatures.

### Redundant `from __future__ import annotations`
**Symptom.** Modern codebases cluttering files with PEP 563 imports in Python 3.14 projects.
**Cause.** Developer muscle memory from Python 3.7–3.13.
**Fix.** In Python 3.14+, `from __future__ import annotations` is obsolete and should be omitted, as PEP 649's deferred evaluation provides forward references without stringifying types.

## Interview questions

**★ Q: How does Python 3.14 evaluate type annotations differently from earlier versions?**
In Python 3.14, type annotations are deferred by default (PEP 649). Rather than evaluating expressions eagerly at module import time (Python 3.0) or turning them into plain string literals (PEP 563), the compiler packages annotation expressions into an internal `__annotate__` callable. Annotations are evaluated lazily only when reflection is explicitly requested.

**★ Q: What is the `__annotate__` function generated by the Python 3.14 compiler?**
It is a synthetic function attached to functions, classes, and modules that defines how their annotations are evaluated. It accepts a format flag (`1` for real values, `2` for forward-reference proxies, `3` for raw source strings) and computes the annotations on demand within their original lexical scope.

**★ Q: Why did PEP 563's stringification fail to become the permanent default in Python?**
PEP 563 turned all annotations into strings at compile time. While this solved forward references and startup overhead, it severely impacted runtime libraries like Pydantic, FastAPI, and dataclasses, which rely on actual type objects to perform runtime data validation and serialization. These libraries had to resort to `eval()`, which was error-prone and caused scope resolution failures.

**Q: What are the three format arguments supported by the `__annotate__` protocol?**
Format 1 (`Format.VALUE`) returns evaluated runtime types; Format 2 (`Format.FORWARDREF`) returns evaluated types with undefined names represented as forward-reference proxies; and Format 3 (`Format.SOURCE`) returns annotations as raw source-code text.

**Q: What happens when you access the legacy `__annotations__` dictionary on a function in Python 3.14?**
Accessing `func.__annotations__` invokes `func.__annotate__(1)` to evaluate the annotations into real Python types. The resulting dictionary is then cached on `func.__dict__["__annotations__"]` so that repeated accesses incur no re-evaluation overhead.

---

← [Topic index](README.md) · Next → [annotationlib and runtime reflection](02-annotationlib-and-runtime-reflection.md)
