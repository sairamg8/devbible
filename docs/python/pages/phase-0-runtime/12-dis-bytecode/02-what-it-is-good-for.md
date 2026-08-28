---
title: "What it is actually good for: settling compile-time questions, seeing the specialising interpreter, and the arguments `dis` cannot settle"
sidebar_label: "2 · What it is good for"
sidebar_position: 2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-28 against the Python 3.14
> [`dis` module documentation](https://docs.python.org/3.14/library/dis.html)
> (the `adaptive` and `show_caches` parameters, `baseopname`/`baseopcode`,
> `cache_info`, and the `-S`/`--specialized` and `-C`/`--show-caches` flags) and
> the [`timeit` module](https://docs.python.org/3.14/library/timeit.html).
> Target: **CPython 3.14.7**.
> ⚠️ No disassembly output is reproduced on this page. Chunk
> [1](01-reading-a-disassembly.md) quotes the documentation's own listing; the
> examples here describe what to look for and expect you to run them.

**Chunk [1](01-reading-a-disassembly.md) covered how to read the output. This
chunk is about when reaching for it is the right move — a genuinely short list —
and, more usefully, the much longer list of questions people bring to `dis` that
it cannot answer.**

## Use 1: seeing what the compiler did to your source

This is the strongest case, because it is a question about *compilation*, and
compilation is exactly what `dis` shows. Topic
[07 · Everything is an object](../07-everything-is-an-object/README.md)
describes constant folding, constant merging and string interning, and every one
of them is directly visible:

```python
import dis

dis.dis("x = 60 * 60 * 24")      # is the arithmetic done at compile time?
dis.dis("s = 'a' * 100")         # folded, or a runtime multiply?
dis.dis("s = 'a' * 100000")      # over the documented fold limit — what changes?
```

You are looking for whether the value appears as a single loaded constant, or
whether the operands are loaded and an arithmetic opcode follows. That is a
factual, immediate answer to a question people otherwise settle by argument.

The same applies to any "does the compiler optimise this" question: whether a
chained comparison short-circuits, what an f-string compiles to, what a `with`
block sets up, how a comprehension becomes its own code object, what a decorator
does at definition time. **`dis` is the right tool whenever the question is
about what happens before your code runs.**

## Use 2: understanding an error you cannot explain

Two cases where the disassembly is genuinely diagnostic:

- **`UnboundLocalError` on a name that clearly exists.** The disassembly shows
  `LOAD_FAST` rather than `LOAD_GLOBAL` for that name, which tells you the
  compiler decided it was local — because it is assigned somewhere in the
  function, possibly on a line that never runs. The scoping decision is made at
  compile time, and this is where you can see it.
- **A post-mortem.** `dis.dis()` with no arguments disassembles the last
  traceback, showing the instruction stream around a failure.

## Use 3: seeing the specialising interpreter

Modern CPython rewrites its own bytecode as it runs, replacing general
instructions with specialised ones once it has observed the types involved. `dis`
can show either form:

```python
dis.dis(myfunc, adaptive=True)      # specialized bytecode, as the interpreter has it now
dis.dis(myfunc, show_caches=True)   # the inline cache entries used to specialize
```

```bash
python -m dis -S myscript.py        # --specialized  (3.14)
python -m dis -C myscript.py        # --show-caches  (3.13)
```

The documentation is precise about what `adaptive` gives you: *"`dis()` will
display specialized bytecode that may be different from the original bytecode."*

🔴 **The catch that makes this easy to misuse: specialisation only happens once
the code has actually run enough.** Disassembling a function you have never
called shows the unspecialized form, because there has been nothing to specialise
from. To see the specialised version you must exercise the function first, and
what you then see reflects the types it actually saw. A function called with
`int`s and a function called with `Decimal`s will specialise differently.

`Instruction` exposes both views at once: `opname`/`opcode` for the actual
instruction, and `baseopname`/`baseopcode` for the unspecialized operation it
derives from — equal to each other when the instruction is not specialised. And
`cache_info` gives the cache entries as `(name, size, data)` triplets, or `None`
where an instruction has no caches.

This is a genuinely interesting thing to look at once, to understand why CPython
has got faster without the language changing. It is almost never something to
act on.

## What `dis` cannot settle

🔴 **"Which of these two is faster?" is not a question `dis` answers**, and this
is the single most common misuse. Reasons, all of them sufficient on their own:

- **Opcodes are not equal in cost.** A listing with fewer instructions can be
  slower. Counting lines in a disassembly is not measurement.
- **The specialising interpreter changes the executed instructions at run time**,
  so the static listing may not be what runs.
- **The cost may not be in the bytecode at all** — it may be in a C function that
  one opcode calls, where all the real time goes.

**Use `timeit` for speed questions.** It measures the thing you actually care
about. `dis` explains *why* a difference exists once `timeit` has established
that one does — that pairing is the honest workflow, and the order matters.

Nor does it tell you anything about **memory**, about **which of two designs is
better**, or about behaviour on **any other implementation**. And it is not a
tool for reviewing someone's code: a reviewer who reaches for `dis` to justify a
style preference has substituted a machine detail for a readability argument.

## When to reach for it, honestly

The realistic list, in order of how often it comes up:

1. You are curious about what the compiler does with a construct — **the best
   reason, and the one this topic exists for.**
2. You hit a scoping error whose cause is invisible in the source.
3. You are teaching or learning how the interpreter works.
4. You are writing a tool that analyses code objects, in which case you want
   `dis.Bytecode`, not the printed output.
5. You have already measured a difference with `timeit` and want to understand
   its cause.

If your reason is not on that list, the answer is probably `timeit`, a profiler,
or reading the source. Tiering this topic *When Needed* is a statement about how
often it is the right tool, not about how interesting it is.

## Gotchas

**Symptom:** `adaptive=True` shows nothing different from the plain disassembly
**Cause:** the function has not been executed enough for the interpreter to
specialise anything
**Fix:** call it first, with representative types. Specialisation is driven by
observed behaviour, so a never-run function has nothing to show

**Symptom:** a conclusion drawn from opcode count turned out to be wrong when
timed
**Cause:** opcodes have different costs, and one of them may call into C where
all the real time is spent
**Fix:** `timeit` decides speed questions. `dis` explains a measured difference;
it does not establish one

**Symptom:** specialised bytecode differs between two runs of the same program
**Cause:** it reflects the types actually observed, which can vary with input
**Fix:** expected. Specialisation is per-run and input-dependent, which is
another reason not to build anything on it

**Symptom:** `UnboundLocalError` for a name that is obviously defined above
**Cause:** the name is assigned somewhere in the function, so the compiler made
it local for the whole function — the disassembly shows `LOAD_FAST` where you
expected `LOAD_GLOBAL`
**Fix:** `global` or `nonlocal` if the outer binding is intended, or rename the
local. The disassembly is how you confirm the diagnosis

**Symptom:** disassembling a decorated function shows the decorator's wrapper
**Cause:** the name is bound to whatever the decorator returned
**Fix:** reach through to the original, commonly via `__wrapped__` when the
decorator used `functools.wraps`

**Symptom:** `show_caches=True` output is long and mostly unreadable
**Cause:** inline cache entries are interpreter bookkeeping, not program logic
**Fix:** leave it off unless you are specifically investigating specialisation.
`cache_info` on `Instruction` is the structured form if you need the data

**Symptom:** someone cites a disassembly in a code review to argue for a rewrite
**Cause:** a machine detail standing in for a readability argument, on a basis
the documentation says is not stable across versions
**Fix:** ask for a measurement. If there is no measured difference, the
disassembly is not an argument

## Interview questions

**When would you actually use `dis`?**
Mainly to see what the compiler did with a construct — constant folding, how a
comprehension or f-string compiles, what a `with` block sets up. Also to diagnose
a scoping error, where the disassembly reveals a compile-time decision that is
invisible in the source. Rarely, to look at how the specialising interpreter has
rewritten hot code.

**Can you use `dis` to decide which of two implementations is faster?**
No. Opcodes have different costs, the specialising interpreter changes what
actually executes, and the real time may be inside a C function that one opcode
calls. `timeit` answers speed questions; `dis` can explain a difference that
`timeit` has already demonstrated.

**What does `adaptive=True` show, and what is the trap?**
The specialized bytecode, which the documentation notes may differ from the
original. The trap is that specialisation only happens after the code has run
enough to observe types — disassembling a function that has never been called
shows the unspecialized form, and what you eventually see depends on the types
it was actually given.

**How would you diagnose an `UnboundLocalError` on a name defined at module
level?**
Disassemble the function. If the name loads with `LOAD_FAST` rather than
`LOAD_GLOBAL`, the compiler classified it as local because it is assigned
somewhere in the function — possibly on a branch that never executes. That
decision is made at compile time, which is why the source alone can look fine.

**What is `baseopname` for?**
It gives the unspecialized operation behind a specialized instruction, and is
equal to `opname` when the instruction is not specialized. It lets a tool reason
about what an instruction fundamentally does without enumerating every
specialisation.

**Why is this topic tiered "When Needed" rather than something higher?**
Because the class of question it answers well is narrow. Understanding that
compilation happens and that it has observable effects is worth having; reaching
for the disassembler is occasional. Most questions people bring to `dis` are
really questions for `timeit`, a profiler, or the source.

**Is it safe to write a test that asserts on bytecode?**
No. The module documents that bytecode may be added, removed or changed between
versions and should not be assumed to work across releases or across Python VMs.
Test behaviour instead.

---

← Prev: [Reading a disassembly](01-reading-a-disassembly.md) · Index: [Bytecode inspection with `dis`](README.md) · Next → [Phase 0 — The runtime](../README.md)
