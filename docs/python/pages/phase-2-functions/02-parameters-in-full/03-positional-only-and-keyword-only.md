---
title: "Positional-only and keyword-only parameters: controlling call-site syntax and preventing collisions"
sidebar_label: "03 · Positional-only and keyword-only"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§8.6 Function definitions, §6.3.4 Calls),
> PEP 570 (Python Positional-Only Parameters), PEP 3102 (Keyword-Only Arguments).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Python provides two syntactic boundary markers to control how arguments are supplied at call sites: `/` designates all preceding parameters as positional-only (PEP 570), and `*` designates all subsequent parameters as keyword-only (PEP 3102). Keyword-only parameters eradicate "boolean blindness" by forcing callers to write explicit parameter names for flags and options (`query(sql, timeout=30, read_only=True)`). Positional-only parameters decouple public API contracts from internal parameter names and solve the critical keyword collision bug where incoming `**kwargs` share names with explicit parameters.**

## Keyword-only parameters (`*` and PEP 3102)

Any parameter defined after a bare `*` or after `*args` cannot be provided positionally; callers must specify it by name:

```python
def configure_cache(host: str, port: int, *, max_size: int = 1000, ttl: int = 3600) -> dict:
    return {"host": host, "port": port, "max_size": max_size, "ttl": ttl}

# VALID
configure_cache("localhost", 6379, max_size=5000)

# INVALID: TypeError: configure_cache() takes 2 positional arguments but 3 were given
# configure_cache("localhost", 6379, 5000)
```

### Eliminating boolean blindness

Boolean parameters passed positionally obscure caller intent:

```python
# POOR DESIGN: what do True and False mean?
set_user_status(user_id, True, False, True)

# EXCELLENT DESIGN: enforced via keyword-only parameters
def set_user_status(
    user_id: int,
    *,
    is_active: bool,
    send_notification: bool = False,
    audit_log: bool = True,
) -> None:
    ...

# Call site is self-documenting and unambiguous:
set_user_status(user_id, is_active=True, send_notification=False, audit_log=True)
```

### Mandatory keyword-only arguments

Keyword-only parameters do not require default values. Omission of a default creates a mandatory keyword argument:

```python
def execute_transaction(amount: float, *, authorization_token: str) -> None:
    ...

# execute_transaction(100.0)
# TypeError: execute_transaction() missing 1 required keyword-only argument: 'authorization_token'
```

## Positional-only parameters (`/` and PEP 570)

Introduced in Python 3.8, the `/` marker specifies that all parameters to its left cannot be passed using keyword syntax:

```python
def calculate_vat(subtotal: float, tax_rate: float, /, currency: str = "USD") -> float:
    return subtotal * tax_rate

# VALID
calculate_vat(100.0, 0.20)
calculate_vat(100.0, 0.20, currency="EUR")
calculate_vat(100.0, 0.20, "EUR")

# INVALID: TypeError: calculate_vat() got some positional-only arguments passed as keyword arguments: 'subtotal, tax_rate'
# calculate_vat(subtotal=100.0, tax_rate=0.20)
```

### The two architectural reasons for positional-only parameters

1. **Freedom to rename implementation parameters:**
   If a library defines `def parse_json(s):`, callers might write `parse_json(s=raw_data)`. If the library author later renames `s` to `text` or `document`, all such callers break. Marking `s` as positional-only (`def parse_json(s, /):`) allows renaming without breaking backward compatibility.
2. **Preventing collisions with `**kwargs`:**
   Consider a formatting function that accepts a template string and arbitrary replacement values via `**kwargs`:

   ```python
   # BROKEN: without '/'
   def format_message(template: str, **kwargs: str) -> str:
       return template.format(**kwargs)

   # If kwargs happens to contain a key named 'template':
   # format_message("Hello {name}, your template is {template}", name="Alice", template="standard")
   # TypeError: format_message() got multiple values for keyword argument 'template'
   ```

   Because `template` is a positional-or-keyword parameter, Python encounters two definitions for `template`. Fixing this requires `/`:

   ```python
   # FIXED: with '/'
   def format_message(template: str, /, **kwargs: str) -> str:
       return template.format(**kwargs)

   # Now template is consumed positionally, allowing kwargs to safely contain 'template'!
   format_message("Hello {name}, template={template}", name="Alice", template="standard")
   ```

## The complete unified parameter grammar

Python allows combining all parameter forms in a single function signature, following a strict grammar order:

```python
def full_spec(
    pos_only_1: int,
    pos_only_2: int,
    /,
    pos_or_kw_1: str,
    pos_or_kw_2: str = "default",
    *var_args: int,
    kw_only_1: bool,
    kw_only_2: str = "fallback",
    **var_kwargs: str,
) -> None:
    ...
```

The progression across the parameter list is:
1. `Positional-only` (terminated by `/`)
2. `Positional-or-keyword` (standard parameters)
3. `Var-positional` (`*args`) or bare `*`
4. `Keyword-only` (parameters after `*` or `*args`)
5. `Var-keyword` (`**kwargs`)

### Combining `/` and `*` without variadics

APIs frequently require parameters that are strictly positional for primary targets, combined with options that are strictly keyword-only:

```python
def write_payload(
    payload: bytes,
    destination: str,
    /,
    *,
    timeout: float = 5.0,
    compression: bool = True,
) -> int:
    """payload and destination must be positional; options must be named."""
    ...
```

## Gotchas

### Passing keyword syntax to positional-only built-ins
**Symptom.** Built-in functions like `len()`, `min()`, or `math.sin()` fail with `TypeError: len() takes no keyword arguments`.
**Cause.** Many CPython built-ins use positional-only arguments for performance.
**Fix.** Pass arguments positionally:

```python
# BROKEN
# size = len(obj=[1, 2, 3])

# FIXED
size = len([1, 2, 3])
```

### Multiple `/` or `*` markers in signature
**Symptom.** Code fails to parse with `SyntaxError: invalid syntax` or `SyntaxError: duplicate * in function definition`.
**Cause.** A signature can contain at most one `/` and at most one `*` (or `*args`).
**Fix.** Group all positional-only parameters together before a single `/`, and group all keyword-only parameters after a single `*`:

```python
# BROKEN: multiple slashes
# def bad(a, /, b, /, c): ...

# FIXED: single slash delineating all positional-only parameters
def good(a, b, /, c):
    ...
```

### Default argument placement around `/`
**Symptom.** `SyntaxError: non-default argument follows default argument`.
**Cause.** If a positional-only parameter has a default, all subsequent positional-only parameters and positional-or-keyword parameters before `*` must also have defaults.
**Fix.** Ensure non-default parameters precede default parameters within each positional tier:

```python
# BROKEN: b has default, but c does not
# def broken(a, b=1, /, c): ...

# FIXED: defaults placed at the right of positional-or-keyword segment
def fixed(a, /, b=1, c=2):
    ...
```

## Interview questions

**★ Q: What is the purpose of the `/` and `*` markers in a Python function signature?**
The `/` marker specifies that all parameters preceding it are **positional-only** (cannot be passed by name). The `*` marker specifies that all parameters following it are **keyword-only** (cannot be passed by position). Parameters between `/` and `*` are **positional-or-keyword** (callable either way).

**★ Q: How do positional-only parameters (`/`) prevent collisions with `**kwargs`?**
When a parameter is positional-or-keyword, passing an argument positionally while also supplying a key of the same name in `**kwargs` raises `TypeError: got multiple values for keyword argument`. Marking the parameter as positional-only with `/` informs Python's argument binder that the parameter name cannot be targeted by keyword. Consequently, any matching key in `**kwargs` is cleanly routed into the variadic dictionary without colliding.

**★ Q: What is "boolean blindness", and how do keyword-only parameters solve it?**
"Boolean blindness" occurs when a function invocation passes bare boolean literals (`do_work(item, True, False, True)`), making it impossible for a reader or reviewer to understand what each flag controls without consulting the function definition. Enforcing keyword-only parameters (`def do_work(item, *, validate: bool, retry: bool, async_run: bool)`) forces callers to name each flag explicitly (`do_work(item, validate=True, retry=False, async_run=True)`).

**Q: Can a keyword-only parameter be mandatory (without a default value)?**
Yes. Any parameter declared after `*` or `*args` that does not declare an `= default` value is a mandatory keyword-only argument. If the caller does not supply that argument by name, Python raises `TypeError: func() missing required keyword-only argument`.

**Q: What is the canonical order of parameters in Python's grammar?**
The formal order is:
1. Positional-only parameters (e.g. `a, b`)
2. The `/` separator
3. Positional-or-keyword parameters (e.g. `c, d=1`)
4. Var-positional parameter `*args` or bare `*` separator
5. Keyword-only parameters (e.g. `e, f=2`)
6. Var-keyword parameter `**kwargs`

---

← [Variadic args and kwargs](02-variadic-args-and-kwargs.md) · [Topic index](README.md) · Next → [Signature design and evolution](04-signature-design-and-evolution.md)
