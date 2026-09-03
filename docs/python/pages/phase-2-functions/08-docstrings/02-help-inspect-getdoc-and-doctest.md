---
title: "Interactive documentation and verification: help(), inspect.getdoc(), and doctest"
sidebar_label: "02 · help, getdoc, and doctest"
sidebar_position: 81
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Library Reference (inspect module, doctest module, pydoc module).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Python integrates documentation directly into the development workflow through three distinct tools: the interactive `help()` system, the programmatic inspection function `inspect.getdoc()`, and the `doctest` verification runner. While accessing `obj.__doc__` directly returns raw string data contaminated with source indentation artifacts, `inspect.getdoc()` cleans leading whitespace via `cleandoc()` and automatically resolves docstrings up the class inheritance hierarchy. Furthermore, the standard `doctest` module scans docstrings for interactive REPL prompts (`>>>`), executing code blocks and asserting outputs to prevent documentation examples from drifting out of sync with code changes.**

## Interactive inspection with `help()`

The built-in `help()` function leverages Python's `pydoc` engine to render human-readable reference documentation in terminal pagers:

```python
def fetch_metrics(service_name: str, timeout: int = 10) -> dict[str, float]:
    """Fetch health and latency metrics for an upstream service."""
    return {"latency_ms": 1.2}

help(fetch_metrics)
```

In interactive environments, `help()` formats:
1. The full callable signature, including default values and type annotations (derived via `inspect.signature`).
2. The cleaned docstring body.
3. The module location and callable category (function, bound method, built-in).

## Programmatic inspection: `inspect.getdoc()` vs `__doc__`

Production introspection tools and API doc generators should never access `obj.__doc__` directly:

```python
import inspect

class BaseService:
    def execute(self) -> None:
        """Execute the primary workload on the cluster."""
        pass

class Worker(BaseService):
    def execute(self) -> None:
        pass  # Omitted docstring

# 1. Raw __doc__ lookup:
print(Worker.execute.__doc__)
# None

# 2. inspect.getdoc() lookup:
print(inspect.getdoc(Worker.execute))
# 'Execute the primary workload on the cluster.'
```

### The two advantages of `inspect.getdoc()`

1. **Inheritance resolution:** If a method does not define a docstring, `inspect.getdoc()` traverses the class's MRO to retrieve the docstring from the overridden parent method. `obj.__doc__` simply evaluates to `None`.
2. **Indentation normalization (`cleandoc`):** `obj.__doc__` preserves the indentation of the Python source file. `inspect.getdoc()` runs `inspect.cleandoc()`, stripping uniform leading whitespace from all lines while preserving intentional sub-indentation in code examples.

## Executable documentation with `doctest`

The `doctest` module enforces accuracy by executing interactive Python sessions embedded directly inside docstrings:

```python
def parse_version(version_str: str) -> tuple[int, int, int]:
    """Parse a semver string into a three-integer tuple.

    >>> parse_version("3.14.7")
    (3, 14, 7)
    >>> parse_version("1.0.0")
    (1, 0, 0)
    >>> parse_version("invalid")
    Traceback (most recent call last):
        ...
    ValueError: Invalid semver format: 'invalid'
    """
    parts = version_str.split(".")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        raise ValueError(f"Invalid semver format: {version_str!r}")
    return (int(parts[0]), int(parts[1]), int(parts[2]))
```

### Running doctests

From the terminal:
```bash
python3 -m doctest -v parse_utils.py
```

Inside test suites (e.g., `pytest` or `unittest`):
```python
import doctest
import parse_utils

def test_docstrings():
    results = doctest.testmod(parse_utils)
    assert results.failed == 0
```

### Managing non-deterministic outputs

Real-world outputs containing memory addresses, dynamic timestamps, or dictionary ordering will fail rigid doctest string equality. Use `doctest` directives:

```python
def create_session(user_id: int):
    """Create a temporary session.

    >>> create_session(42)  # doctest: +ELLIPSIS
    <Session user_id=42 token='...' created_at=...>
    """
    ...
```

- `# doctest: +ELLIPSIS` — allows `...` to match any substring, matching unpredictable tokens or memory addresses.
- `# doctest: +NORMALIZE_WHITESPACE` — treats any sequence of whitespace/newlines as a single space.

## Gotchas

### Trailing whitespace failures in doctests
**Symptom.** `Failed example: parse_version(...) Expected: ... Got: ...` with no visible difference in output.
**Cause.** Invisible trailing whitespace on the expected output line in the docstring.
**Fix.** Configure your editor to strip trailing whitespace, or enable `+NORMALIZE_WHITESPACE`.

### Assuming `obj.__doc__` inherits from base classes
**Symptom.** Logging `f"Running: {step.__doc__}"` outputs `None` for subclass implementations.
**Cause.** Python does not copy `__doc__` across inheritance chains at class creation time.
**Fix.** Use `inspect.getdoc(step)` instead of `step.__doc__`.

## Interview questions

**★ Q: Why should you use `inspect.getdoc(obj)` instead of directly accessing `obj.__doc__`?**
Directly accessing `obj.__doc__` has two major drawbacks: it includes raw source-code indentation leading spaces from the multi-line literal, and it returns `None` if a subclass method overrides a parent method without rewriting its docstring. `inspect.getdoc()` strips uniform leading indentation using `cleandoc()` and automatically traverses the class inheritance hierarchy (MRO) to inherit docstrings from parent classes.

**★ Q: What is the primary purpose of the `doctest` module and how does it prevent documentation drift?**
`doctest` verifies that code examples inside docstrings remain accurate and executable. It scans docstrings for interactive REPL prompts (`>>>`), executes the commands in an isolated environment, and compares the runtime stdout/stderr with the expected output string in the docstring. If code behavior changes but documentation is not updated, tests fail immediately.

**★ Q: How do you handle non-deterministic outputs (like memory addresses or timestamps) in doctests?**
Append `# doctest: +ELLIPSIS` to the example line and replace variable parts of the expected output with `...`. For multi-line outputs with variable indentation or line-wrapping, use `# doctest: +NORMALIZE_WHITESPACE`.

**Q: What happens when `inspect.getdoc()` is called on a method that does not have a docstring?**
`inspect.getdoc()` walks the class's Method Resolution Order (MRO). If any parent class defines a docstring for that method, `inspect.getdoc()` returns that parent's docstring. If no class in the MRO defines a docstring, it returns `None`.

**Q: How does the interactive `help()` built-in format output for callables?**
`help()` delegates to the `pydoc` module. It extracts the callable's signature and type annotations using `inspect.signature()`, cleans its docstring with `inspect.getdoc()`, and pipes the formatted text through the system's terminal pager (such as `less`).

---

← [PEP 257 and docstring formats](01-pep-257-and-major-docstring-formats.md) · [Topic index](README.md) · Next → **Annotations at runtime** *(not written yet)*
