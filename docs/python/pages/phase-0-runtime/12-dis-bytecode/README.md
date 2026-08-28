---
title: "Bytecode inspection with `dis`: seeing what a line of Python actually does"
sidebar_label: "12 · Bytecode inspection with `dis`"
sidebar_position: 12
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-28 against the Python 3.14
> [`dis` module documentation](https://docs.python.org/3.14/library/dis.html).
> Target: **CPython 3.14.7**.
> ⚠️ The only disassembly listing in this topic is the one quoted from that
> documentation. Bytecode differs between versions and builds — run `dis`
> yourself rather than trusting a listing copied from anywhere, this topic
> included.

**`dis` turns a function into the instruction sequence CPython will actually
execute. It settles questions about what the *compiler* did — constant folding,
scoping decisions, how a comprehension or an f-string is built — and it settles
almost nothing about speed. Both halves of that sentence matter, and the second
is the one people get wrong.**

The module's own warning governs everything else in this topic:

> *"Bytecode is an implementation detail of the CPython interpreter. No
> guarantees are made that bytecode will not be added, removed, or changed
> between versions of Python."*

So a disassembly is evidence about *this interpreter, this version*. Never a
test assertion, never a portable claim, never a substitute for a measurement.

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Reading a disassembly](01-reading-a-disassembly.md)** | The implementation-detail warning and what it forbids; the documentation's worked example and its four columns; `RESUME` and `LOAD_FAST_BORROW`; the three ways to invoke it including the post-mortem form; `python -m dis` and its `-C`/`-O`/`-P`/`-S` flags; offsets and jumps; `dis.Bytecode`, `get_instructions` and the `Instruction` fields |
| 2 | **[What it is actually good for](02-what-it-is-good-for.md)** | Seeing compile-time effects; diagnosing `UnboundLocalError`; the specialising interpreter via `adaptive` and `show_caches`, and why a never-run function shows nothing; the questions `dis` **cannot** settle, and why `timeit` owns speed |

## The one thing to take away

**`dis` answers "what did the compiler do?" — not "which is faster?"**

Opcodes cost different amounts, the specialising interpreter rewrites what
actually runs, and the real time is often inside a C function one opcode calls.
Measure with `timeit`; then, if you want to know *why* a measured difference
exists, disassemble. That order is the whole discipline.

## Where this connects

- **Topic [07 · Everything is an object](../07-everything-is-an-object/README.md)**
  is the main customer: constant folding, constant merging and interning are
  described there and directly visible here. It links back to this topic for
  exactly that reason.
- **Topic [01 · What Python is](../01-what-python-is/README.md)** established
  source → bytecode → the interpreter loop. This is the tool for looking at the
  middle step.
- **Phase 13 · Production** is where performance questions actually belong, with
  profilers and `timeit` rather than a disassembler.

---

← Prev: [Startup and import cost](../11-startup-and-import-cost/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → **Phase 1 · Language core** *(not written yet)*
