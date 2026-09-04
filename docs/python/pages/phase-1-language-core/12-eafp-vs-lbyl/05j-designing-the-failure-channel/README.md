---
title: "Designing the failure channel: how your function reports failure is a decision you make once and every call site pays forever — and the type checker enforces exactly one half of it"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`typing.Never` / `typing.NoReturn`](https://docs.python.org/3.14/library/typing.html#typing.Never),
> [`typing.assert_never`](https://docs.python.org/3.14/library/typing.html#typing.assert_never),
> [`@typing.overload`](https://docs.python.org/3.14/library/typing.html#typing.overload),
> [`typing.Literal`](https://docs.python.org/3.14/library/typing.html#typing.Literal),
> [`typing.Optional`](https://docs.python.org/3.14/library/typing.html#typing.Optional),
> [`dict.get`](https://docs.python.org/3.14/library/stdtypes.html#dict.get),
> [`str.find`](https://docs.python.org/3.14/library/stdtypes.html#str.find) /
> [`str.index`](https://docs.python.org/3.14/library/stdtypes.html#str.index),
> [`re.search`](https://docs.python.org/3.14/library/re.html#re.search),
> [Built-in Constants — `Ellipsis`, `NotImplemented`](https://docs.python.org/3.14/library/constants.html),
> [Built-in Exceptions](https://docs.python.org/3.14/library/exceptions.html),
> [`enum`](https://docs.python.org/3.14/library/enum.html),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html),
> [`copy`](https://docs.python.org/3.14/library/copy.html),
> [`warnings` — Warning Categories](https://docs.python.org/3.14/library/warnings.html#warning-categories),
> [The `match` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-match-statement);
> [PEP 484 § Exceptions](https://peps.python.org/pep-0484/#exceptions),
> [PEP 604](https://peps.python.org/pep-0604/),
> [PEP 561](https://peps.python.org/pep-0561/#packaging-type-information),
> [PEP 661 — Sentinel Values](https://peps.python.org/pep-0661/);
> [typeshed's stubs for `dict.get`](https://github.com/python/typeshed/blob/main/stdlib/builtins.pyi)
> and [mypy — Literal types and Enums](https://mypy.readthedocs.io/en/stable/literal_types.html).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**Every other chapter of this topic asks what *you* should write in front of an operation.
This one asks who decided that for you. A function's failure channel — raise, return
`None`, return a sentinel, return a tagged union — is chosen once by its author and paid
for at every call site for the life of the API, and the two channels are not symmetrical
in the one place it matters. A return type is machine-readable: `X | None` is a type the
checker refuses to let anyone use until they narrow it, so one annotation becomes a
mandatory `if` in every caller, including the ninety who knew the value was there. What a
function *raises* is a rumour. PEP 484 says so in as many words — *"No syntax for listing
explicitly raised exceptions is proposed. Currently the only known use case for this
feature is documentational"* — so no checker will ever report a call site as newly wrong
because you added a `raise`. Choosing `None` is therefore choosing LBYL on other people's
behalf; choosing to raise is choosing a contract nothing enforces.**

That asymmetry has one consequence people meet as an outage rather than as a rule:
swapping a `raise` for a `None` return is the most silent breaking change available in
Python. Nothing raises, no test fails, every caller keeps compiling, and their `except`
blocks simply stop running. There is no deprecation mechanism for it, because the only
part of the raising contract that reaches a call site is the function's **name** — which
is why `dict` ships three spellings of one lookup and why the migration for a channel
change is a rename rather than an edit.

The chapter runs in three movements. **01–03** are the raising channel and what it cannot
tell anyone. **04–08** are the returning channel: the bill it charges, which value may
serve as a sentinel, what to do when `None` is itself legitimate data, and how `@overload`
stops the bill being charged to callers who opted out. **09–10** are the third option —
putting every outcome in the signature as a union — and the construct that keeps it honest
when somebody adds a variant.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Type checkers and silent APIs](01-type-checkers-and-silent-apis.md)** | A signature as half a contract — the return type enforced at every call site, the raise invisible; PEP 484's refusal quoted in full and the reasoning behind it; the Java checked-exception contrast drawn precisely rather than as a slogan; and what the missing half actually costs a caller |
| 2 | **[The raising contract](02-the-raising-contract.md)** | The only type-level tool the raising channel has — `typing.Never`, whose real job is stopping a raising helper from destroying its caller's narrowing when you factor a guard out; then the `Raises:` docstring section PEP 484 named as the alternative to the syntax it declined; and what neither of them can do |
| 3 | **[Versioning the failure channel](03-versioning-the-failure-channel.md)** | 🔴 The change nothing reports: raise → `None`, where no test fails and every `except` clause quietly stops running; the migration that does work — a new name beside the old one; the name as the only part of the raising contract visible at a call site; and the six possible channel changes with what each one breaks |
| 4 | **[The bill every caller pays](04-the-bill-every-caller-pays.md)** | `X \| None` itemised as what it is — LBYL imposed by decree, one mandatory narrowing `if` per call site, charged to callers who never got a vote; and the test that separates the honest cases from the rest: how many meanings does this `None` carry, and does the caller actually have a decision to make — which `dict.get` passes and most `find_user` functions do not |
| 5 | **[Choosing a sentinel](05-choosing-a-sentinel.md)** | The one rule: a sentinel must not be a member of the success type; `str.find` returning `-1` from inside the `int` it is annotated to return, so nothing can compel a caller to test for it — the two famous bugs that follow, against `re.search` returning `None` and producing neither; and collections, where `[]` already says "nothing found" and a sentinel is not needed at all |
| 6 | **[The sentinel object](06-the-sentinel-object.md)** | The day `None` becomes legitimate data and stops distinguishing anything — a cache that can store a null and re-fetches for ever, a `PATCH` endpoint where "leave it alone" and "clear it" arrive identically; and the third object whose entire purpose is to be distinguishable, done correctly at runtime |
| 7 | **[Typing the sentinel](07-typing-the-sentinel.md)** | Why `MISSING = object()` works at runtime and destroys the signature — `object` is the supertype of everything, so the union that admits the sentinel admits a `list`, a `Decimal` and a socket; PEP 661's three drawbacks of the idiom, including the copy and pickle identity trap; the single-member enum that actually types on 3.14; and what `sentinel()` gives you in **3.15** |
| 8 | **[Overloads](08-overloads.md)** | The case where the failure contract is not one fact: `dict.get` returns `V \| None` or `V` depending on an argument, and typeshed gives it three overloads to say so; the documentation's *"for the benefit of the type checker only"* and what that means at runtime; writing your own; and this as the direct answer to chunk 4 — only the callers who declined a default pay the bill |
| 9 | **[Union returns](09-union-returns-and-exhaustiveness.md)** | The tagged union return, which puts every failure in the signature — the one thing the exception channel structurally cannot do; and the four costs stated honestly, all specific to Python: no propagation operator, nothing forcing a caller to inspect the value, no traceback beyond what you remembered to attach, and a standard library that reports failure the other two ways — hence the layer it belongs at, and nowhere above it |
| 10 | **[Exhaustiveness and `assert_never`](10-exhaustiveness-and-assert-never.md)** | How a union return loses its guarantee: add a fourth variant and every `if`/`elif` that handled three still compiles, falls off the end and returns `None`; `assert_never` as the one construct that turns that into a type error, and the bottom-type mechanism it uses; 🔴 that it is a *function call*, not the `assert` statement, so it survives `-O` where `assert False` does not; and the same trick for enums, literals and `match` |

## The one paragraph the whole chapter expands

The failure channel is part of the signature or it is a rumour, and Python only gives you
the first for return values. `X | None` is checked at every call site, which is its virtue
and its whole cost: it converts your one decision into everyone else's mandatory `if`, so
it earns its place only where the caller genuinely has something to decide and the `None`
carries exactly one meaning. Raising costs callers nothing until it changes, at which point
it costs them everything silently, because no checker compares the raises in a signature —
there are none — and no deprecation warning fires for an `except` clause that has stopped
matching. Between those two, the details are rules with sharp edges: a sentinel is only a
sentinel if it is outside the success type, which is the entire difference between `-1` and
`None`; when `None` is real data you need a third object, and giving that object a type on
3.14 means an enum rather than `object()`, until PEP 661 lands `sentinel()` in 3.15;
`@overload` exists so that a channel decided by an argument can be told to the checker
rather than to a docstring; and a tagged union buys you every outcome in the signature at
the price of four things Rust has and Python does not. Whatever you pick, the name is the
only part of the contract that travels to the call site, so change the channel by changing
the name.

## Where this connects

- **[05i · The check is the rule](../05i-the-check-is-the-rule.md)** is the chunk this
  chapter grows out of — the difference between a check that duplicates a failure the
  operation already reports and one that manufactures the only report there will be. This
  chapter asks who the report is *for*.
- **[05 · Where LBYL is right](../05-where-lbyl-is-right.md)** is the other half of the
  argument in chunk 4: returning `None` conscripts every caller into the LBYL that chunk
  justifies only at a trust boundary.
- **[05b · `assert` is not validation](../05b-assert-is-not-validation.md)** is why chunk
  10 makes so much of `assert_never` being a function call — the `assert` statement is the
  one construct `-O` deletes.
- **[03 · Mappings: the decision table](../03-mappings-the-decision-table.md)** is the same
  design decision seen from the caller's side: `d[k]`, `d.get(k)` and `d.get(k, x)` are one
  operation with three published failure channels, which is chunk 3's rename rule already
  shipped.
- **[06 · Narrowing the try](../06-narrowing-the-try.md)** is what a caller must do with a
  raising API, and the next chunk after this chapter.
- **[07g · Provability and the order](../07g-provability-and-the-order-to-decide.md)**
  states the asymmetry this chapter is built on in one line: an `if` narrows a type and an
  `except` handler is not among the constructs mypy documents for narrowing.
- **[Truthiness — empty versus missing](../../05-truthiness/02-empty-versus-missing.md)**
  and
  **[tri-states at an API boundary](../../05-truthiness/02c-tri-states-and-the-api-boundary.md)**
  own the runtime half of chunks 5 and 6: why `if not result:` conflates the sentinel with
  a legitimate empty value.
- **[Exceptions](../../11-exceptions/README.md)** owns the channel itself — the hierarchy
  that makes a raise informative, chaining, and custom exception classes, which is what a
  raising contract is written in.
- **[`None` and the no-result contract](../../14-none-and-no-result/README.md)** is the
  topic that takes the returning channel further than this chapter needs it.
- **Phase 2 — Functions** owns the signature this chapter keeps annotating: defaults,
  keyword-only arguments and the `@overload` stubs' relationship to the single real
  implementation.

---

← Prev: [The check is the rule](../05i-the-check-is-the-rule.md) · Index: [EAFP vs LBYL](../README.md) · Next → [Type checkers and silent APIs](01-type-checkers-and-silent-apis.md)
