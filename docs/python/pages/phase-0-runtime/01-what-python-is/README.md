---
title: "What Python is: a language, a reference implementation called CPython, and a compile step you were never told about"
sidebar_label: "01 · What Python is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14 Language Reference
> ([1. Introduction](https://docs.python.org/3.14/reference/introduction.html)),
> [`sys.implementation`](https://docs.python.org/3.14/library/sys.html#sys.implementation),
> the tutorial section
> [6.1.3 "Compiled" Python files](https://docs.python.org/3.14/tutorial/modules.html#compiled-python-files),
> and [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html).
> Version spine: **Python 3.14.7** (released 2026-08-05); 3.15 GA 2026-10-01.

**"Python is interpreted" is the single most misleading sentence in every
introductory course. Python is *compiled* — every time you run it. `python
app.py` first parses your source into an abstract syntax tree, compiles that
tree into bytecode for a stack machine, and only then hands the bytecode to a C
loop that executes it. That loop is CPython, the reference implementation, and
nearly everything people call "a Python behaviour" — reference counting, the
GIL, `__pycache__`, small-int caching — is a *CPython* behaviour that the
language definition never promised.**

Getting this distinction straight is what turns a class of confusing bugs into
predictable ones: why a typo on line 400 kills the program before line 1 runs,
why a directory named `__pycache__` appears next to your library files but not
next to the script you executed, why `is` sometimes agrees with `==` on small
integers and sometimes doesn't, and why "just switch to PyPy" is a real answer
in some situations and a disaster in others.

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The language vs its implementations](01-language-vs-implementation.md)** | What the language reference actually specifies, what CPython adds, and PyPy / GraalPy / Jython named honestly |
| 2 | **[Source to bytecode](02-source-to-bytecode.md)** | The compile step, code objects, why a syntax error kills line 1, and what `-O` deletes |
| 3 | **[`__pycache__`](03-pycache.md)** | Cache tags, why it never speeds up your code, and why the script you ran has none |
| 4 | **[Cache invalidation](04-cache-invalidation.md)** | mtime-and-size vs hash-based pycs (PEP 552), `compileall`, and the stale-cache incident |
| 5 | **[The interpreter loop](05-the-interpreter-loop.md)** | The stack machine, the dispatch tax, frames, reference counting and the cycle collector |
| 6 | **[Runtime optimisation](06-runtime-optimisation.md)** | The specialising adaptive interpreter (PEP 659), the tail-call build, and the experimental 3.14 JIT |

## The one-paragraph version, if you read nothing else

`python app.py` runs four phases. **Tokenise and parse** the whole file — a
syntax error anywhere aborts everything before a single statement executes.
**Compile** the AST to bytecode, a flat sequence of instructions for a stack
machine, wrapped in a *code object*. **Execute** that bytecode in the eval loop,
which since 3.11 rewrites hot instructions in place into specialised variants
(PEP 659). **Free** objects as their reference counts hit zero, with a cycle
collector mopping up what refcounting cannot. Steps 2 and 3 are where every
"why is Python slow?" answer lives, and step 1 is where every "why didn't my
print statement run?" answer lives.

## Why this is a Master topic

- It is the *shared substrate* for the next two topics. The GIL
  ([02](../02-the-gil/README.md)) is a lock around this interpreter's state.
  The import system — topic 08, [Imports](../08-imports/README.md) — is what fills
  `__pycache__`.
- It answers the questions juniors get asked and cannot answer: *"Is Python
  compiled or interpreted?"* has a precise, correct, three-sentence answer, and
  "interpreted" is not it.
- It is the difference between guessing at performance and reasoning about it.
  You cannot sensibly discuss `numpy`, Cython, or when to reach for another
  language until you know what the interpreter is actually doing per line.

## Phase gate contribution

After this topic you can narrate what happens between pressing Enter on `python
app.py` and the first line of output, name which of those steps the GIL sits
in, and say which parts are guaranteed by the language and which are CPython
implementation details you must not build on.

---

← Index: [Phase 0 — The runtime](../README.md) · Next → [The language vs its implementations](01-language-vs-implementation.md)
