---
title: "`match` — structural pattern matching: destructuring by shape"
sidebar_label: "10 · `match`"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `match` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement),
> [PEP 634 — Specification](https://peps.python.org/pep-0634/),
> [PEP 636 — Tutorial](https://peps.python.org/pep-0636/),
> the [Glossary](https://docs.python.org/3.14/glossary.html#term-soft-keyword),
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)
> and [`enum`](https://docs.python.org/3.14/library/enum.html).
> Target: **CPython 3.14**.

**`match` looks like a `switch` and is not one. A switch compares a value
against constants; `match` takes a subject apart by **shape** — is it a
three-element sequence, a mapping with these keys, an instance of this class
with these attributes — and binds the pieces it finds. Two consequences carry
the whole topic. First, **a bare name in a pattern captures rather than
compares**, so `case OK:` matches everything and quietly rebinds `OK`; only a
dotted name is compared. Second, a pattern that does not fit simply fails
instead of raising, which is exactly why `match` beats a stack of defensive
`.get()` calls for parsing a payload whose shape you do not control.**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What `match` is](01-what-match-is.md)** | The statement's shape; `match`/`case` as **soft** keywords and why old code still works; no fall-through and what `break` does instead; `_` as the wildcard; where `match` earns its place over `if`/`elif`, and where it does not; that an unmatched `match` does nothing at all, silently |
| 1b | **[Capture versus value patterns](01b-capture-versus-value-patterns.md)** | The trap: `case OK:` always matches and rebinds `OK`. The purely syntactic dot rule, the pattern-kind table, why this is an argument for `Enum` over module constants, the must-be-last rule for irrefutable patterns, `None`/`True`/`False` comparing with `is`, and the binding rules (one bind per name, OR alternatives binding alike) |
| 2 | **[Sequence, mapping and class patterns](02-sequence-mapping-class-patterns.md)** | Sequence patterns and the deliberate exclusion of `str`/`bytes`/`bytearray`; mapping patterns being **partial** and using two-argument `get()` so `__missing__` never fires; `**_` disallowed; class patterns as isinstance-plus-extraction, `case Shape:` versus `case Shape():`, `__match_args__` and its refactor hazard, and the self-matching builtins that make type assertions inside patterns possible |
| 3 | **[Guards, OR and AS](03-guards-or-and-as.md)** | Guards evaluated *after* binding so they can use the names; why a side-effecting guard is a trap; OR patterns and the same-names constraint; AS patterns for keeping the whole and the parts; a worked webhook parser and what it buys over `.get()` chains; when not to use `match` |

## The one paragraph the whole topic expands

`match` destructures by shape. A bare name captures — always, unconditionally —
so constants in patterns must be dotted, which in practice means putting them on
an `Enum`. Sequence patterns match length and position but never a string;
mapping patterns match a subset of keys and never invoke `__missing__`; class
patterns are `isinstance` plus attribute extraction, and need `__match_args__`
for positional form. Guards run after the bindings and can use them. Nothing
falls through, nothing is checked for exhaustiveness, and a `match` that matches
nothing does nothing — so end every one over untrusted input with a `case _:`
that raises.

## Where this connects

- **[Truthiness](../05-truthiness/README.md)** — `case True:` compares with
  `is`, one of the few places the language declines to blur the
  [`bool`-is-an-`int`](../02-numbers/04-bool-is-an-int.md) overlap.
- **[Comparisons](../06-comparisons/README.md)** — value patterns compare with
  `==`, so everything that topic says about `__eq__` and cross-type equality
  applies inside a pattern.
- **[Control flow](../08-control-flow/README.md)** — `match` is a statement, so
  `break` inside one belongs to the enclosing *loop*, not to the match.
- **Exceptions, the working set** *(not written yet)* is the contrast this topic
  keeps drawing: `match` turns malformed input into a non-match, where a
  defensive lookup turns it into a `KeyError`.
- **Phase 4 — Classes and the data model** is where `__match_args__` belongs
  properly, alongside the other protocol attributes a class can declare.
- **Phase 6 — Typing** is where exhaustiveness actually gets checked: a type
  checker can prove a `match` over a closed union is complete, which the
  language never does.

---

← Prev: **Comprehensions** *(not written yet)* · Index: [Phase 1 — Language core](../README.md) · Next → **Exceptions, the working set** *(not written yet)*
