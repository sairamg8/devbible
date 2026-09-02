---
title: "Phase 1 — Language core"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Python 3.14** (3.14.7, August 2026). Documentation-validated — every
> page names its sources on a `> Verified:` line (docs.python.org/3.14, the PEPs,
> the language reference). No sandbox: pages carry Python code, never fabricated
> program output.

The syntax you can read after an afternoon, and the semantics that take a year
of bugs to learn. Phase 0 explained what runs your code; this phase is what you
actually write — and the rows tiered **Master** here are the ones that produce
production bugs when half-known: mutability and aliasing, float money math,
encoding, truthiness.

Almost none of this is exotic. `-7 // 2` is `-4`, not `-3`. `0.1 + 0.2` is not
`0.3`. A list passed to a function is the *caller's* list. An empty result set
is falsy and so is "no result yet". Each is a one-line fact and a production
incident, and every one of them is here.

🚧 **In flight — 9 of 16.** Complete: **01 · Syntax and indentation** (8 chunks + index, 1,900 lines), **02 · Numbers** (69 + index, 17,166), **03 · Strings** (9 + index, ~2,150), **04 · `bytes` vs `str`** (4 + index, ~1,100), **05 · Truthiness** (12 + index, 3,261), **06 · Comparisons** (23 + index, 5,531), **07 · Assignment and aliasing** (25 + index, 6,662), **08 · Control flow** (6 + index, 1,692) and **10 · `match`** (4 + index, 1,101). **Topics 05, 06, 07, 08 and 10 all closed 2026-09-02** — a coordinator and two author forks running in parallel, each owning a whole topic directory. Together they add **18,247 lines, 532 gotchas and 502 interview questions**, and every one closed at **0 over the 300-line cap, 0 MDX hazards, 0 dangling links, unbroken footer chains and no duplicate `sidebar_position`**; a link resolve over all of `docs/python/pages` reports zero dangling. **Topics 09 · Comprehensions and 11 · Exceptions are being written now.** Topic 04 is still short one planned chunk. Topics 12–16 are unwritten.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Syntax: indentation as structure](01-syntax-and-indentation/README.md)** | <span className="db-tier t-understand">Understand</span> | Blocks are whitespace, statements vs expressions, and the mixed-tabs file that will not parse |
| 02 | **[Numbers](02-numbers/README.md)** | <span className="db-tier t-master">Master</span> | `int` never overflows, `float` is IEEE-754 and lies about 0.1, `Decimal` is what money needs, and division floors toward minus infinity — 69 chunks |
| 03 | **[Strings](03-strings/README.md)** | <span className="db-tier t-master">Master</span> | Immutability, the method vocabulary, and f-strings including `=` and format specs |
| 04 | **[`bytes` vs `str`](04-bytes-and-encoding/README.md)** | <span className="db-tier t-understand">Understand</span> | Decode at the boundary, work in `str`, encode on the way out |
| 05 | **[Truthiness](05-truthiness/README.md)** | <span className="db-tier t-master">Master</span> | Empty things are falsy, `and`/`or` return operands, and the walrus — 12 chunks |
| 06 | **[Comparisons](06-comparisons/README.md)** | <span className="db-tier t-understand">Understand</span> | Chaining, `is` for `None` only, and rich comparison across types — 23 chunks |
| 07 | **[Assignment semantics and aliasing](07-assignment-and-aliasing/README.md)** | <span className="db-tier t-master">Master</span> | References, not copies — and when you need `copy` vs `deepcopy` — 25 chunks |
| 08 | **[Control flow](08-control-flow/README.md)** | <span className="db-tier t-understand">Understand</span> | `for`/`else`, `while`/`else`, and `enumerate`/`zip` instead of index arithmetic — 6 chunks |
| 09 | **Comprehensions** *(not written yet)* | <span className="db-tier t-master">Master</span> | List/dict/set, generator expressions, and the line where it should have been a loop |
| 10 | **[`match` — structural pattern matching](10-match-pattern-matching/README.md)** | <span className="db-tier t-understand">Understand</span> | Destructuring by shape, class patterns, guards — 4 chunks |
| 11 | **Exceptions, the working set** *(not written yet)* | <span className="db-tier t-master">Master</span> | `try`/`except`/`else`/`finally`, specific types, `raise ... from`, exception groups |
| 12 | **EAFP vs LBYL** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | A design stance, not a style preference — and when each is right |
| 13 | **Unpacking** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Tuple assignment, `first, *rest`, and `*`/`**` in calls |
| 14 | **`None` and the "no result" contract** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `None` vs empty vs raising — pick one per function and mean it |
| 15 | **PEP 8 and idiom** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | What `ruff` enforces anyway, and the parts of "pythonic" that are real signal |
| 16 | **`del`, `pass`, `Ellipsis`** *(not written yet)* | <span className="db-tier t-know">Know</span> | The small statements, and chained assignment corner cases |

## Phase gate

Move on when you can predict what
`def f(items=[]): items.append(1); return items` returns on the **third** call,
say why `-7 // 2` is `-4`, and explain what `"café".encode("latin-1")` does to
your JSON.

## Where this connects

- **Phase 2 — Functions** turns the mutable-default trap from a curiosity into
  the signature-design rule it really is.
- **Phase 3 — Collections** is where aliasing stops being a toy example: every
  `dict` of `list`s you build inherits the semantics taught here.
- **Phase 6 — Typing** formalises the "no result" contract this phase asks you
  to pick: `T | None` is a promise the type checker can hold you to.

---

← Prev: [Phase 0 — The runtime](../phase-0-runtime/README.md) · Index: [Python — Explanations](../README.md)
