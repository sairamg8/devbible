---
title: "Reading a disassembly: what `dis` shows you, what the columns mean, and the warning the module puts above everything else"
sidebar_label: "1 · Reading a disassembly"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-28 against the Python 3.14
> [`dis` module documentation](https://docs.python.org/3.14/library/dis.html) —
> the implementation-detail warning, the `myfunc` worked example and its output,
> the command-line interface and its flags (`-C` and `-O` added in 3.13, `-P`
> and `-S` added in 3.14), and the `dis.dis()` signature.
> Target: **CPython 3.14.7**.
> ⚠️ **Every disassembly listing on this page is quoted from that documentation.**
> Bytecode differs between versions and between machines; no output here was
> invented, and you should run `dis` yourself rather than trust a listing copied
> from anywhere — including this page.

**`dis` turns a function into the sequence of instructions CPython will actually
execute. It is the tool that converts arguments about "which of these is faster"
into observations, and it is the only honest way to see the compile-time effects
from topic [07](../07-everything-is-an-object/README.md) — constant folding,
constant merging, interning — rather than inferring them from `is` comparisons.
It is tiered *When Needed* for a reason: it answers a narrow class of question
extremely well and is the wrong tool for almost everything else.**

## The warning comes first, because it governs everything else

The module documentation puts this above its own contents, and it is not
boilerplate:

> *"**CPython implementation detail:** Bytecode is an implementation detail of
> the CPython interpreter. No guarantees are made that bytecode will not be
> added, removed, or changed between versions of Python. Use of this module
> should not be considered to work across Python VMs or Python releases."*

🔴 **Read that as a constraint on what you may conclude.** A disassembly is
evidence about *this interpreter, this version, this build*. It is not evidence
about "Python". Three specific consequences:

- **Never put a bytecode assertion in a test suite.** It will break on a minor
  release, and the breakage will teach you nothing.
- **Never publish "X is faster than Y in Python" on the strength of an opcode
  count.** Opcodes are not equal in cost, and the set changes.
- **Never assume it transfers.** PyPy, GraalPy and MicroPython do not share
  CPython's bytecode at all.

What it *is* good for is understanding what the compiler did with your source —
and that understanding does survive, even when the opcode names do not.

## The worked example, from the documentation

Given the function:

```python
def myfunc(alist):
    return len(alist)
```

the documentation shows this disassembly:

```python
>>> dis.dis(myfunc)
  2           RESUME                   0

  3           LOAD_GLOBAL              1 (len + NULL)
              LOAD_FAST_BORROW         0 (alist)
              CALL                     1
              RETURN_VALUE
```

with the note that *"(The "2" is a line number)"*.

**Reading it left to right:**

| Column | Meaning |
|---|---|
| `2`, `3` | The **source line number**. It appears only on the first instruction generated for that line — a blank there means "same line as above" |
| `RESUME`, `LOAD_GLOBAL` | The **opcode** — the operation the interpreter will perform |
| `0`, `1` | The **argument**, as a raw number: an index into a table, a jump target, a count |
| `(len + NULL)`, `(alist)` | The **resolved argument**, in parentheses — what that index actually refers to. This is the column you read |

The program is a stack machine: `LOAD_GLOBAL` pushes `len`, `LOAD_FAST_BORROW`
pushes the local `alist`, `CALL 1` consumes one argument plus the callable and
pushes the result, `RETURN_VALUE` returns it.

Two details in this listing are specific to modern CPython and worth naming so
they do not confuse you:

- **`RESUME`** is not doing work in the usual sense; it is where the interpreter
  can be interrupted and where a generator or coroutine resumes. Every function
  has one.
- **`LOAD_FAST_BORROW`** is a recent refinement of `LOAD_FAST` that avoids a
  reference-count increment when the interpreter can prove it is safe. If you
  learned `LOAD_FAST` from older material, this is the same idea. **This is
  exactly the version drift the module warns about**, visible in its own first
  example.

## The three ways to invoke it

```python
import dis

dis.dis(myfunc)              # a function, method, class, module, code object,
                             # generator, coroutine, or a string of source
dis.dis("x = a + b * 2")     # a string is compiled first, then disassembled
dis.dis()                    # with no argument: disassembles the last traceback
```

`dis.dis()` handles a module by disassembling all its functions, and a class by
disassembling all its methods, including class and static methods. It also
**recurses into nested code objects** — comprehensions, nested functions, nested
class bodies, annotation scopes — with `depth` limiting how far (`depth=0` means
no recursion). Output goes to `sys.stdout` unless you pass `file=`.

That last form — `dis.dis()` with no argument, disassembling the last traceback
— is the one nobody knows about and the one most likely to be useful in a
debugging session.

### From the command line

```bash
python -m dis myscript.py
echo 'x = a + b * 2' | python -m dis      # reads source from stdin
```

The documented options:

```
python -m dis [-h] [-C] [-O] [-P] [-S] [infile]
```

| Flag | Long form | Effect | Added |
|---|---|---|---|
| `-C` | `--show-caches` | Show inline caches | 3.13 |
| `-O` | `--show-offsets` | Show instruction offsets | 3.13 |
| `-P` | `--show-positions` | Show source positions of instructions | **3.14** |
| `-S` | `--specialized` | Show specialized bytecode | **3.14** |

`-O` is the one to reach for when reading jumps: without offsets, a jump target
is a number you cannot locate in the listing.

## Instruction offsets and jumps

By default the offset column is hidden, which is fine for straight-line code and
useless the moment there is a branch or a loop. A jump instruction's argument is
a bytecode index, so you need the offsets to find where it lands:

```python
dis.dis(myfunc, show_offsets=True)
```

```bash
python -m dis -O myscript.py
```

An instruction that something jumps *to* is marked as a jump target — the
`Instruction` named tuple exposes this as `is_jump_target`, and the jump
instruction's own destination as `jump_target`.

## Programmatic access

For anything beyond reading, do not parse the text output. There is a structured
API:

```python
>>> bytecode = dis.Bytecode(myfunc)
>>> for instr in bytecode:
...     print(instr.opname)
...
RESUME
LOAD_GLOBAL
LOAD_FAST_BORROW
CALL
RETURN_VALUE
```

`dis.Bytecode` wraps a function, generator, coroutine, method, source string or
code object, and iterating it yields `Instruction` named tuples.
`dis.get_instructions()` gives you the same iterator directly.

The fields worth knowing on `Instruction`:

| Field | What it gives you |
|---|---|
| `opname` / `opcode` | The operation, by name and by number |
| `baseopname` / `baseopcode` | The **unspecialized** operation, when this one is specialized; otherwise the same |
| `arg` (alias `oparg`) | The raw numeric argument, or `None` |
| `argval` | The resolved value of that argument |
| `argrepr` | The human-readable description — the parenthesised column |
| `offset` / `start_offset` | Index within the bytecode; `start_offset` includes any prefixed `EXTENDED_ARG` |
| `starts_line` / `line_number` | Whether this opcode begins a source line, and which |
| `is_jump_target` / `jump_target` | Branch structure |
| `positions` | A `dis.Positions` with the start and end source locations covered |
| `cache_info` | Cache entries as `(name, size, data)` triplets, or `None` if the instruction has no caches |

`positions` is the field behind Python's precise error messages — it is how a
traceback can underline the exact subexpression that failed, rather than naming
the whole line.

## Gotchas

**Symptom:** a colleague's disassembly does not match yours for the same function
**Cause:** a different Python version, almost always. The module warns that
opcodes may be added, removed or changed between versions
**Fix:** compare on the same interpreter, and state the version whenever you
quote a listing. `LOAD_FAST` versus `LOAD_FAST_BORROW` is a live example of
exactly this drift

**Symptom:** a jump argument is a number that matches no line in the output
**Cause:** it is a bytecode *offset*, and offsets are hidden by default
**Fix:** `show_offsets=True`, or `python -m dis -O`

**Symptom:** `dis.dis` on a module shows nothing for the module-level code
**Cause:** for a module it disassembles the functions it contains
**Fix:** to see module-level code, compile the source and disassemble the
resulting code object, or pass the source string directly

**Symptom:** disassembling a comprehension or nested function shows nothing
useful at the top level
**Cause:** those are separate code objects; `dis` recurses into them, but a
`depth` limit will cut that off
**Fix:** leave `depth` as `None`, and read past the outer listing to the nested
code objects that follow

**Symptom:** a test asserting on opcode names broke after a Python upgrade
**Cause:** the documented, expected outcome — bytecode is explicitly not stable
across releases
**Fix:** do not assert on bytecode. If the property you care about is
behavioural, test the behaviour

**Symptom:** parsing `dis` text output in a script is fragile
**Cause:** the text format is for humans, and columns are conditional on flags
**Fix:** use `dis.Bytecode` or `dis.get_instructions()` and read `Instruction`
fields

**Symptom:** `dis.dis()` with no argument raised instead of printing something
**Cause:** it disassembles the *last traceback*; if there has not been one,
there is nothing to show
**Fix:** it is a post-mortem tool. Use it after an exception, in a REPL or
debugger session

## Interview questions

**What does `dis` do, and what is the caveat that comes with it?**
It disassembles Python code into the CPython bytecode the interpreter will
execute. The caveat is stated by the module itself: bytecode is a CPython
implementation detail with no guarantee of stability across versions, and it
does not transfer to other Python VMs. So it is a tool for understanding, not a
basis for assertions.

**How do you read a `dis` line?**
Four columns: the source line number (shown only on the first instruction for
that line), the opcode, the raw numeric argument, and the resolved argument in
parentheses. The parenthesised column is the readable one — an index into a
names or constants table, rendered as the thing it refers to.

**Two colleagues get different disassemblies for the same function. Who is
wrong?**
Probably neither — they are almost certainly on different Python versions, which
the documentation explicitly permits. `LOAD_FAST` versus `LOAD_FAST_BORROW` is a
current example. Always state the interpreter version alongside a listing.

**You need offsets to follow a loop. How?**
`dis.dis(f, show_offsets=True)` or `python -m dis -O`. Jump arguments are
bytecode offsets, and without the offset column there is nothing in the listing
to match them against.

**How would you analyse bytecode in a script rather than by eye?**
`dis.Bytecode(obj)` or `dis.get_instructions(obj)`, both of which yield
`Instruction` named tuples with `opname`, `arg`, `argval`, `argrepr`, `offset`,
`line_number`, `is_jump_target` and `positions`. Never parse the printed text —
its columns depend on which flags were passed.

**What is `RESUME` doing at the top of every function?**
It marks where execution begins or resumes — the point at which the interpreter
may be interrupted, and where a generator or coroutine picks up. It is not
computing anything in your program's terms.

**What is `Instruction.positions` for?**
It holds the start and end source locations an instruction covers, which is what
lets tracebacks underline the exact subexpression that raised rather than
pointing at the whole line.

---

← Prev: [Startup and import cost](../11-startup-and-import-cost/README.md) · Index: [Bytecode inspection with `dis`](README.md) · Next → [What it is actually good for](02-what-it-is-good-for.md)
