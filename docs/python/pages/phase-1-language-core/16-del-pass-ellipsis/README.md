---
title: "`del`, `pass`, `Ellipsis` — the small statements, described precisely"
sidebar_label: "16 · `del`, `pass`, `Ellipsis`"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `del` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-del-statement),
> [The `pass` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-pass-statement),
> [Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements),
> the Library Reference
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html),
> [`contextlib.suppress`](https://docs.python.org/3.14/library/contextlib.html#contextlib.suppress),
> [`types`](https://docs.python.org/3.14/library/types.html),
> and [`object.__del__`](https://docs.python.org/3.14/reference/datamodel.html#object.__del__).
> Target: **CPython 3.14**.

**Three pieces of syntax everyone recognises and few can describe precisely.
`del` **unbinds a name** — it does not delete an object, it is unrelated to
`__del__`, and it frees memory only when the name happened to hold the last
reference. `pass` is a **statement** that does nothing, existing only because
indentation-delimited blocks cannot be empty. And `Ellipsis` is an **object**,
spelled `...`, with a type, a truth value, and three unrelated jobs. Tiered
`Know` because none of it is hard — but each is routinely described wrongly, and
two of them have a real bug attached.**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`del`](01-del.md)** | Unbinding versus deleting, and why "I added a `del` to save memory" is usually false; the four target forms and the `__delitem__`/`__delattr__` protocols behind them; `del` making a name local for the whole function; where it is genuinely the right tool; and `del` versus `__del__`, which are unrelated |
| 2 | **[`pass` and `Ellipsis`](02-pass-and-ellipsis.md)** | Why the language needs `pass` and why a docstring is often better; `except X: pass` versus `contextlib.suppress`; `Ellipsis` as a real singleton, its three jobs, and the `tuple[int]` versus `tuple[int, ...]` bug; chained assignment binding one object to every target, and its left-to-right corner case |

## The one paragraph the whole topic expands

`del name` removes a binding, `del d[k]` calls `__delitem__`, `del o.a` calls
`__delattr__`; none of them deletes an object directly, and `__del__` is a
finaliser the garbage collector may call, on its own schedule, not something
`del` invokes. `pass` fills a block that must not be empty, and inside an
`except` it should almost always be `contextlib.suppress` instead, because
deliberate ignoring and a forgotten handler look identical. `Ellipsis` is a
singleton object whose only load-bearing use in ordinary code is
`tuple[int, ...]`, where omitting it means a one-element tuple.

## Where this connects

- **[Assignment semantics and aliasing](../07-assignment-and-aliasing/README.md)**
  owns the reason `a = b = []` is dangerous: one object, two names.
- **[Unpacking](../13-unpacking/README.md)** shares the left-to-right target
  rule that makes `i = x[i] = 2` surprising — it is the same rule, in the same
  reference paragraph.
- **[Control flow](../08-control-flow/04-break-continue-and-mutation.md)** is
  why `del` inside a loop over the same container skips elements or raises.
- **Exceptions, the working set** *(not written yet)* is where
  `contextlib.suppress` belongs properly, alongside the rest of the argument
  against swallowing.
- **Phase 4 — Classes and the data model** owns `__del__`, `__delitem__` and
  `__delattr__` as protocols rather than as things `del` happens to call.
- **Phase 6 — Typing** is where `Ellipsis` stops being a curiosity:
  `Callable[..., int]` and `tuple[int, ...]` both have meanings a checker
  enforces.

---

← Prev: [PEP 8 and idiom](../15-pep8-and-idiom/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → **Phase 2 — Functions, closures and decorators** *(not written yet)*
