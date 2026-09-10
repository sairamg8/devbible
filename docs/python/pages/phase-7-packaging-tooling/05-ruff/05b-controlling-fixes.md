---
title: "Which fixes run is configurable on two independent axes — `fixable`/`unfixable` decide whether a rule may be fixed at all, `extend-safe-fixes`/`extend-unsafe-fixes` move a rule's fixes between safe and unsafe — and `--diff`, `--fix-only` and `--exit-non-zero-on-fix` decide what a fixing run reports and exits with"
sidebar_label: "05b · Controlling fixes"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Linter: Fix safety, Disabling fixes, Exit codes*
> ([docs.astral.sh](https://docs.astral.sh/ruff/linter/#fixes)), settings reference for [`fix`](https://docs.astral.sh/ruff/settings/#fix),
> [`unsafe-fixes`](https://docs.astral.sh/ruff/settings/#unsafe-fixes), [`lint.fixable`](https://docs.astral.sh/ruff/settings/#lint_fixable),
> [`lint.unfixable`](https://docs.astral.sh/ruff/settings/#lint_unfixable), [`lint.extend-safe-fixes`](https://docs.astral.sh/ruff/settings/#lint_extend-safe-fixes)
> and [`lint.extend-unsafe-fixes`](https://docs.astral.sh/ruff/settings/#lint_extend-unsafe-fixes); `ruff help check` as published for 0.16.6
> in *Configuring Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)); *Editors: Features* ([docs.astral.sh](https://docs.astral.sh/ruff/editors/features/)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**Two separate questions decide what `--fix` does to a given violation. First: is this rule
allowed to be fixed at all? That is `fixable` and `unfixable`, and the default is that every
rule is fixable. Second: is this rule's fix safe or unsafe? That is the rule's own label, which
you can override in either direction with `extend-safe-fixes` and `extend-unsafe-fixes`. Only
fixes that pass both gates — fixable, and safe or unsafe-fixes-enabled — are applied. Around
that sit the reporting flags: `--diff` shows the edit without writing it, `--fix-only` writes it
without complaining about the rest, and `--exit-non-zero-on-fix` makes "I fixed something" a
failure, which is what a hook that must not silently rewrite code wants.**

## Gate 1 — may this rule be fixed?

> *"To limit the set of rules that Ruff should fix, use the `lint.fixable` or `lint.extend-fixable`, and `lint.unfixable` settings."*
> — [The Ruff Linter: Disabling fixes](https://docs.astral.sh/ruff/linter/#disabling-fixes)

`fixable` defaults to `["ALL"]` — *"By default, all rules are considered fixable."* The two
shapes the docs show:

```toml
[tool.ruff.lint]
fixable = ["ALL"]
unfixable = ["F401"]    # report unused imports, never delete them automatically
```

```toml
[tool.ruff.lint]
fixable = ["F401"]      # the only rule --fix may touch
```

`fixable` and `unfixable` resolve like `select` and `ignore`: by specificity, with `unfixable`
winning a tie the way `ignore` does (the 0.16.6 source runs both pairs through the same loop).
The command line has `--fixable`, `--unfixable` and `--extend-fixable`, *"Only applicable when
fix itself is enabled (e.g., via `--fix`)."*

A common use is protecting code from edits that are correct in general and disruptive locally —
`F401` in a package that uses import side effects, or `B` rules whose fixes the team wants to
read before accepting:

```toml
[tool.ruff.lint]
extend-select = ["B"]
unfixable = ["B"]        # the configuration page's own example: report bugbear, never auto-fix it
```

## Gate 2 — is this rule's fix safe?

> *"The safety of fixes can be adjusted per rule using the `lint.extend-safe-fixes` and `lint.extend-unsafe-fixes` settings."*

> *"For example, the following configuration would promote unsafe fixes for `F601` to safe fixes and demote safe fixes for `UP034` to unsafe fixes"*

```toml
[tool.ruff.lint]
extend-safe-fixes = ["F601"]
extend-unsafe-fixes = ["UP034"]
```

> *"You may use prefixes to select rules as well, e.g., `F` can be used to promote fixes for all rules in Pyflakes to safe."*

Promotion is a statement about *your* codebase: "we have reviewed this rule's unsafe fix
enough times to trust it here." Demotion is the opposite: "this safe fix touches code we want a
person to see."

## The switches that turn fixing on

| Setting / flag | Effect |
|---|---|
| `--fix` / `--no-fix` | apply fixes this run / do not |
| `fix = true` | *"Enable fix behavior by-default when running `ruff` (overridden by the `--fix` and `--no-fix` command-line flags). Only includes automatic fixes unless `--unsafe-fixes` is provided."* |
| `--unsafe-fixes` / `--no-unsafe-fixes` | include unsafe fixes / do not |
| `unsafe-fixes = true` | apply unsafe fixes by default — CLI, editor "Fix all", everywhere |
| `unsafe-fixes = false` | never apply them, and hide the hint: *"If set to false, the hint will be hidden."* |

`unsafe-fixes` defaults to unset, which is its own state: *"If excluded, a hint will be
displayed when unsafe fixes are available."*

## What a fixing run reports, and what it exits with

From the 0.16.6 `ruff help check`:

- `--diff` — *"Avoid writing any fixed files back; instead, output a diff for each changed file
  to stdout, and exit 0 if there are no diffs. Implies `--fix-only`"*
- `--fix-only` — *"Apply fixes to resolve lint violations, but don't report on, or exit non-zero
  for, leftover violations. Implies `--fix`."*
- `--show-fixes` — *"Show an enumeration of all fixed lint violations."*
- `--exit-non-zero-on-fix` — *"Exit with a non-zero status code if any files were modified via
  fix, even if no lint violations remain"*

And the exit-code rule those flags modify:

> *"`0` if no violations were found, or if all present violations were fixed automatically."* · *"`1` if violations were found."*

> *"`--exit-non-zero-on-fix` will cause Ruff to exit with a status code of `1` if violations were found, even if all such violations were fixed automatically. Note that the use of `--exit-non-zero-on-fix` can result in a non-zero exit code even if no violations remain after fixing."*
> — [The Ruff Linter: Exit codes](https://docs.astral.sh/ruff/linter/#exit-codes)

Put together, four recipes cover almost every real use:

```bash
uv run ruff check --diff .                        # preview safe fixes, change nothing
uv run ruff check --fix .                         # developer: fix what is safe, report the rest
uv run ruff check --fix --exit-non-zero-on-fix .  # a script that must fail if it rewrote anything
uv run ruff check --fix-only --select I .         # a formatter-like pass: sort imports, no report
```

In JSON output the label travels with the fix: *"All fixes will always be displayed by Ruff when
using the `json` output format. The safety of each fix is available under the `applicability`
field."* The 0.16.6 source serialises it in lower case — `safe`, `unsafe`, `displayonly`.

## Gotchas

**★ Symptom: a script runs `ruff check --fix` on a branch, exits `0`, and the commit it produced
contains edits nobody reviewed.** Cause: exit `0` means *"all present violations were fixed
automatically"* — success, from ruff's point of view. Fix: make modification itself a failure
where edits must be seen.

```bash
uv run ruff check --fix --exit-non-zero-on-fix .
```

**★ Symptom: `unsafe-fixes = true` in `pyproject.toml` "to make CI stricter" started rewriting
code through everyone's editor "Fix all".** Cause: the setting is not CI-specific — the editor
documentation says *"Fix all"* applies unsafe fixes once `unsafe-fixes = true` is in the
configuration. Fix: keep the configuration safe-only and opt in on the command line where you
mean it.

```toml
[tool.ruff]
unsafe-fixes = false     # never apply, and silence the hint
```

**Symptom: `fix = true` in the configuration surprises a developer who ran `ruff check` "just to
look" and found files changed.** Cause: `fix = true` makes fixing the default for every
invocation that does not say `--no-fix`. Fix: remove it and pass `--fix` explicitly, or teach
the read-only form.

```bash
uv run ruff check --no-fix .
```

**Symptom: `--diff` in CI reports nothing and exits `0`, yet the code has violations.** Cause:
`--diff` *"Implies `--fix-only`"* — it shows fixable edits and exits `0` *"if there are no
diffs"*; unfixable violations are not its concern. Fix: run a normal check for the gate and use
`--diff` only as a preview.

```bash
uv run ruff check .                 # the gate
uv run ruff check --diff . || true  # informational: what --fix would change
```

**Symptom: after `unfixable = ["F"]`, unused imports still disappear on save in the editor.**
Cause: the editor is not reading this configuration — a different ruff binary, editor-level
settings taking precedence (`editorFirst` is the default), or a workspace opened at a different
root. Fix: point the editor at the project's configuration and binary (**13** *(not written yet)*).

```json
{
  "ruff.configurationPreference": "filesystemFirst"
}
```

**Symptom: `extend-safe-fixes = ["B006"]` was added to speed up a clean-up and a memoising
function broke later.** Cause: promotion applies the unsafe fix everywhere, forever, including
the intentional-cache case the rule warns about. Fix: promote only rules whose unsafe cases do
not occur in this codebase, and apply one-off unsafe fixes from the command line instead.

```bash
uv run ruff check --select B006 --fix --unsafe-fixes src/billing_api/forms.py
```

**Symptom: a tool consuming `--output-format json` applies every listed fix and breaks code.**
Cause: JSON output lists *all* fixes, safe and unsafe, marking each with an `applicability`
field. Fix: filter on that field before applying anything.

```bash
uv run ruff check --output-format json . | jq '[.[] | select(.fix.applicability == "safe")]'
```

## Interview questions

**★ What is the difference between `unfixable` and `extend-unsafe-fixes`?**
`unfixable` removes a rule from fixing entirely: `--fix` will never touch it, with or without
`--unsafe-fixes`. `extend-unsafe-fixes` keeps the rule fixable but relabels its safe fixes as
unsafe, so plain `--fix` skips them while `--fix --unsafe-fixes` still applies them. Use
`unfixable` for rules whose fixes you never want automated; use `extend-unsafe-fixes` for rules
whose fixes are fine but should be applied deliberately.

**★ What does `ruff check --fix` exit with when it fixed every violation, and how do you make
that a failure?**
`0` — all violations were resolved, which ruff counts as success. That is right for a developer
and wrong for any automated step that must not change code unnoticed. `--exit-non-zero-on-fix`
makes it exit `1` if any fix was applied, even if nothing remains; pre-commit achieves a similar
effect differently, by failing any hook that modifies files.

**When would you use `--fix-only`?**
When fixing is the job and reporting is someone else's: a formatting-style pass such as sorting
imports, a bulk migration of one rule, or a step that is followed by a normal `ruff check` which
does the reporting. `--fix-only` applies fixes and neither reports nor fails on leftover
violations. `--diff` is its dry-run form.

**Why is `unsafe-fixes = true` in shared configuration risky even if CI is the only place you
"meant" it?**
Because configuration is read by every consumer: the CLI, pre-commit, and the editor's "Fix all"
action, which will then apply unsafe fixes on save. A setting that changes what automated edits
may do belongs on the command line of the one job that wants it, not in the file every tool
reads.

---

← Prev: [05 · Fixes and fix safety](05-fixes-and-fix-safety.md) · [Topic index](README.md) · Next → [06 · noqa comments](06-noqa.md)
