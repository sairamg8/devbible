---
title: "Startup and import cost: why a Python CLI feels slow before it runs a line of your code"
sidebar_label: "11 · Startup and import cost"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-28 against the Python 3.14
> [command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> documentation, [`importlib`](https://docs.python.org/3.14/library/importlib.html),
> the [`site` module](https://docs.python.org/3.14/library/site.html), and
> [PEP 810 – Explicit lazy imports](https://peps.python.org/pep-0810/)
> (Final, targeting 3.15).
> Target: **CPython 3.14.7**, with 3.15 named where it changes the answer.

**"Python is slow to start" is a real complaint with a specific cause, and it is
almost never the interpreter. It is what your program imports — transitively,
at module scope, before `main()` runs. This topic is about locating that cost
with `-X importtime` rather than guessing at it, removing it with the one
technique that does most of the work, and knowing what the 3.15 `lazy` keyword
will change.**

Startup cost is invisible in a long-running server and dominant in a CLI, a
serverless cold start, a test suite's collection phase, and anything that spawns
processes. **Know which you are writing before spending a day on this** — for a
web service that starts once and serves for days, this whole topic is
theoretical.

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Where the time goes](01-where-the-time-goes.md)** | Interpreter init vs your imports; `-X importtime` and 3.14's new `=2` mode; reading the cumulative and self columns; the traps in interpreting the output; where the cost usually is; who actually cares |
| 2 | **[What you can actually do today](02-what-you-can-actually-do.md)** | The function-level import and its real cost; `TYPE_CHECKING`; restructuring a CLI entry point; why the standard library *heavily* discourages `LazyLoader`; `-S`, `-E`, `-I`, `-P` and what `.pth` files do to startup |
| 3 | **[Lazy imports (PEP 810)](03-lazy-imports.md)** | The `lazy` soft keyword in 3.15; `__lazy_modules__` and the interpreter-wide switch; the four places `lazy` is forbidden and why; deferred errors with chained tracebacks; why import side effects are the real hazard |

## The one thing to take away

**Measure before you change anything.** `python -X importtime -m myapp 2> log`
answers in seconds a question that people otherwise argue about for hours. Sort
by *self* time to find modules doing real work at import; read *cumulative* time
to find which of your own top-level imports is the expensive doorway. On 3.14,
`-X importtime=2` additionally marks already-loaded modules as `cached`, which
tells you whether removing an import will help at all — often it will not,
because something else imports it anyway.

Then apply the fix that does most of the work: **parse arguments before
importing anything a subcommand needs.**

## Where this connects

- **Topic [08 · Imports](../08-imports/README.md)** is the mechanism this topic
  bills you for: an import *executes* a module, and `sys.modules` is why the
  second one is free.
- **Topic [09 · `if __name__ == "__main__"`](../09-name-main/README.md)** —
  `spawn` and `forkserver` re-import your module in every child process, which
  multiplies import cost by the pool size.
- **Phase 7 · Packaging** covers entry points and console scripts, the place a
  CLI's startup shape is actually decided.
- **Phase 13 · Production** picks up the memory side of the same question.

---

← Prev: [Python vs Node for a backend](../10-python-vs-node/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → [Bytecode inspection with `dis`](../12-dis-bytecode/README.md)
