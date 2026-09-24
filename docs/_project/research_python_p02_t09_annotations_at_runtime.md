---
name: research-python-p02-t09-annotations-at-runtime
description: Banked Research: Python Phase 2 · Topic 09 — Annotations at runtime
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 09 — Annotations at runtime

> Verified: 2026-09-03 against PEP 649, PEP 749, What's New in Python 3.14, annotationlib module.
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### PEP 749 (Implementing Deferred Evaluation of Annotations)
URL: https://peps.python.org/pep-0749/
- *"The `annotationlib.Format` enum defines four formats: `VALUE = 1`, `VALUE_WITH_FAKE_GLOBALS = 2`, `FORWARDREF = 3`, `STRING = 4`."*
- *"The `SOURCE` format from earlier drafts of PEP 649 was renamed to `STRING`."*
- *"In Python 3.14, `from __future__ import annotations` will continue to work as it did before, converting annotations into strings."*
- *"The compiler generates an `__annotate__` function for functions, classes, and modules that have annotations. It takes an integer `format` parameter."*

### Python 3.14 Library Reference — annotationlib
URL: https://docs.python.org/3.14/library/annotationlib.html
- `annotationlib.get_annotations(obj, *, globals=None, locals=None, eval_str=False, format=Format.VALUE)`:
  - Canonical function to inspect annotations on callables, classes, and modules.
  - Automatically invokes `__annotate__` with the specified format.
- `annotationlib.Format`:
  - `VALUE = 1`
  - `VALUE_WITH_FAKE_GLOBALS = 2`
  - `FORWARDREF = 3`
  - `STRING = 4`
