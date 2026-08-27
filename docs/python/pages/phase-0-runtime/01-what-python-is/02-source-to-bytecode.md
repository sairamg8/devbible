---
title: "Source to bytecode: the compile step you didn't know you were running, and why a syntax error kills line 1"
sidebar_label: "2 · Source to bytecode"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14 docs for
> [`compile`](https://docs.python.org/3.14/library/functions.html#compile),
> [`dis` — Disassembler for Python bytecode](https://docs.python.org/3.14/library/dis.html),
> [the `ast` module](https://docs.python.org/3.14/library/ast.html),
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> (keyword-typo suggestions), and
> [1. Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`-O`, `-OO`).
> Version spine: **Python 3.14.7**.

**Before CPython executes a single line of your program it compiles the entire
file. Source text becomes tokens, tokens become an abstract syntax tree, the
tree becomes a `code` object holding a flat array of bytecode instructions —
and only then does anything run. Two consequences follow immediately and
explain a large fraction of beginner confusion: a syntax error anywhere in the
file prevents the whole file from running, and a name that does not exist
compiles perfectly happily, because the compiler checks grammar and never
checks whether names resolve.**

## The four phases, named

```text
source text  --tokenise-->  tokens
tokens       --parse----->  abstract syntax tree   (SyntaxError happens here)
AST          --compile--->  code object / bytecode (SyntaxError can also happen here)
code object  --execute--->  the eval loop          (every other exception happens here)
```

You can stand at each boundary from Python itself, which is the fastest way to
build a mental model that sticks:

```python
import ast, dis

src = "total = price * qty\nprint(total)\n"

print(ast.dump(ast.parse(src), indent=2))   # phase 2: the tree
code = compile(src, "<demo>", "exec")       # phase 3: a code object
dis.dis(code)                                # phase 3: the instructions
exec(code, {"price": 2, "qty": 3})           # phase 4: run it
```

`compile()` is the compiler, exposed. `dis.dis()` is the disassembler.
`exec()` is the eval loop. Everything `python app.py` does, you can do by hand
in four lines — that is how thin the machinery is, and it is worth typing once
so that "Python compiles" stops being a claim and becomes something you have
watched happen.

## What a code object holds

The compiler's output is not a file, it is an object. A function's code object
lives on `__code__`:

```python
def total(price, qty, discount=0):
    return price * qty - discount

c = total.__code__
c.co_name          # 'total'
c.co_varnames      # ('price', 'qty', 'discount') — locals, resolved at compile time
c.co_consts        # constants collected at compile time
c.co_names         # global and attribute names, looked up at RUN time
c.co_code          # the raw bytecode, as bytes
c.co_filename, c.co_firstlineno   # what makes tracebacks readable
```

The split between `co_varnames` and `co_names` is the load-bearing detail.
**Local variables are resolved to array slots at compile time** — the compiler
decides "this function has three locals" and emits `LOAD_FAST 0`, an indexed
array read. **Globals and attributes are resolved by name at run time** via a
dictionary lookup (`LOAD_GLOBAL`, `LOAD_ATTR`). That single design choice
explains three separate things people learn as unrelated folklore: local
variable access is faster than global access; assigning to a name anywhere in a
function makes it local *everywhere* in that function; and `UnboundLocalError`
is a distinct exception from `NameError` because the compiler already knew the
name was a local, it just had no value in the slot yet.

Nested functions, comprehensions and class bodies get their own code objects,
stored inside the outer one's `co_consts`. There is no separate file per class
— unlike Java, one `.py` file compiles to exactly one top-level code object
with the rest nested inside it.

## What the compiler does and does not optimise

CPython's compiler is deliberately modest. It does constant folding (`60 * 60
* 24` is stored as `86400`), it merges adjacent string literals, it collapses
some trivially dead code, and since 3.12 it inlines comprehensions into the
enclosing frame. That is close to the whole list.

What it does **not** do is anything that requires knowing types: no inlining of
your functions, no loop unrolling, no escape analysis, no devirtualisation. It
cannot, because in Python any name can be rebound to anything at any moment —
`len` could be a different callable on the next line. All type-dependent
optimisation therefore has to happen at run time, where the actual types are
observable. That is the subject of
[the interpreter loop](05-the-interpreter-loop.md), and it is why "how do I get
the Python compiler to optimise harder?" is a question with no answer.

The practical rule: **do not contort source for the compiler's benefit.** The
things that actually help — hoisting an attribute lookup out of a hot loop,
choosing the right data structure, not doing the work at all — help because
they remove instructions, not because they please an optimiser.

## Syntax errors happen before anything runs

This is the most useful practical consequence of the compile step:

```python
print("starting")          # never printed
def broken(:                # SyntaxError, at compile time
    pass
```

The `print` on line 1 does not execute. The file is parsed in its entirety
first, so a malformed function definition on line 400 prevents line 1 from
running. Beginners read this as "Python skipped my print statement"; what
actually happened is that the program never started.

Contrast with a name that does not exist:

```python
print("starting")          # this DOES print
print(undefined_name)      # raises NameError, at run time
```

`undefined_name` compiles without complaint — the compiler emits a
`LOAD_GLOBAL` for it and moves on. Only when the eval loop reaches that
instruction and fails to find the name in globals or builtins do you get a
`NameError`. **The compiler checks grammar, not meaning.** This is why Python
cannot catch identifier typos before running, why "it crashed after running for
an hour" is a normal sentence in Python operations, and why linters (`ruff`)
and type checkers (`mypy`, `pyright`) exist as a separate industry rather than
as compiler flags.

Since 3.14 the parser also guesses at keyword typos — a mistyped `while`
produces a `SyntaxError` whose message suggests the intended keyword. Still a
compile-time failure, just a friendlier one.

### The diagnostic question

When something goes wrong, ask: **did *any* of my output appear?**

- No output at all, and the traceback's last frame has no function name →
  compile-time. Syntax, indentation, or an encoding problem. Nothing ran.
- Some output, then a traceback with a call stack → run-time. Your code ran and
  hit a value it did not expect.

`IndentationError` and `TabError` are subclasses of `SyntaxError` and belong in
the first bucket. `ImportError` is in the second: imports execute.

## `-O` and `-OO` change the bytecode, and that is the trap

Two flags actually alter what the compiler emits:

| Flag | Effect on the compiled bytecode |
|---|---|
| `-O` (or `PYTHONOPTIMIZE=1`) | `__debug__` becomes `False`; every `assert` statement and every block under `if __debug__:` is removed entirely |
| `-OO` (or `PYTHONOPTIMIZE=2`) | `-O` plus: all docstrings are discarded |

Neither is a speed feature worth chasing — the win is a smaller code object,
not a faster loop. What they are is a footgun:

- `-O` removing `assert` is the reason **assertions must never enforce
  security or business invariants.** An `assert user.is_admin` is a no-op in a
  `-O` deployment. Raise a real exception instead.
- `-OO` discarding docstrings breaks `doctest`, `help()`, and any library that
  reads `__doc__` at import time — which is more of them than you would guess,
  including some CLI frameworks that build `--help` text from docstrings.

Both levels also change the *filename* of the cached bytecode (PEP 488 appends
`.opt-1` / `.opt-2`), which is covered in
[the next chunk](03-pycache.md).

## Gotchas

**Symptom:** a `print()` at the top of the file produces no output, and the traceback points at a line far below it
**Cause:** a `SyntaxError`. Compilation covers the whole file, so nothing at all executed
**Fix:** read the error's line number, not the top of the file. Use the "did any output appear?" test to classify compile-time versus run-time failures instantly

**Symptom:** a typo in a rarely-taken branch survives code review, tests, and a deploy, then fires at 3am as `NameError`
**Cause:** the compiler emits `LOAD_GLOBAL` for any name at all; nothing verifies the name exists until that instruction executes
**Fix:** this is the structural gap linters fill. Run `ruff` in CI (it flags undefined names) and get branch coverage on error paths — the untested branch is the one with the typo

**Symptom:** `UnboundLocalError: cannot access local variable 'total' where it is not associated with a value`, on a name that clearly exists as a global
**Cause:** the function assigns `total` somewhere — even on a later line, even inside an `if` that did not run. The compiler saw the assignment and marked the name local for the entire function, so the earlier read looks in the local slot and finds it empty
**Fix:** either don't shadow the global, or declare `global total` if you genuinely mean to rebind it. The compile-time nature of the decision is why moving the assignment later does not help

**Symptom:** an application's validation silently stops working after a deployment change nobody associates with it
**Cause:** the process now runs with `-O` or `PYTHONOPTIMIZE=1`, and the validation was written with `assert`
**Fix:** `assert` is for internal invariants during development. For anything that must hold in production: `if not user.is_active: raise PermissionError(...)`. Audit for `assert` in request paths before ever enabling `-O`

**Symptom:** `help(obj)` returns nothing useful and a CLI's `--help` output is empty after a deploy
**Cause:** `-OO` stripped every docstring from the compiled bytecode
**Fix:** drop `-OO`. The disk saving is not worth losing runtime introspection, and the failure mode is silent

**Symptom:** micro-optimised source (manual loop unrolling, hoisting constants into locals "for the compiler") makes no measurable difference
**Cause:** CPython's compiler does constant folding and little else; the optimisations that matter happen at run time in the specialising interpreter, which you cannot address from source
**Fix:** measure before optimising. The genuine source-level wins are algorithmic or remove attribute lookups from hot loops — not compiler hints, which Python has none of

**Symptom:** a comprehension's variable no longer leaks into an enclosing scope, or a stack trace shows fewer frames than expected on 3.12+
**Cause:** comprehension inlining — the compiler stopped creating a separate function frame per comprehension
**Fix:** nothing to fix; it is faster and the scoping rules are unchanged. Just don't be surprised when profiler output looks different across the 3.11 → 3.12 boundary

## Interview questions

**★ Explain the difference between a `SyntaxError` and a `NameError` in terms of when they happen.**
A `SyntaxError` is raised during compilation, before any of the file runs — so
a bad line at the bottom of a file prevents the first line from executing. A
`NameError` is raised during execution, when the eval loop reaches a
`LOAD_GLOBAL` instruction and cannot find that name in globals or builtins.
The compiler validates grammar, not meaning: it happily emits code for a name
that has never been defined anywhere. That gap is exactly what linters and type
checkers fill, and it is why Python needs them more than a statically compiled
language does.

**★ What is a code object, and what is the difference between `co_varnames` and `co_names`?**
A code object is the compiler's output: bytecode plus the metadata needed to
run it — constants, names, argument counts, and the filename and line table
used to build tracebacks. `co_varnames` holds local variables, which the
compiler assigns fixed slots so the bytecode can use indexed access
(`LOAD_FAST`). `co_names` holds globals and attribute names, which are looked
up by string in a dictionary at run time (`LOAD_GLOBAL`, `LOAD_ATTR`). That
difference is why locals are faster than globals, and why Python decides
local-versus-global at compile time based purely on whether the function ever
assigns the name.

**★ Why does assigning to a variable at the end of a function break a read of the same name at the top?**
Because scope is decided at compile time, not at execution time. When the
compiler sees any assignment to a name inside a function body, it classifies
that name as local for the *entire* body and emits `LOAD_FAST` for every read.
The read at the top then looks in a local slot that has not been filled yet,
producing `UnboundLocalError` rather than falling back to the global. Use
`global` or `nonlocal` to change the classification, or pick a different name.

**★ What does CPython's compiler optimise?**
Very little, deliberately: constant folding, adjacent string literal merging,
some trivial dead code elimination, and since 3.12 inlining comprehensions into
the enclosing frame. It cannot do type-dependent work — inlining, unrolling,
devirtualisation — because any name can be rebound at any moment, so the
compiler cannot know what `len` or `self.process` will be when the line runs.
All of that is deferred to run time, where the specialising interpreter can
observe the actual types. This is why source-level "help the compiler" tricks
are wasted effort in Python.

**What exactly does `-O` do, and why is it dangerous?**
It sets `__debug__` to `False` and removes every `assert` statement and every
block guarded by `if __debug__:` from the compiled bytecode. It is dangerous
because any invariant expressed as an assertion silently vanishes — so
authentication checks, input validation and safety guards written as `assert`
become no-ops. `-OO` additionally discards all docstrings, breaking `doctest`,
`help()`, and libraries that introspect `__doc__`. Neither flag is a
performance feature; the benefit is a slightly smaller code object.

**How would you see the bytecode for a single line of code?**
`import dis; dis.dis(func)` for a function, or `dis.dis("a + b")` for a
snippet, or `python -m dis file.py` for a whole module. It is the definitive
way to settle arguments about what a construct actually costs — whether a
comprehension really builds an intermediate list, what `a, b = b, a` compiles
to, or how many dictionary lookups an attribute chain performs.

**Is there any way to get a `NameError` at compile time?**
Not from CPython itself — the compiler never resolves names. You get it from
external tooling: `ruff` (rule F821, undefined name), `pyflakes`, or a type
checker like `mypy` or `pyright`. Running one of those in CI is the closest
Python gets to a compile-time name check, and treating its output as
build-breaking is the practical answer.

---

← Prev: [The language vs its implementations](01-language-vs-implementation.md) · Index: [What Python is](README.md) · Next → [`__pycache__`](03-pycache.md)
