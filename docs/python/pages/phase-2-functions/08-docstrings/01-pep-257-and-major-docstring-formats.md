---
title: "Docstring semantics: PEP 257 standards, bytecode retention, and formatting styles"
sidebar_label: "01 · PEP 257 and docstring formats"
sidebar_position: 80
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Language Reference (§3.2 Callable types), PEP 257 (Docstring Conventions).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**A docstring is a string literal positioned as the first statement in a module, class, method, or function. Unlike comments, which the tokenizer discards immediately, docstrings are compiled into the code object and attached to the object's `__doc__` attribute at runtime. PEP 257 governs docstring conventions, mandating triple double-quotes `"""`, imperative mood summary lines ("Calculate checksum", not "Calculates checksum"), and dedicated closing quote lines. In modern engineering, teams standardize on three primary formats: Google style (highly readable in plain text), NumPy style (underlined headers standard in scientific Python), and Sphinx/reST (directive-heavy markup for doc generation). However, executing Python with the `-OO` optimization flag strips docstrings from bytecode entirely, resetting `__doc__` to `None`.**

## Compiler mechanics and runtime retention

Python attaches string literals appearing as the first statement of a callable directly to `__doc__`:

```python
def calculate_tax(subtotal: float, rate: float = 0.08) -> float:
    """Calculate the total sales tax for a given transaction amount."""
    return subtotal * rate

# The docstring is retained in memory as an attribute:
print(calculate_tax.__doc__)
# 'Calculate the total sales tax for a given transaction amount.'
```

### Comments versus Docstrings

- **Comments (`# ...`)** exist solely in raw source code. The Python tokenizer discards them during compilation; they consume zero memory and do not exist at runtime.
- **Docstrings** are expressions compiled into the callable's bytecode object (`co_consts`). They are accessible to reflection tools, IDE tooltips, and interactive help sessions.

### The `-OO` bytecode optimization hazard

When CPython is launched with the `-OO` flag (`python -OO script.py`):
1. Python strips all docstrings from `.pyc` bytecode files to reduce memory footprint.
2. `callable.__doc__` evaluates to `None`.
3. If an application framework (such as Click, Typer, or FastAPI) relies on `__doc__` to construct CLI help screens or OpenAPI schema descriptions, it will crash or display empty metadata.

## PEP 257 Core authoring conventions

PEP 257 defines standard structural rules:

### 1. One-line docstrings
Used for simple functions with obvious signatures:
- Always use `"""triple double quotes"""`.
- Closing quotes reside on the **same line** as the opening quotes.
- Use **imperative mood** ("Return path", not "Returns path" or "Returning path").
- End with a period.

```python
def is_healthy() -> bool:
    """Return True if all upstream database connections are active."""
    return True
```

### 2. Multi-line docstrings
Used for complex business logic:
- First line is an imperative summary sentence.
- A single blank line separates the summary from the description.
- Closing quotes sit on their **own line** at the same indentation level as the opening quotes.

```python
def process_payment(amount: int, currency: str) -> bool:
    """Process a captured payment transaction through the payment gateway.

    Coordinates with the Stripe backend, verifies merchant ledger balance,
    and records an audit trail event in PostgreSQL.
    """
    ...
```

## Major formatting styles compared

Production codebases typically standardize on one of three styles:

### 1. Google style (Recommended for backend services)
Favored for readability in plain text without requiring HTML/Sphinx rendering:

```python
def execute_query(query: str, timeout: int = 30) -> list[dict]:
    """Execute a parameterized SQL query against the read replica.

    Args:
        query: Valid SQL query string with bind parameters.
        timeout: Maximum seconds to wait before canceling execution.

    Returns:
        A list of row dictionaries mapping column names to values.

    Raises:
        DatabaseConnectionError: If replica is unreachable.
        QueryTimeoutError: If execution exceeds timeout seconds.
    """
    ...
```

### 2. NumPy style (Standard in Data Science)
Uses dashes under section headers, maximizing visual separation:

```python
def compute_matrix_norm(matrix: list[list[float]]) -> float:
    """Compute the Frobenius norm of a 2D matrix.

    Parameters
    ----------
    matrix : list of list of float
        The input matrix to evaluate.

    Returns
    -------
    float
        The calculated Frobenius norm.
    """
    ...
```

### 3. Sphinx / reStructuredText style (Legacy standard)
Uses field tags parsed natively by Sphinx:

```python
def render_template(template_name: str, context: dict) -> str:
    """Render an HTML template with dynamic context.

    :param template_name: Name of the Jinja template file.
    :type template_name: str
    :param context: Key-value dictionary passed to renderer.
    :returns: Rendered HTML document string.
    :rtype: str
    """
    ...
```

## Gotchas

### Accidental pre-docstring statement
**Symptom.** `func.__doc__` returns `None` even though a docstring was written.
**Cause.** A statement (such as a variable assignment or debug log) was placed before the string literal. Python only recognizes a string literal as a docstring if it is the absolute first statement in the block.
**Fix.** Ensure the triple-quoted string is the very first line inside the `def` block.

```python
# BROKEN: logger call precedes docstring
def fetch_user(user_id: int):
    logger.debug("Entering fetch_user")
    """Fetch user record from database."""  # Ignored by compiler!

# FIXED: docstring is statement 1
def fetch_user(user_id: int):
    """Fetch user record from database."""
    logger.debug("Entering fetch_user")
```

### Descriptive instead of imperative mood
**Symptom.** Code review linter warnings (e.g. `pydocstyle` / `flake8-docstrings` error D401).
**Cause.** Writing "Returns the user status" instead of "Return the user status".
**Fix.** Phrase summary lines as commands: "Validate payload", "Format timestamp", "Create socket".

## Interview questions

**★ Q: What distinguishes a docstring from a regular comment at the compiler level?**
Comments (`#`) are stripped during lexical tokenization and discarded; they do not exist in bytecode or runtime memory. Docstrings are string literals positioned as the first statement in a scope; the compiler compiles them into the code object's constants table and binds them to the object's `__doc__` attribute, making them accessible at runtime.

**★ Q: What happens to function docstrings when Python is executed with the `-OO` command-line flag?**
CPython's `-OO` flag optimizes bytecode generation by removing both assertions and all docstrings from `.pyc` files. At runtime, every object's `__doc__` attribute evaluates to `None`. Applications or CLI tools that introspect `__doc__` dynamically will fail or produce empty documentation.

**★ Q: What are the primary structural differences between Google style and NumPy style docstrings?**
Google style structures sections with simple colon-suffixed headings (`Args:`, `Returns:`, `Raises:`) and indented argument descriptions, optimizing for plain-text readability in editors. NumPy style uses title-case headings underlined by hyphens (`Parameters\n----------`) with data types specified after colons on the parameter line, optimizing for scientific reference documentation.

**Q: What is the PEP 257 convention regarding the grammatical mood of the summary line?**
PEP 257 prescribes the **imperative mood** for the summary line (e.g., "Do this", "Return that") rather than descriptive mood ("Does this") or past tense. It should read as a command completing the sentence: "This function will [summary line]".

**Q: Why must closing quotes in multi-line docstrings sit on their own line according to PEP 257?**
Placing the closing `"""` on its own line visually demarcates the boundary of the docstring from the implementation code below it, matches the indentation level of the opening `def` statement, and prevents trailing text from being accidentally merged into the documentation block.

---

← [Topic index](README.md) · Next → [help, getdoc, and doctest](02-help-inspect-getdoc-and-doctest.md)
