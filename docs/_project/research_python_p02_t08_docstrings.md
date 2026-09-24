---
name: research-python-p02-t08-docstrings
description: Banked Research: Python Phase 2 · Topic 08 — Docstrings
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 08 — Docstrings

> Verified: 2026-09-03 against Python 3.14 Language Reference (§3.2 The standard type hierarchy, PEP 257, doctest module, inspect module).
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### PEP 257 — Docstring Conventions
URL: https://peps.python.org/pep-0257/
- *"A docstring is a string literal that occurs as the first statement in a module, function, class, or method definition. Such a docstring becomes the `__doc__` special attribute of that object."*
- *"One-line docstrings: Always use `"""triple double quotes"""`. The closing quotes are on the same line as the opening quotes. Use imperative mood ('Do this', 'Return that'), not descriptive ('Does this')."*
- *"Multi-line docstrings consist of a summary line just like a one-line docstring, followed by a blank line, followed by a more elaborate description. The closing quotes should be on a line by themselves."*

### Python 3.14 Library Reference — inspect.getdoc & doctest
URL: https://docs.python.org/3.14/library/inspect.html#inspect.getdoc
- `inspect.getdoc(object)`:
  - *"Get the documentation string for an object, cleaned up with `cleandoc()`. If the documentation string for an object is not provided and the object is a class, a method, a property or a descriptor, retrieve the documentation string from the inheritance hierarchy."*
- `doctest` module:
  - *"The doctest module searches for pieces of text that look like interactive Python sessions, and then executes those sessions to verify that they run exactly as shown."*

### CPython `-OO` flag
- Passing `-OO` to Python strips docstrings from bytecode (`.pyc`), leaving `__doc__` as `None`.
- Code relying on `func.__doc__` at runtime will crash with `TypeError` or `AttributeError` if `-OO` is enabled.

---

## 2. Key Architecture & Pitfalls

1. **`inspect.getdoc()` vs `__doc__`**:
   `obj.__doc__` contains raw indentation from the source file. `inspect.getdoc()` strips uniform leading indentation and falls back to inherited docstrings on classes and methods.
2. **The `-OO` Bytecode Stripping Hazard**:
   Libraries or CLI frameworks (like Click or Typer) that use `__doc__` to generate help messages will fail or display empty strings if executed under `python -OO`.
3. **Google vs NumPy vs Sphinx Formats**:
   - Google style is standard for general web services / applications.
   - NumPy style is standard for data science / PyData ecosystem.
   - Sphinx style is legacy reST.
4. **`doctest` Brittle Assertions**:
   Floating point numbers, dictionary string representations, and memory addresses fail in `doctest`. Use `+ELLIPSIS` or `+NORMALIZE_WHITESPACE` directives.
