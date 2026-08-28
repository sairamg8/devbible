---
title: "A syntax error is a three-level hierarchy raised before your program exists, and 3.14 turned a great many of them from `invalid syntax` into a named cause"
sidebar_label: "1g · Syntax errors and 3.14's messages"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [built-in exceptions](https://docs.python.org/3.14/library/exceptions.html)
> reference, [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html),
> [PEP 758](https://peps.python.org/pep-0758/), and CPython 3.14's
> [`Parser/pegen_errors.c`](https://github.com/python/cpython/blob/3.14/Parser/pegen_errors.c)
> and [`Grammar/python.gram`](https://github.com/python/cpython/blob/3.14/Grammar/python.gram).
> Target: **CPython 3.14**.

**`TabError` is an `IndentationError` is a `SyntaxError`, and every one of them is
raised while source is being turned into code objects — which means a running
program can only observe one at a compilation boundary: an `import`, a `compile()`,
an `exec()`, or the prompt. Anything that loads user-supplied Python needs that
hierarchy right, because a single `except SyntaxError` collapses three distinct
failures into one unhelpful message. 3.14 is the release that made those messages
worth surfacing verbatim.**

## `SyntaxError` → `IndentationError` → `TabError`

The hierarchy, from the built-in exceptions reference:

```text
Exception
 └── SyntaxError
      └── IndentationError
           └── TabError
```

> *"`SyntaxError` — Raised when the parser encounters a syntax error. This may occur
> in an `import` statement, in a call to the built-in functions `compile()`,
> `exec()`, or `eval()`, or when reading the initial script or standard input (also
> interactively)."*

> *"`IndentationError` — Base class for syntax errors related to incorrect
> indentation. This is a subclass of `SyntaxError`."*

> *"`TabError` — Raised when indentation contains an inconsistent use of tabs and
> spaces. This is a subclass of `IndentationError`."*

That list of *where* it can be raised is the operational content: those are the only
places a running program can observe one. Everything else has already failed to
compile.

The instance carries structured location data, not just a message —
`filename`, `lineno`, `offset`, `text`, `end_lineno`, `end_offset` and `msg`, all
1-indexed for lines and columns. A tool that reports user-supplied Python (a notebook
kernel, a rules engine, a plugin loader) should read those rather than parse the
string:

```python
def load_rule(path):
    src = path.read_text(encoding="utf-8")
    try:
        return compile(src, str(path), "exec")
    except TabError as exc:
        raise RuleError(f"{path}:{exc.lineno}: mixed tabs and spaces") from exc
    except IndentationError as exc:
        raise RuleError(f"{path}:{exc.lineno}:{exc.offset}: {exc.msg}") from exc
    except SyntaxError as exc:
        raise RuleError(f"{path}:{exc.lineno}:{exc.offset}: {exc.msg}") from exc
```

Order matters: the most specific handler must come first, because every `TabError`
*is* an `IndentationError` *is* a `SyntaxError`.

The messages CPython attaches, taken from `Parser/pegen_errors.c` and
`Grammar/python.gram`:

| Situation | Exception | Message |
|---|---|---|
| Tabs/spaces ambiguity | `TabError` | `inconsistent use of tabs and spaces in indentation` |
| Dedent to an unknown column | `IndentationError` | `unindent does not match any outer indentation level` |
| Body missing after a header | `IndentationError` | `expected an indented block after 'if' statement on line N` |
| Unexpected extra indent | `IndentationError` | `unexpected indent` |
| Over 100 levels deep | `IndentationError` | `too many levels of indentation` |
| Space after a `\` | `SyntaxError` | `unexpected character after line continuation character` |
| Bracket never closed | `SyntaxError` | `'(' was never closed` |

## 3.14's improved error messages

The 3.14 release notes add several diagnostics that turn "invalid syntax" into a
named cause. Quoting the messages the What's New page gives:

- A keyword typo now suggests the keyword:
  `SyntaxError: invalid syntax. Did you mean 'while'?`
- An `elif` after an `else` block has its own message —
  *"`elif` statements that follow an `else` block now have a specific error
  message"*: `SyntaxError: 'elif' block follows an 'else' block`.
- A statement used where a conditional expression needs a value:
  `SyntaxError: expected expression after 'else', but statement is given`, and the
  mirror image `SyntaxError: expected expression before 'if', but statement is
  given`.
- A quote inside an unescaped string:
  `SyntaxError: invalid syntax. Is this intended to be part of the string?`
- Incompatible string prefixes: `SyntaxError: 'u' and 'b' prefixes are
  incompatible`.
- *"Improved error messages when using `as` with incompatible targets"* in
  `import ... as`, `from ... import ... as`, `except ... as` and `case ... as`.

3.14 also relaxes one piece of syntax. PEP 758:

> *"The `except` and `except*` expressions now allow brackets to be omitted when
> there are multiple exception types and the `as` clause is not used."*

```python
try:
    connect_to_server()
except TimeoutError, ConnectionRefusedError:      # 3.14+; needs parentheses before
    print('The network has ceased to be!')
```

The `as` clause still requires the parentheses, and PEP 758 gives the reason
directly:

> *"Some users have expressed that they would find it confusing not to require
> parentheses as it would be unclear what exactly is being assigned to the target
> since in other parts of the language multiple `as` clauses can be used in similar
> situations (like in imports and context managers)."*

## Gotchas

### Catching `SyntaxError` hides `IndentationError` and `TabError`

**Symptom.** A plugin loader reports "syntax error" for every failure, so nobody
finds the real one.
**Cause.** `TabError` and `IndentationError` are subclasses; a bare
`except SyntaxError` matches all three, and the first matching handler wins.
**Fix.** Order handlers most-specific first, or read `type(exc).__name__` and
`exc.msg` instead of writing your own text. Never catch bare `Exception` around a
`compile()` — you will swallow `KeyboardInterrupt`'s siblings and a genuine
`MemoryError` alike.

### A file that compiles is not a file that runs

**Symptom.** `python -m compileall` passes and the program still fails at import.
**Cause.** Everything in this topic is settled before execution. A `NameError`, a bad
import, a failed module-level side effect — none of it is syntax.
**Fix.** Treat `compileall` as a syntax gate only, and keep a smoke test that
actually imports every module.

```bash
python -m compileall -q src/                    # syntax gate
python -c "import pkgutil, importlib, mypkg; [importlib.import_module(m.name) for m in pkgutil.walk_packages(mypkg.__path__, 'mypkg.')]"
```

### The reported line is the line the parser gave up on, not always the line you got wrong

**Symptom.** `SyntaxError` on a `def` that is obviously correct.
**Cause.** The parser reports where it could no longer continue. With an unclosed
bracket or an unterminated string, that is downstream of the mistake, sometimes far.
**Fix.** Read `exc.lineno` as an upper bound and search backwards. 3.14 helps for the
common cases: `'(' was never closed` is located at the *opening* bracket, and the
string-quote diagnostic (`Is this intended to be part of the string?`) names the
cause instead of the symptom.


## Interview questions

**What is the relationship between `SyntaxError`, `IndentationError` and `TabError`?**
Strict subclassing: `TabError` extends `IndentationError` extends `SyntaxError`. So
`except SyntaxError` catches all three, and any handler chain must put the specific
ones first. All three carry `filename`, `lineno`, `offset`, `text`, `end_lineno`,
`end_offset` and `msg`, which is what tooling should read rather than the formatted
string.

**Why can you not catch a `SyntaxError` raised by the module you are writing it in?**
Because the module never runs. The exception is raised while the source is being
compiled, so the `try` block that would have caught it does not exist yet as
bytecode. You can only catch one across a compilation boundary — around `import`,
`importlib.import_module`, `compile()`, `exec()` or `eval()` — which is exactly the
list the exceptions reference gives for where a `SyntaxError` can occur.

**What does 3.14 give you that older releases did not, for diagnosing bad syntax?**
Named causes instead of `invalid syntax`: keyword-typo suggestions
(`Did you mean 'while'?`), a dedicated message for an `elif` following an `else`
block, `expected expression after 'else', but statement is given` for a statement in
a conditional expression, `Is this intended to be part of the string?` for a stray
quote, `'u' and 'b' prefixes are incompatible`, and better `as`-target errors for
`import`, `from ... import`, `except` and `case`. The structured attributes
(`lineno`, `offset`, `end_lineno`, `end_offset`) are what tooling should read; the
message text is for humans and is not a stable API.

**Name a syntax change that is new in 3.14.**
PEP 758 allows `except` and `except*` to omit the parentheses around multiple
exception types when no `as` clause is used, so `except TimeoutError,
ConnectionRefusedError:` is now valid. The `as` form still needs them — the PEP's
stated reason is that with an `as` target it would be unclear what is being assigned,
since `as` binds one name per clause elsewhere in the language (imports, context
managers).

---

← Prev: [Comments and encoding](01f-comments-and-encoding.md) · Index: [Syntax and indentation](README.md) · Next → [Soft keywords and the REPL](01h-soft-keywords-and-the-repl.md)
