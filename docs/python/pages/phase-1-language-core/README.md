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

🚧 **In flight — 3 of 16.** Topics **01 · Syntax and indentation** (8 chunks + index, 1,900 lines), **03 · Strings** (9 chunks + index, ~2,150) and **04 · `bytes` vs `str`** (4 chunks + index, ~1,100) are written: 0 files over the 300-line cap, 0 MDX hazards, every internal link resolved against the filesystem. Topic **02 · Numbers** is in flight. Topic 04 is short one planned chunk — see its index.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Syntax: indentation as structure](01-syntax-and-indentation/README.md)** | <span className="db-tier t-understand">Understand</span> | Blocks are whitespace, statements vs expressions, and the mixed-tabs file that will not parse |
| 02 | **[Numbers](02-numbers.md)** | <span className="db-tier t-master">Master</span> | `int` never overflows, `float` is IEEE-754, `Decimal` for money, and floor division |
| 03 | **[Strings](03-strings/README.md)** | <span className="db-tier t-master">Master</span> | Immutability, the method vocabulary, and f-strings including `=` and format specs |
| 04 | **[`bytes` vs `str`](04-bytes-and-encoding/README.md)** | <span className="db-tier t-understand">Understand</span> | Decode at the boundary, work in `str`, encode on the way out |
| 05 | **[Truthiness](05-truthiness.md)** | <span className="db-tier t-master">Master</span> | Empty things are falsy, `and`/`or` return operands, and the walrus |
| 06 | **[Comparisons](06-comparisons.md)** | <span className="db-tier t-understand">Understand</span> | Chaining, `is` for `None` only, and rich comparison across types |
| 07 | **[Assignment semantics and aliasing](07-assignment-and-aliasing.md)** | <span className="db-tier t-master">Master</span> | References, not copies — and when you need `copy` vs `deepcopy` |
| 08 | **[Control flow](08-control-flow.md)** | <span className="db-tier t-understand">Understand</span> | `for`/`else`, `while`/`else`, and `enumerate`/`zip` instead of index arithmetic |
| 09 | **[Comprehensions](09-comprehensions.md)** | <span className="db-tier t-master">Master</span> | List/dict/set, generator expressions, and the line where it should have been a loop |
| 10 | **[`match` — structural pattern matching](10-match-pattern-matching.md)** | <span className="db-tier t-understand">Understand</span> | Destructuring by shape, class patterns, guards |
| 11 | **[Exceptions, the working set](11-exceptions.md)** | <span className="db-tier t-master">Master</span> | `try`/`except`/`else`/`finally`, specific types, `raise ... from`, exception groups |
| 12 | **[EAFP vs LBYL](12-eafp-vs-lbyl.md)** | <span className="db-tier t-understand">Understand</span> | A design stance, not a style preference — and when each is right |
| 13 | **[Unpacking](13-unpacking.md)** | <span className="db-tier t-understand">Understand</span> | Tuple assignment, `first, *rest`, and `*`/`**` in calls |
| 14 | **[`None` and the "no result" contract](14-none-and-no-result.md)** | <span className="db-tier t-understand">Understand</span> | `None` vs empty vs raising — pick one per function and mean it |
| 15 | **[PEP 8 and idiom](15-pep8-and-idiom.md)** | <span className="db-tier t-understand">Understand</span> | What `ruff` enforces anyway, and the parts of "pythonic" that are real signal |
| 16 | **[`del`, `pass`, `Ellipsis`](16-del-pass-ellipsis.md)** | <span className="db-tier t-know">Know</span> | The small statements, and chained assignment corner cases |

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
