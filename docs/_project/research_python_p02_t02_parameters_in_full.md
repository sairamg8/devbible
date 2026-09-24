---
name: research-python-p02-t02-parameters-in-full
description: Banked Research: Python Phase 2 · Topic 02 — Parameters in full
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 02 — Parameters in full

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §6.3.4 Calls),
> PEP 3102 (Keyword-Only Arguments), PEP 570 (Python Positional-Only Parameters),
> and Python 3.14 Library Reference (inspect module).
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### Python 3.14 Language Reference §8.6 — Default parameter values
URL: https://docs.python.org/3.14/reference/compound_stmts.html#function-definitions
- *"Default parameter values are evaluated from left to right when the function definition is executed. This means that the expression is evaluated once, when the function is defined, and that the same “pre-computed” value is used for each call. This is especially important to understand when a default parameter value is a mutable object, such as a list or a dictionary: if the function modifies the object (e.g. by appending an item to a list), the default parameter value is in effect modified."*
- *"This is generally not what was intended. A way around this is to use `None` as the default, and explicitly test for it in the body of the function"*

### Function Attributes for Defaults
- `__defaults__`: *"A tuple containing default argument values for those arguments that have defaults, or `None` if no arguments have a default."*
- `__kwdefaults__`: *"A dict containing defaults for keyword-only parameters, or `None` if no keyword-only arguments have a default."*

### Grammar of Parameter List (Python 3.8+ / PEP 570 & PEP 3102)
- Grammar:
  `def f(pos1, pos2, /, pos_or_kwd, *, kwd1, kwd2): ...`
  `def f(pos1, /, *args, kwd1, **kwargs): ...`
- The `/` token marks all parameters to its left as **positional-only**.
- The `*` token marks all parameters to its right (up to `**kwargs`) as **keyword-only**.
- If `*args` is present, parameters following it are keyword-only without needing a bare `*`.

### PEP 570 — Python Positional-Only Parameters
URL: https://peps.python.org/pep-0570/
- *"Positional-only parameters give more control in library design. They allow authors to change parameter names without breaking callers, prevent keyword arguments from colliding with `**kwargs`, and enforce concise call-site syntax."*
- Keyword collision prevention:
  ```python
  def format_data(name, /, **options):
      # options may contain "name" without causing TypeError
      return f"{name}: {options.get('name')}"
  ```
  Without `/`, `format_data("Alice", name="Bob")` raises `TypeError: format_data() got multiple values for keyword argument 'name'`.

### PEP 3102 — Keyword-Only Arguments
URL: https://peps.python.org/pep-3102/
- *"Keyword-only arguments are often used to specify options or flags, especially when a function has a large number of parameters with default values."*
- Prevents "boolean blindness" at the call site: e.g. `query(sql, True, False, True)` vs `query(sql, readonly=True, cache=False, paginate=True)`.

### inspect Module (§Standard Library)
URL: https://docs.python.org/3.14/library/inspect.html#inspect.Parameter
- `inspect.Parameter.kind` enum:
  - `POSITIONAL_ONLY`
  - `POSITIONAL_OR_KEYWORD`
  - `VAR_POSITIONAL` (`*args`)
  - `KEYWORD_ONLY`
  - `VAR_KEYWORD` (`**kwargs`)
- `inspect.Signature.bind(*args, **kwargs)` binds arguments to parameters according to the signature rules, raising `TypeError` on mismatch.

---

## 2. Key Insights & Architecture

1. **Default Evaluation Timing**:
   Defaults are evaluated at definition time in the scope enclosing the function definition.
   `__defaults__` is stored directly on the function object. It is NOT copied or re-evaluated per call.
2. **Sentinel Pattern**:
   When `None` is a valid input value distinct from "argument omitted", a unique private sentinel object is required:
   ```python
   _MISSING = object()
   def get_val(key, default=_MISSING):
       if default is _MISSING:
           ...
   ```
3. **Keyword Collision with `**kwargs`**:
   Before PEP 570, any named parameter collided with a dict passed via `**kwargs` that happened to contain the same key name. Positional-only parameters (`/`) solve this completely.
4. **Signature Evolution Contract**:
   When evolving a public API:
   - Adding a parameter as positional breaks callers who passed arguments positionally.
   - Adding a parameter as positional-or-keyword at the end with a default is safe unless callers pass `**kwargs` with colliding keys.
   - Adding a parameter as keyword-only (`*, new_arg=default`) is the safest evolutionary step: it cannot break positional callers and forces explicit naming.
