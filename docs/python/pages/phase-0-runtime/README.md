---
title: "Phase 0 — The runtime"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Python 3.14** (3.14.7, August 2026). Documentation-validated — every
> page names its sources on a `> Verified:` line (docs.python.org/3.14, the PEPs,
> and the tool docs). No sandbox: pages carry Python code, never fabricated
> program output.

What actually runs your code. This phase is the difference between *"Python is
slow and weird about threads"* and knowing precisely **which** work Python is
the right or wrong tool for — a distinction that decides architecture in
Phase 8 and performance in Phase 13.

Almost every "Python is being weird" complaint a beginner files resolves to one
of four things taught here: the GIL, a virtual environment that isn't active,
the import system, or names-bind-to-objects. None of them are advanced topics;
all of them are load-bearing.

🚧 **Phase in progress — 10 of 12 written.** Only **06 · Running code** (5 chunks on disk, index not yet written) and **10 · Python vs Node** (unstarted) remain.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What Python is: CPython](01-what-python-is/README.md)** | <span className="db-tier t-master">Master</span> | Source → bytecode → the interpreter loop; the language vs its implementation |
| 02 | **[The GIL](02-the-gil/README.md)** | <span className="db-tier t-master">Master</span> | One thread runs bytecode — but I/O releases it, and 3.14 makes free-threading official |
| 03 | **[The release model](03-release-model/README.md)** | <span className="db-tier t-understand">Understand</span> | One major each October; 3.14 current, 3.15 lands Oct 2026 |
| 04 | **[Installing and managing versions](04-installing-and-versions/README.md)** | <span className="db-tier t-understand">Understand</span> | `uv` / `pyenv`, and never installing into the system Python |
| 05 | **[Virtual environments](05-virtual-environments/README.md)** | <span className="db-tier t-master">Master</span> | What a venv actually is — a config file and a path |
| 06 | **Running code** | <span className="db-tier t-understand">Understand</span> | `python -m` vs `python file.py`, the rewritten REPL, `-c`, shebangs |
| 07 | **[Everything is an object](07-everything-is-an-object/README.md)** | <span className="db-tier t-master">Master</span> | Names bind to objects, `is` vs `==`, and why `a = b` never copies |
| 08 | **[Imports](08-imports/README.md)** | <span className="db-tier t-master">Master</span> | Modules, packages, `sys.path` — and the file you named `random.py` |
| 09 | **[`if __name__ == "__main__"`](09-name-main/README.md)** | <span className="db-tier t-understand">Understand</span> | Script vs import, and the multiprocessing crash without it |
| 10 | **Python vs Node for a backend** | <span className="db-tier t-know">Know</span> | The honest comparison; PyPy and GraalPy at recognition level |
| 11 | **[Startup and import cost](11-startup-and-import-cost/README.md)** | <span className="db-tier t-know">Know</span> | Why CLIs feel slow, and lazy imports as the coming answer |
| 12 | **[Bytecode inspection with `dis`](12-dis-bytecode/README.md)** | <span className="db-tier t-when">When Needed</span> | Seeing what a line actually does |

## Phase gate

Move on when you can explain why threads speed up 100 HTTP calls but not 100
checksum computations — and what free-threaded CPython changes about that
answer.

## Where this connects

- **Phase 8 — Concurrency and async** is this phase's payoff: the GIL model
  here becomes the threads-vs-processes-vs-asyncio decision there.
- **Phase 7 — Packaging** turns the venv from a concept into `uv sync` and a
  committed lockfile.
- **Phase 13 — Production** picks up the startup and memory costs this phase
  only names.

---

← Index: [Python — Explanations](../README.md)
