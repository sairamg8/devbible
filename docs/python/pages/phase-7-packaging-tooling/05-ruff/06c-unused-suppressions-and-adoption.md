---
title: "Suppressions rot, so ruff audits them — `RUF100` reports any `noqa` that no longer suppresses something (and, since 0.16.0, runs by default), `lint.external` protects other tools' codes from it, and `--add-noqa`/`--add-ignore` let you adopt a strict rule set on a legacy codebase today by recording every existing violation as an explicit, removable debt"
sidebar_label: "06c · Unused suppressions and adoption"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Linter: Detecting unused suppressions, Inserting necessary suppression comments*
> ([docs.astral.sh](https://docs.astral.sh/ruff/linter/#detecting-unused-suppressions)), the rule pages for [`unused-noqa` (RUF100)](https://docs.astral.sh/ruff/rules/unused-noqa/)
> and [`invalid-rule-code` (RUF102)](https://docs.astral.sh/ruff/rules/invalid-rule-code/), settings reference for [`lint.external`](https://docs.astral.sh/ruff/settings/#lint_external),
> the *Tutorial: Adding Rules* ([docs.astral.sh](https://docs.astral.sh/ruff/tutorial/)), the *Default Rules* page ([docs.astral.sh](https://docs.astral.sh/ruff/default-rules/));
> `RUF100` message template read in `crates/ruff_linter/src/rules/ruff/rules/unused_noqa.rs` at the `0.16.6` tag
> ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff_linter/src/rules/ruff/rules/unused_noqa.rs)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**A suppression comment is a claim: "this line violates rule X, and that is fine". Code changes
and the claim stops being true — the violation is fixed, the rule is renamed, the rule is no
longer selected — but the comment stays, now suppressing nothing, or worse, waiting to hide the
next real problem on that line. `RUF100` is ruff's audit of those claims; since 0.16.0 it is in
the default rule set, so most projects run it whether they chose to or not. The same machinery
runs in reverse for adoption: `--add-noqa` writes a suppression on every line that currently
violates, turning "we cannot enable this rule, there are 800 violations" into "the rule is on
today, and 800 lines are marked as known debt".**

## `RUF100` — suppressions that no longer suppress

> *"Ruff implements a special rule, `unused-noqa`, under the `RUF100` code, to enforce that your suppressions are "valid", in that the violations they say they ignore are actually being triggered and suppressed."*
> — [The Ruff Linter](https://docs.astral.sh/ruff/linter/#detecting-unused-suppressions)

```bash
ruff check /path/to/file.py --extend-select RUF100          # report
ruff check /path/to/file.py --extend-select RUF100 --fix    # remove
```

From **0.16.0** `RUF100` is on the Default Rules page, so with no `select` of your own the
`--extend-select` is unnecessary. The 0.16.6 source composes its message from up to three
reasons per comment — ``Unused `noqa` directive (unused: …; non-enabled: …; duplicated: …)`` —
and uses *"suppression"* instead of *"`noqa` directive"* for `ruff: ignore`-family comments. The
middle reason is the one that surprises people:

| Reason in the message | Meaning | Typical cause |
|---|---|---|
| `unused` | the rule is enabled but did not fire on that line | the code was fixed |
| `non-enabled` | the rule is not selected at all | configuration changed — including ruff 0.16.0 dropping 18 rules from the defaults |
| `duplicated` | the same code appears twice in one comment | copy-paste |

Codes ruff does not know are left alone: *"This rule ignores any codes that are unknown to Ruff,
as it can't determine if the codes are valid or used by other tools. Enable `invalid-rule-code`
to flag any unknown rule codes."*

### `RUF100 --fix` and other tools' comments

The fix can take more than the `noqa` with it:

> *"When using `RUF100` with the `--fix` option, Ruff may remove trailing comments that follow a `# noqa` directive on the same line, as it interprets the remainder of the line as a description for the suppression."*

> *"To prevent Ruff from removing suppressions for other tools (like `pylint` or `mypy`), separate them with a second `#` character"*

```python
# Bad: Ruff --fix will remove the pylint comment
def visit_ImportFrom(self, node):  # noqa: N802, pylint: disable=invalid-name
    pass


# Good: Ruff will preserve the pylint comment
def visit_ImportFrom(self, node):  # noqa: N802 # pylint: disable=invalid-name
    pass
```

## `RUF102` and `lint.external` — codes from other tools

`RUF102` (`invalid-rule-code`, added in 0.15.0) is the complement: *"Checks for `noqa` codes that
are invalid."* It flags codes ruff has never heard of — *"even if they are valid for other
tools."* When a flake8 plugin still runs beside ruff, declare its prefix:

> *"A list of rule codes or prefixes that are unsupported by Ruff, but should be preserved when (e.g.) validating `# noqa` directives. Useful for retaining `# noqa` directives that cover plugins not yet implemented by Ruff."*
> — [settings: `lint.external`](https://docs.astral.sh/ruff/settings/#lint_external)

```toml
[tool.ruff.lint]
extend-select = ["RUF102"]
external = ["V"]     # the settings reference's example: keep vulture's V codes in noqa comments
```

## Adopting a rule on a legacy codebase

> *"Ruff can automatically add suppression comments to all lines that contain violations, which is useful when migrating a new codebase to Ruff."*

The tutorial frames the workflow:

> *"When enabling a new rule on an existing codebase, you may want to ignore all existing violations of that rule and instead focus on enforcing it going forward."*

```bash
uv run ruff check --select UP035 --add-noqa .
```

The documented result is a trailing `# noqa: UP035` on each violating line. The full procedure,
one rule family at a time:

```bash
# 1. Size the job: violation counts per rule.
uv run ruff check --select B --statistics .

# 2. Take every safe fix, as its own reviewable commit.
uv run ruff check --select B --fix .
git commit -am "ruff: apply safe bugbear fixes"

# 3. Baseline what is left, with a reason future readers can grep for.
uv run ruff check --select B --add-noqa="baseline 2026-09 ruff adoption" .
git commit -am "ruff: baseline remaining bugbear violations"

# 4. Enforce the rule for new code (add "B" to select in pyproject.toml), and burn the baseline down.
git grep -n "baseline 2026-09 ruff adoption" | wc -l
```

`--add-noqa[=<REASON>]` and `--add-ignore[=<REASON>]` both take the optional reason; the second
writes `ruff: ignore[...]` comments instead (0.16.0+). Once baselined, `RUF100` does the rest:
every time someone fixes a baselined line, the comment becomes `unused` and `--fix` removes it.

## Gotchas

**★ Symptom: upgrading to ruff 0.16 produced dozens of `RUF100` violations for comments like
`# noqa: E402` that "definitely still apply".** Cause: `E402` is no longer in the default set, so
the code is *non-enabled* — the comment suppresses a rule that does not run — and `RUF100` joined
the defaults in the same release. Fix: if you still want the rule, select it; the comments become
valid again.

```toml
[tool.ruff.lint]
extend-select = ["E402"]
```

**★ Symptom: `ruff check --fix` deleted `# pylint: disable=invalid-name` along with an unused
`noqa`.** Cause: `RUF100`'s fix *"may remove trailing comments that follow a `# noqa` directive
on the same line, as it interprets the remainder of the line as a description"*. Fix: separate
other tools' pragmas with a second `#`.

```python
def visit_ImportFrom(self, node):  # noqa: N802 # pylint: disable=invalid-name
    pass
```

**Symptom: `RUF102` flags `noqa` codes with a `V` prefix that a vulture-based check running
beside ruff still reads.** Cause: `RUF102` reports codes unknown to ruff *"even if they are valid
for other tools."* Fix: tell ruff the prefix is external — the settings reference uses this very
case as its example.

```toml
[tool.ruff.lint]
external = ["V"]
```

**Symptom: `--add-noqa` was run once, and six months later nobody can tell baseline comments from
real, reviewed suppressions.** Cause: the comments carry only codes. Fix: always pass a reason,
so the baseline is searchable and countable.

```bash
uv run ruff check --select S --add-noqa="baseline 2026-09 security adoption" .
```

**Symptom: a few weeks after a baseline, `RUF100` reports some of the baseline comments as
unused.** Cause: those lines were fixed since — by hand, by a later safe fix, or because a rule's
scope changed with an upgrade — so the recorded claim is no longer true. Fix: let `RUF100` remove
them; that is the baseline shrinking, working as intended.

```bash
uv run ruff check --select RUF100 --fix .
```

**Symptom: `--add-noqa` on a whole codebase produced a diff so large nobody would review it.**
Cause: it was run with the full rule set at once. Fix: baseline one rule family per commit, after
applying that family's safe fixes, as in the procedure above.

```bash
uv run ruff check --select UP --fix . && uv run ruff check --select UP --add-noqa="baseline UP" .
```

## Interview questions

**★ What does `RUF100` check, and why is it worth enabling?**
It checks that every suppression still suppresses something: that the rule it names is enabled
and actually fired on that line. Stale suppressions are dangerous because they are silent
permissions — a `noqa: F821` left behind after a refactor will hide the next undefined-name bug
on that line. `RUF100` reports them as unused, non-enabled or duplicated, and its fix removes
them. It replaced the separate `yesqa` tool, and it is in ruff's default set from 0.16.0.

**★ How would you introduce a strict new rule to a large codebase without blocking everyone?**
Measure it with `--statistics`, apply its safe fixes in a mechanical commit, then run
`--add-noqa` (or `--add-ignore`) with a reason string to record every remaining violation as an
explicit suppression, and enable the rule. New code is held to the rule immediately; old
violations are visible, greppable debt. `RUF100` then keeps the baseline honest by removing each
comment once its line is fixed.

**Why does `RUF100` ignore codes it does not know, and how do you get them checked anyway?**
Because an unknown code might belong to another tool that still runs — a flake8 plugin ruff does
not implement — and deleting it would break that tool. Unknown codes are `RUF102`'s concern:
enable it to flag them, and list the genuinely external prefixes in `lint.external` so they are
preserved and not reported.

**What is the "non-enabled" case in a `RUF100` message, and when does it appear en masse?**
It is a `noqa` naming a rule that is not selected in the current configuration, so the comment
can never suppress anything. It appears in bulk whenever the selected rule set shrinks — someone
narrows `select`, or an upgrade removes rules from the defaults, as 0.16.0 did for 18 `E` and `F`
rules. The right response is a decision per rule: re-select it if you want it, or let the fix
delete the comments.

---

← Prev: [06b · ruff: ignore and ranges](06b-ruff-ignore-and-range-suppressions.md) · [Topic index](README.md) · Next → [07 · The formatter and Black](07-the-formatter-and-black.md)
