---
title: "ruff 0.16.0 grew the default rule set from 59 rules to 413 and dropped 18 old ones, so \"no `select` in the config\" now means something different from what it meant in July 2026 — and `ALL` means something different after every upgrade, by design"
sidebar_label: "03b · The default rule set"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — the *Default Rules* page ([docs.astral.sh](https://docs.astral.sh/ruff/default-rules/),
> read when 0.16.6 was PyPI's latest release), the 0.16.0 changelog entry ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md))
> and release post ([astral.sh](https://astral.sh/blog/ruff-v0.16.0)), the 0.15.2 changelog ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/changelogs/0.15.x.md)),
> *The Ruff Linter* ([docs.astral.sh](https://docs.astral.sh/ruff/linter/)) and *Versioning* ([docs.astral.sh](https://docs.astral.sh/ruff/versioning/)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — rule counts taken from the published list, **no sandbox run**.

**A project that never writes `select` is not "using no configuration" — it is using ruff's
default rule set, and that set is versioned. From ruff 0.1.0 until July 2026 it was 59 rules:
`E4`, `E7`, `E9` and `F`. On 2026-07-23 ruff 0.16.0 replaced it with 413 rules drawn from
bugbear, pyupgrade, isort, Pylint's error rules, ruff's own `RUF` rules and dozens more — and
removed 18 opinionated pycodestyle and pyflakes rules at the same time. Every project that had
relied on the defaults got new diagnostics on upgrade, including `RUF100`, which now reports old
`noqa` comments for rules that are no longer enabled. `ALL` has the same property permanently:
it is defined as "whatever this version has", so every release that promotes a rule changes your
build. This page is what the defaults are now, and how to choose between riding them and pinning
your own.**

## What changed in 0.16.0

> *"Ruff now enables a much larger set of rules by default (413, up from 59). See the blog post for more details and the new Default Rules page for a full listing of the enabled rules. Note that this is primarily an expansion, but 18 of the more opinionated pycodestyle (`E`) and pyflakes (`F`) rules have been removed from the default set: `E401`, `E402`, `E701`, `E702`, `E703`, `E711`, `E712`, `E713`, `E714`, `E721`, `E731`, `E741`, `E742`, `E743`, `F403`, `F405`, `F406`, and `F722`."*
> — [CHANGELOG 0.16.0](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md)

The release post explains why the old set had not moved in years:

> *"Since Ruff's default rule set was last modified in v0.1.0, the number of rules in Ruff has grown from 708 to 968. Many of these rules catch severe issues, including syntax errors and immediate runtime errors but were not previously enabled by default."*
> — [Ruff v0.16.0](https://astral.sh/blog/ruff-v0.16.0)

It had been previewed first: 0.15.2 (2026-02-19) shipped *"a significantly expanded default
rule set of 412 rules"* behind preview, which is the versioning policy working as designed —
*"Stable rules are added to the default set"* is listed as a reason for a **minor** bump.

## What is in the 0.16.6 default set

The Default Rules page lists 413 codes. Grouped by prefix:

| Prefix | Rules | Notable members |
|---|---:|---|
| `F` (pyflakes) | 39 | `F401` unused import, `F841` unused variable, `F821` undefined name |
| `PYI` (flake8-pyi) | 47 | stub-file rules |
| `UP` (pyupgrade) | 42 | `UP006`, `UP007`, `UP035`, `UP045` — all driven by `target-version` |
| `RUF` (ruff-native) | 36 | `RUF100` unused `noqa`, `RUF012`, `RUF015`, `RUF200` invalid `pyproject.toml` |
| `PLE` / `PLW` / `PLR` / `PLC` (Pylint ports) | 33 / 20 / 13 / 8 | error-class rules first |
| `B` (bugbear) | 29 | `B006` mutable default, `B008` call in default |
| `SIM`, `C4`, `FURB` | 21 / 17 / 17 | simplifications |
| `YTT`, `ASYNC`, `DTZ` | 10 each | |
| `PIE`, `PT`, `TRY`, `LOG`, `EXE`, `G`, `TC`, `S`, … | small numbers each | `S` is only `S102`, `S110`, `S112` |
| `I` (isort) | 1 | **`I001` — import sorting is now on by default** |
| `E` / `W` / `D` / `N` | 2 / 1 / 1 / 1 | `E722`, `E902` / `W605` / `D419` / `N999` |

Just as telling is what is **not** there: `E501` (line length), the `D1xx` "missing docstring"
rules, `S101` (assert), `T201` (print), `COM812`, `ISC001`, `ERA001`, `ANN`, `ARG`, and most of
`N8xx`. The rules index states the intent — *"omitting any stylistic rules that overlap with the
use of a formatter, like `ruff format` or Black."*

To see the set your installed ruff actually uses, the settings reference gives the command:
*"See https://docs.astral.sh/ruff/default-rules/ or run `ruff check --show-settings --isolated`"*.

## What an upgrade from 0.15 to 0.16 does to a project with no `select`

Three things arrive at once, and they arrive in CI first if CI floats ruff's version:

1. **Hundreds of new rules run.** Many are autofixable; `UP` and `I001` in particular can
   rewrite a large share of files on the first `ruff check --fix`.
2. **`RUF100` is now enabled**, and the 18 removed rules are no longer selected. `RUF100`
   reports a `noqa` code for a rule that is not enabled — the 0.16.6 message template lists it
   under *"non-enabled"* — so every `# noqa: E402` and `# noqa: E731` in the codebase becomes a
   new violation, and `--fix` deletes them.
3. **`I001` is enabled**, so files that were never isort-clean now fail.

## Ride the defaults, or pin your own

**Option A — explicit `select`.** The linter page recommends it: *"Prefer `lint.select` over
`lint.extend-select` to make your rule set explicit."* Upgrades then change only the *behaviour*
of rules you chose, never the membership. The release post gives the one-liner to keep the
pre-0.16 behaviour:

> *"If you want to revert to the old default set, you can easily `select` the old rules with this configuration:"*

```toml
[tool.ruff.lint]
select = ["E4", "E7", "E9", "F"]     # the pre-0.16 default, frozen
```

A realistic explicit set for a service:

```toml
[tool.ruff.lint]
select = ["E4", "E7", "E9", "F", "B", "UP", "I", "SIM", "RUF"]
ignore = ["B008"]                    # FastAPI's Depends() in argument defaults is intended
```

**Option B — the defaults plus additions.** `extend-select = ["S", "PT"]` rides whatever ruff
ships and adds to it. It gets the new correctness rules automatically; it also means a routine
minor upgrade can fail the build. Pair it with an exact version pin ([12](12-pinning-ruff.md))
so that the upgrade is a deliberate commit.

## `ALL` is a moving target by definition

> *"As a special-case, Ruff also supports the `ALL` code, which enables all rules."*

> *"Use `ALL` with discretion. Enabling `ALL` will implicitly enable new rules whenever you upgrade."*
> — [The Ruff Linter](https://docs.astral.sh/ruff/linter/)

`ALL` does not include preview rules unless preview is on, and it drops one side of each
contradictory pydocstyle pair for you — *"Ruff will automatically disable any conflicting rules
when `ALL` is enabled."* (the 0.16.6 source keeps `D211` over `D203` and `D212` over `D213`). It
does enable rules that fight the formatter, `COM812` among them, which is why every `ALL`
configuration in the wild carries an ignore list:

```toml
[tool.ruff.lint]
select = ["ALL"]
ignore = [
    "COM812",   # conflicts with the formatter
    "D",        # docstring rules: adopt deliberately, not by accident
    "ANN",      # annotations are the type checker's concern
    "S101",     # assert is how pytest works
    "T201",     # print is fine in the CLI module
]
```

With `ALL`, pin ruff exactly and upgrade on purpose — each minor that stabilises rules adds them
to your build.

## Gotchas

**★ Symptom: upgrading ruff to 0.16 in a project with no `select` produced hundreds of new
violations overnight.** Cause: the default set grew from 59 to 413 rules. Fix: either accept the
new defaults and fix (much of it is autofixable), or freeze the old set explicitly and adopt the
new rules deliberately.

```toml
[tool.ruff.lint]
select = ["E4", "E7", "E9", "F"]   # identical to the pre-0.16 default
```

**★ Symptom: after the 0.16 upgrade, `RUF100` flags `# noqa: E402` and `# noqa: E731` all over
the codebase, and `ruff check --fix` deletes them.** Cause: `E402` and `E731` left the default
set, so those suppressions now name *"non-enabled"* rules — and `RUF100` joined the default set
in the same release. Fix: decide per rule. If you still want the rule, select it and the
suppressions become meaningful again; if not, let the fix remove them.

```toml
[tool.ruff.lint]
extend-select = ["E402", "E731"]   # keep enforcing them; the existing noqa comments stay valid
```

**★ Symptom: `select = ["ALL"]` passed yesterday and fails today, with no code change — only a
ruff upgrade.** Cause: *"Enabling `ALL` will implicitly enable new rules whenever you upgrade."*
Fix: pin ruff exactly so upgrades are commits, and review the minor's stabilised rules when you
bump.

```toml
[dependency-groups]
dev = ["ruff==0.16.6"]
```

**Symptom: with `select = ["ALL"]`, `ruff format` prints a warning that a rule *"may cause
conflicts when used with the formatter"*.** Cause: `ALL` includes `COM812`, which the formatter
checks for and warns about. Fix: ignore it ([08](08-formatter-lint-conflicts.md) has the rest of
the list).

```toml
[tool.ruff.lint]
select = ["ALL"]
ignore = ["COM812"]
```

**Symptom: a pull request that only bumped ruff touches import order in forty files.** Cause:
`I001` is in the default set since 0.16.0 and its fix is safe (`Fix::safe_edit` in the 0.16.6
source), so `ruff check --fix` sorted every file. Fix: land the sort as its own commit, separate
from any behaviour change, so review stays readable.

```bash
uv run ruff check --select I --fix . && git commit -am "Sort imports (ruff 0.16 default I001)"
```

**Symptom: a team member's local ruff reports far fewer problems than CI.** Cause: their ruff is
older than 0.16 and the project relies on the defaults, so the two binaries run different rule
sets. Fix: pin the version and make it enforceable ([12](12-pinning-ruff.md)).

```toml
[tool.ruff]
required-version = ">=0.16.6"
```

## Interview questions

**★ What does "ruff's default rule set" mean, and why does it matter which ruff version you
run?**
It is the rule set ruff uses when the configuration has no `select`. It is versioned: up to 0.15
it was 59 rules (`E4`, `E7`, `E9`, `F`); from 0.16.0 it is 413, spanning bugbear, pyupgrade,
isort, Pylint errors, ruff's own rules and more, with 18 older `E` and `F` rules removed. So two
developers with no `select` and different ruff versions are running different linters. Either
pin ruff exactly or write an explicit `select` — ideally both.

**★ Why is `select = ["ALL"]` described as a trap on upgrade?**
Because `ALL` is resolved against the running version, not frozen when you wrote it. Every minor
that promotes preview rules to stable adds them to your build, and the documentation says so:
enabling `ALL` implicitly enables new rules whenever you upgrade. That can be what you want — you
opt into every new check — but only with an exact version pin, so that an upgrade is a reviewed
commit rather than a surprise in CI. It also enables formatter-conflicting rules like `COM812`,
so an `ALL` config always needs an ignore list.

**Why did 0.16 remove rules like `E741` and `E731` from the defaults while adding hundreds?**
The changelog calls them the more opinionated `E` and `F` rules. `E741` flags ambiguous variable
names such as `l`, and `E731` flags assigning a lambda to a name — stylistic judgments, not
bugs. The new default leans towards rules that catch errors and outdated patterns. You can still
select any of them explicitly; they left the default set, not ruff.

**How would you upgrade a large codebase from ruff 0.15 to 0.16 without a thousand-line
diff in one PR?**
Pin the old default set explicitly first (`select = ["E4", "E7", "E9", "F"]`) and upgrade the
binary — the rule set is unchanged, so only rule-behaviour changes surface. Then adopt the new
defaults in slices: one prefix at a time with `extend-select`, applying safe fixes, reviewing
unsafe ones, and using `--add-noqa` to baseline what cannot be fixed yet. Land import sorting
and pyupgrade rewrites as their own mechanical commits.

---

← Prev: [03 · Rule codes and selection](03-rule-codes-and-selection.md) · [Topic index](README.md) · Next → [03c · per-file-ignores](03c-per-file-ignores.md)
