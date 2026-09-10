---
title: "`~=` is not a caret and not a tilde — it is a lower bound plus a prefix match whose width is however many segments you happened to type, which is why `~=1.4` and `~=1.4.2` differ by a whole major series"
sidebar_label: "07 · `~=` and the missing caret"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/)),
> **PEP 440** ([peps.python.org](https://peps.python.org/pep-0440/)), pip's
> **Dependency resolution** topic
> ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/dependency-resolution/)) and uv's CLI
> reference for `--bounds`
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/), **uv 0.12.12**). Target:
> **Python 3.14.7**. Documentation-verified, **no sandbox run** — every expansion below is the
> specification's own.

**Python has no caret operator, and `~=` is the thing people reach for instead. It is not
equivalent. `~=` expands to a lower bound plus a prefix match, and the *width* of that prefix is
determined by how many segments you wrote — so `~=1.4` permits `1.99` while `~=1.4.2` stops at
`1.5.0`, and `~=1.4.2.0` stops at `1.4.3`. Nothing about it references a "major" or a "minor",
because PEP 440 has no such concepts. Once you can expand `~=` by hand you will stop treating it
as a compatibility promise and start treating it as shorthand.**

## The expansion

> *"A compatible release clause consists of the compatible release operator `~=` and a version
> identifier. It matches any candidate version that is expected to be compatible with the specified
> version."*

> *"For a given release identifier `V.N`, the compatible release clause is approximately equivalent
> to the pair of comparison clauses: `>= V.N, == V.*`"*

Read `V.N` as "everything except the last segment you wrote" (`V`) plus "the last segment you wrote"
(`N`). The lower bound keeps the whole thing; the prefix match drops the final segment. So the width
of the ceiling is a direct function of how much you typed:

| Written | Expands to | Ceiling sits at |
|---|---|---|
| `~=2.2` | `>= 2.2, == 2.*` | the next **major** |
| `~=1.4.5` | `>= 1.4.5, == 1.4.*` | the next **minor** |
| `~=1.4.5.0` | `>= 1.4.5.0, == 1.4.5.*` | the next **patch** |
| `~=2.2.0` | `>= 2.2.0, == 2.2.*` | the next **minor** |

The specification's own worked pairs:

> *"`~= 2.2` → `>= 2.2, == 2.*`"* and *"`~= 1.4.5` → `>= 1.4.5, == 1.4.*`"*

and its explicit statement that trailing zeros are a *control*, not decoration:

> *"The padding rules for release segment comparisons means that the assumed degree of forward
> compatibility in a compatible release clause can be controlled by appending additional zeros to the
> version specifier"* — `~= 2.2.0` → `>= 2.2.0, == 2.2.*`; `~= 1.4.5.0` → `>= 1.4.5.0, == 1.4.5.*`.

One hard prohibition:

> *"This operator MUST NOT be used with a single segment version number such as `~=1`."*

`~=1` is invalid, not "any 1.x" — there is nothing left to prefix-match on once you drop the only
segment. Tools reject the specifier.

pip's documentation restates the same rule from the other direction, which is a useful sanity check
on your own reading:

> *"Compatible versions are higher versions that only differ in the final segment. `~=3.1.2` is
> equivalent to `>=3.1.2, ==3.1.*`. `~=3.1` is equivalent to `>=3.1, ==3.*`."*

## Pre-release and post-release suffixes are ignored for the prefix

> *"If a pre-release, post-release or developmental release is named in a compatible release clause as
> `V.N.suffix`, then the suffix is ignored when determining the required prefix match"*

The spec's two examples:

```text
~= 2.2.post3     →  >= 2.2.post3, == 2.*
~= 1.4.5a4       →  >= 1.4.5a4, == 1.4.*
```

So `~=1.4.5a4` does **not** mean "the 1.4.5 pre-release series". It means "at least `1.4.5a4`, and
within `1.4.*`" — a much wider set than it looks, because the suffix only moves the floor.

## The specification's own examples, in full

> *"`~=3.1`: version 3.1 or later, but not version 4.0 or later. · `~=3.1.2`: version 3.1.2 or later,
> but not version 3.2.0 or later. · `~=3.1a1`: version 3.1a1 or later, but not version 4.0 or later.
> · `== 3.1`: specifically version 3.1 (or 3.1.0), excludes all pre-releases, post releases,
> developmental releases and any 3.1.x maintenance releases. · `== 3.1.*`: any version that starts
> with 3.1. Equivalent to the `~=3.1.0` compatible release clause. · `~=3.1.0, != 3.1.3`: version
> 3.1.0 or later, but not version 3.1.3 and not version 3.2.0 or later."*

Two things to lift out of that list. First, `== 3.1.*` and `~=3.1.0` are *the same set*, stated by
the spec itself — so if a reviewer finds `~=` unreadable, `==X.Y.*` is an exact synonym for the
common case. Second, `~=3.1a1` reaches all the way to `4.0`, which almost nobody predicts.

## Why there is no caret

A caret in npm or Cargo means "compatible according to semver": breaking changes only ever bump the
major, so `^1.4.2` may safely take `1.99.0`. That is a *publisher promise*, and PEP 440 never made
it. As [01](01-pep-440-the-version-itself.md) sets out, the only structural requirement in the whole
specification is that final releases increase consistently; the meaning of each component is left to
the project.

So `~=` cannot be a compatibility operator, because there is nothing to derive compatibility from. It
is a text shortcut for a bound pair. The consequences:

- **`~=1.4.2` is not `^1.4.2`.** The caret would allow `1.99.0`; `~=1.4.2` stops at `1.5.0`. The
  closest `~=` equivalent to a caret is `~=1.4` — which allows `1.99` but *not* `1.4.1` if you also
  wanted a `1.4.2` floor. To express a caret exactly, write both clauses: `>=1.4.2,<2`.
- **`~=1.4.2` is not npm's `~1.4.2` either**, though it is close: npm's tilde allows `1.4.x`, and so
  does `~=1.4.2`. The difference is at the floor, where `~=` includes the version you named.

uv will write the caret form for you, and its own documentation makes the analogy explicitly:

> *"`major`: Allow the same major version, similar to the semver caret, e.g., `>=1.2.3, <2.0.0` ·
> `minor`: Allow the same minor version, similar to the semver tilde, e.g., `>=1.2.3, <1.3.0`"*

```bash
uv add --bounds major httpx      # >=X.Y.Z,<X+1.0.0 — a caret, written out as two clauses
uv add --bounds minor httpx      # >=X.Y.Z,<X.Y+1.0 — a tilde, written out as two clauses
```

Prefer the written-out form in published metadata. `>=1.4.2,<2` says what it means to a reader who
has never memorised the `~=` expansion table — which is most readers, including you in a year.

## Choosing between the three spellings

| Intent | Spelling | Why |
|---|---|---|
| "at least this, no ceiling" | `>=1.4.2` | the library default; nothing to retire later |
| "this series only" | `==1.4.*` | reads unambiguously; identical to `~=1.4.0` |
| "up to the next major" | `>=1.4.2,<2` | explicit; a reviewer needs no lookup table |
| "up to the next major", terse | `~=1.4` | correct, but loses the `1.4.2` floor |
| "exactly this" | `==1.4.2` | applications and locks only ([04](04-equality-and-exclusion.md)) |

The row worth staring at is the fourth. `~=1.4` and `>=1.4.2,<2` are both "up to the next major", and
they differ in the floor: `~=1.4` accepts `1.4` itself. If you genuinely need both the `1.4.2` floor
*and* the major ceiling, `~=` cannot express it in one clause — you need `>=1.4.2,<2` or
`~=1.4,>=1.4.2`, and the first is plainly better.

## Gotchas

**★ Symptom: `~=1.4.2` refuses to install `1.5.0`, which the team believed was allowed.** Cause: the
prefix match drops only the final segment, so the ceiling is `1.4.*`. Fix: decide which you meant and
write it explicitly:

```text
# "any 1.x from 1.4.2 onwards" — what people usually mean by a caret
mypkg>=1.4.2,<2
# "any 1.4.x from 1.4.2 onwards" — what ~=1.4.2 actually says
mypkg~=1.4.2
```

**★ Symptom: `~=1` is rejected as an invalid specifier.** Cause: *"This operator MUST NOT be used with
a single segment version number such as `~=1`."* Fix: `>=1,<2`, or just `>=1` if you did not actually
want a ceiling.

**★ Symptom: `~=3.1a1` pulled in `3.9`, far past what a "pre-release pin" implied.** Cause: the
suffix is ignored for the prefix — *"then the suffix is ignored when determining the required prefix
match"* — so the clause is `>=3.1a1, ==3.*`. Fix: if you meant "the 3.1 pre-release line", say so:

```text
mypkg>=3.1a1,<3.2
```

**★ Symptom: two developers disagree about whether `~=2.2` and `~=2.2.0` are the same.** Cause: they
are not, and the difference is a whole minor series: `~=2.2` → `>= 2.2, == 2.*`, while `~=2.2.0` →
`>= 2.2.0, == 2.2.*`. Fix: ban trailing-zero `~=` from the codebase and use `==X.Y.*` when you mean a
series — the spec confirms they are equivalent, and one of them is readable.

**★ Symptom: a `~=` bound on a date-versioned dependency expires at the new year.** Cause: `~=2024.1`
expands to `>=2024.1, ==2024.*`, and the components mean nothing about compatibility. Fix: for
date-versioned dependencies use a floor plus a known-bad exclusion; there is no series to bound,
because "series" is not a concept the versions carry.

**★ Symptom: a caret copied from a JavaScript project is accepted by Poetry and rejected by every
standards-based tool.** Cause: `^1.4.2` is `[tool.poetry.dependencies]` syntax, not a PEP 440
operator; standard `[project.dependencies]` must contain valid dependency specifiers, and PEP 631 is
explicit — *"Build backends SHOULD abort at load time for any parsing errors."* Fix: translate it
during migration:

```toml
# Poetry:  httpx = "^0.27.2"
# standard:
dependencies = ["httpx>=0.27.2,<0.28"]   # note: for 0.x, a caret bounds the MINOR
```

That last comment is the trap inside the trap: semver treats `0.y.z` specially, so a caret on a
`0.x` version bounds the minor, not the major. Translating `^0.27.2` to `>=0.27.2,<1` widens the
range far beyond what the original said.

**★ Symptom: `~=` in a library and a consumer cannot resolve.** Cause: `~=` always implies a ceiling,
so every `~=` in published metadata is an upper bound with all the intersection problems of
[06](06-floors-and-ceilings.md) — but written in a form where reviewers do not notice it is a
ceiling. Fix: in a library, prefer `>=` with an explicit `<` only where you have evidence; reserve
`~=` for applications, where a ceiling costs nobody else anything.

**★ Symptom: `~=1.4.5` and `>=1.4.5,==1.4.*` behave differently in one tool.** Cause: the expansion is
*"approximately equivalent"* — the spec's own hedge — and the hedge exists because pre-release handling
and normalization are applied to the whole clause set, not clause by clause. In practice they agree;
if you find a case where they do not, trust `~=`, which is the operator the resolver actually
implements, and report the difference rather than working around it.

## Interview questions

**★ Expand `~=1.4.2`, `~=1.4` and `~=1.4.2.0`, and say what each ceiling is.**
`~=1.4.2` → `>=1.4.2, ==1.4.*`, ceiling at `1.5.0`. `~=1.4` → `>=1.4, ==1.*`, ceiling at `2.0`.
`~=1.4.2.0` → `>=1.4.2.0, ==1.4.2.*`, ceiling at `1.4.3`. The pattern is that the prefix match drops
exactly the last segment you wrote, so the number of components you type chooses the ceiling — which
is why *"the assumed degree of forward compatibility … can be controlled by appending additional
zeros."*

**★ Is `~=1.4.2` the same as `^1.4.2`?**
No, and the difference is a whole major series. A caret means "any release that semver says is
compatible", i.e. up to but excluding `2.0.0`, so `1.99.0` is allowed. `~=1.4.2` allows only `1.4.x`.
The nearest `~=` form to a caret is `~=1.4`, which reaches `2.0` — but loses the `1.4.2` floor, since
`~=1.4` accepts `1.4` itself. If you want caret semantics with a precise floor, there is no single
clause: write `>=1.4.2,<2`.

**★ Why does Python not have a caret operator?**
Because a caret encodes a publisher promise — breaking changes only in the major — and PEP 440 makes
no such promise. It standardises ordering and identity and leaves component meaning to the project;
its only structural rule is that final releases increase consistently. With no semver guarantee to
derive from, the specification could only offer a mechanical shorthand, which is what `~=` is. uv's
`--bounds major` fills the ergonomic gap by *writing out* `>=X.Y.Z, <X+1.0.0`, which is honest: the
ceiling is a choice you made, not a fact the version format supplied.

**★ A reviewer says `~=` is unreadable and wants it replaced. What do you offer?**
`==X.Y.*` for "this series" — the spec states it is equivalent to `~=X.Y.0` — and `>=X.Y.Z,<N` for
"up to the next major". Both are self-explanatory to someone who has never seen the expansion table,
which is the actual argument: `~=` is correct and terse, and terse is worth less than obvious in a
file that outlives its author. The one thing not to offer is a caret, which is not valid in standard
metadata.

**★ You are migrating a `pyproject.toml` from Poetry and it is full of carets. What is the risk?**
Two. First, translating `^X.Y.Z` mechanically to `>=X.Y.Z,<X+1` is wrong for `0.x` versions: semver
bounds the *minor* for `0.y.z`, so `^0.27.2` means `>=0.27.2,<0.28`, and the naive translation
`>=0.27.2,<1` silently widens the range across releases the author never allowed. Second, you inherit
a ceiling on every dependency, and most of them were never justified — a Poetry-era `pyproject.toml`
is usually a list of speculative upper bounds. Translate faithfully first so the behaviour is
unchanged, then remove the unjustified ceilings deliberately in a separate commit.

---

← [06 · Floors and ceilings](06-floors-and-ceilings.md) · [Topic index](README.md) · Next → [08 · Pre-releases are excluded](08-pre-releases-are-excluded.md)
