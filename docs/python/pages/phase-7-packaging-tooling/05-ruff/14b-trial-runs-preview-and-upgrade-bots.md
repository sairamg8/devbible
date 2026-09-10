---
title: "You can see a ruff upgrade coming before you take it — a trial run of the new version in a throwaway worktree, or today's ruff with `--preview` on the command line — and you should decide in advance what happens to the weekly bump a bot will propose, because with an exact pin every such pull request is incomplete by construction"
sidebar_label: "14b · Trial runs, preview and upgrade bots"
sidebar_position: 39
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Versioning* and *Preview* (raw Markdown at the `0.16.6` tag, [docs.astral.sh](https://docs.astral.sh/ruff/versioning/),
> [docs.astral.sh](https://docs.astral.sh/ruff/preview/)), *The Ruff Formatter: Style guide* ([docs.astral.sh](https://docs.astral.sh/ruff/formatter/)),
> the 0.15.2 and 0.16.0 changelog entries ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/changelogs/0.15.x.md), [github.com](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md)),
> `BREAKING_CHANGES.md` at the `0.16.6` tag ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/BREAKING_CHANGES.md)), the `required-version` check in
> `crates/ruff_workspace/src/pyproject.rs` ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/crates/ruff_workspace/src/pyproject.rs)); PyPI upload dates of the 0.16.x
> releases; GitHub's Dependabot documentation — *Optimizing PR creation* ([docs.github.com](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/optimizing-pr-creation-version-updates))
> and the options reference ([docs.github.com](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)); pre-commit.com on pre-commit.ci
> ([pre-commit.com](https://pre-commit.com/)).
> Version spine: **ruff 0.16.6** (2026-09-03) · **uv 0.12.12** · Python 3.14.7 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**[14](14-upgrading-ruff.md) is the upgrade itself. This page is everything around it: finding
out what an upgrade will cost before deciding to take it, crossing more than one minor at once,
the special position of a project that runs with preview enabled, and the automated pull requests
that will propose a ruff bump most weeks. The forecast is cheap — ruff can be run at any version
without touching the lock, and preview mode *is* the next minor's rule set and style, available
today. The bots are the part to settle as policy: with the exact pin and the `required-version`
tripwire from [12b](12b-required-version-and-keeping-pins-in-step.md), a bot that bumps one file
opens a pull request that cannot pass, and that is the design working.**

## A trial run of the next version

`uvx` runs any ruff version in a throwaway tool environment ([`uvx` versions](../02-uv/07b-uvx-versions-sources-and-plugins.md)),
so the new version can be measured against the real configuration without editing the lock. Two
obstacles, both expected. `required-version = "==0.15.22"` stops any other ruff — the check runs
while the configuration file is parsed. And the measurement should not leave anything behind in
the working tree. A worktree handles both:

```bash
git worktree add ../app-ruff-trial HEAD
cd ../app-ruff-trial
sed -i 's/^required-version = .*/required-version = "==0.16.6"/' pyproject.toml

uvx ruff@0.16.6 check --exit-zero --statistics .   # which rules would fire, and how often
uvx ruff@0.16.6 format --check .                   # which files the new style would change

cd -
git worktree remove --force ../app-ruff-trial
```

`--config` overrides were not used to waive the pin: the 0.16.6 source validates the file's own
`required-version` as the file is parsed, and whether a command-line override could bypass that was
not traced for this page. Editing it in a disposable worktree removes the question.

## Preview is the next minor, available now

Preview is where ruff stages what its next minors will make stable:

> *"New rules should always be added in preview mode"* · *"New rules will remain in preview mode for at least one minor release before being promoted to stable"*
> — [Versioning](https://docs.astral.sh/ruff/versioning/)

> *"Similar to Black, Ruff implements formatting changes under the `preview` flag, promoting them to stable through minor releases, in accordance with our versioning policy."*
> — [The Ruff Formatter](https://docs.astral.sh/ruff/formatter/)

The 0.16 default rule set is the clearest example: ruff 0.15.2 announced *"In preview, Ruff now
enables a significantly expanded default rule set of 412 rules, up from the stable default set of
59 rules"*, and 0.16.0 made 413 rules the stable default. A project that ran the preview defaults
in February saw July's upgrade in advance. The forecast is a command-line flag, not a configuration
change:

```bash
uv run ruff check --preview --exit-zero --statistics .   # the current preview rule set and rule behaviour
uv run ruff format --preview --check .                   # the current preview style
```

It is a forecast, not a promise: the versioning page says *"we reserve the right to make changes to
any behavior gated by the mode including the removal of preview features or rules."*

## When preview is on in the configuration

`preview = true` in the configuration turns every patch release into an upgrade. The patch policy
explicitly allows *"A rule is added in preview"*, *"The behavior of a preview rule is changed"* and
*"The preview style changed"* ([12](12-pinning-ruff.md)). For such a project:

- pin exactly — `~=` would admit preview churn on every patch;
- read each release's *Preview features* changelog section, not only `BREAKING_CHANGES.md`;
- expect deprecated rules to behave differently: *"When preview mode is enabled, deprecated rules
  will be disabled. If a deprecated rule is selected explicitly, an error will be raised."*

Preview can be enabled for the linter or the formatter alone (`[tool.ruff.lint] preview = true`,
[04](04-preview-mode.md)), which limits the churn to the half that needs the new feature.

## Crossing more than one minor

`BREAKING_CHANGES.md` has a section per breaking minor, and every section between the pinned
version and the target applies. From 0.14.x to 0.16.6, for example, that is 0.15.0 — the 2026
formatter style, block suppression comments, the `extend` resolution change — and 0.16.0 — the new
default rules, Markdown formatting, `ruff: ignore` comments, the JSON output change.

Nothing in ruff requires stepping through each minor, but doing so gives each reformat commit one
cause: the 2026 style in the 0.15 step, Markdown in the 0.16 step. On a large codebase where the
reformat is the part reviewers must trust without reading, one style change per commit is worth an
extra pull request.

## Upgrade bots

ruff released a patch every week through 0.16.x — 0.16.0 on 2026-07-23 through 0.16.6 on
2026-09-03, by PyPI upload date — so a dependency bot will propose a ruff bump almost weekly.
GitHub's Dependabot has ecosystems for both files involved: `uv` for `pyproject.toml`/`uv.lock` and
`pre-commit` for `.pre-commit-config.yaml`. Its default:

> *"By default, Dependabot opens a new pull request to update each dependency."*
> — [Optimizing pull request creation](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/optimizing-pr-creation-version-updates)

With `required-version = "==0.16.6"`, a pull request that moves `uv.lock` alone makes every ruff
invocation fail on the pin; one that moves the pre-commit `rev` alone makes the hooks fail. That is
[12b](12b-required-version-and-keeping-pins-in-step.md)'s tripwire doing its job — an automated
pull request cannot land a ruff release by itself. Two workable policies:

- **Treat the bot's pull request as the prompt.** A human completes it on the same branch with the
  procedure from [14](14-upgrading-ruff.md): the remaining pins, then the commit sequence.
- **Take ruff out of the bot and upgrade on a schedule.** Ignore it in the `uv` ecosystem, and use
  the local pre-commit hook from [12b](12b-required-version-and-keeping-pins-in-step.md), so there is
  no ruff `rev` for the `pre-commit` ecosystem — or pre-commit.ci, which *"will periodically
  autoupdate your configuration"* — to move.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "uv"
    directory: "/"
    schedule:
      interval: "weekly"
    ignore:
      - dependency-name: "ruff"
```

How Dependabot's `pre-commit` ecosystem names the ruff-pre-commit hook for an `ignore` entry was
not confirmed for this page, which is one more reason the local hook is the simpler route.

## Gotchas

**★ Symptom: the trial run `uvx ruff@0.16.6 check .` stops immediately with a required-version
error.** Cause: the configuration pins `==0.15.22`, and every ruff checks that pin when it parses
the file. Fix: run the trial in a disposable worktree with the pin edited.

```bash
git worktree add ../app-ruff-trial HEAD
sed -i 's/^required-version = .*/required-version = "==0.16.6"/' ../app-ruff-trial/pyproject.toml
```

**★ Symptom: the weekly Dependabot pull request for ruff is always red.** Cause: it moves one pin,
and `required-version` rejects every ruff that does not match the others. Fix: complete the pull
request with the upgrade procedure — or stop the bot from proposing ruff and upgrade on a schedule.

```yaml
    ignore:
      - dependency-name: "ruff"
```

**★ Symptom: a preview rule the project relied on changed its behaviour — or disappeared — in a
patch release.** Cause: preview behaviour may change in any patch, and the versioning page reserves
*"the removal of preview features or rules."* Fix: pin exactly while preview is on, and read each
release's preview section before bumping.

```toml
[dependency-groups]
dev = ["ruff==0.16.6"]
```

**Symptom: someone set `preview = true` in `pyproject.toml` "to see what is coming", and now every
patch bump changes the lint results.** Cause: the forecast was made permanent. Fix: forecast with
the command-line flag, and keep the configuration on stable.

```bash
uv run ruff check --preview --exit-zero --statistics .
```

**Symptom: with preview enabled, the configuration suddenly fails to load after an upgrade,
naming a rule that still exists.** Cause: the rule was deprecated, and *"If a deprecated rule is
selected explicitly, an error will be raised"* when preview is on. Fix: remove it from the
selection, or turn preview off for the linter.

```toml
[tool.ruff.lint]
preview = false
```

**Symptom: the reformat commit of a 0.14 → 0.16 upgrade is too large to trust.** Cause: it carries
two independent style changes — the 2026 style from 0.15.0 and Markdown formatting from 0.16.0.
Fix: step through the minors so each reformat has one cause.

```bash
uv add --dev 'ruff==0.15.22'   # first pull request: the 2026 style
uv add --dev 'ruff==0.16.6'    # second pull request: new defaults and Markdown
```

## Interview questions

**★ How can you estimate the impact of a ruff upgrade before changing the lockfile?**
Run the target version against the real configuration without installing it: `uvx ruff@X check
--exit-zero --statistics .` gives violation counts per rule and `uvx ruff@X format --check .` lists
the files the new style would change. If the configuration pins `required-version` exactly, do it
in a disposable worktree with the pin edited, since every ruff enforces the pin when it reads the
file. For the release after next, run today's ruff with `--preview`, which is where new rules and
style changes wait before they become stable.

**★ How should automated dependency pull requests for ruff be handled?**
Decide it as policy. With an exact pin and `required-version`, a bot that moves one file produces a
pull request that fails — which is correct, because a ruff minor needs the upgrade procedure, not a
merge button. Either treat the bot's pull request as the trigger and complete it by hand, or exclude
ruff from the bot and upgrade on a schedule; a local pre-commit hook that runs `uv run ruff` removes
the `rev` that pre-commit bots would otherwise move.

**How does preview mode let you see the next minor coming, and why not simply leave it on?**
New rules must spend at least one minor in preview, and formatter style changes are promoted from
preview in minor releases, so today's preview is a draft of the next stable behaviour — the 0.16
default rule set was available as the preview default from 0.15.2. Leaving it on in the
configuration means accepting preview's terms permanently: behaviour that can change or be removed
in any patch, and errors for explicitly selected deprecated rules.

**Why might you step through ruff minors one at a time instead of jumping straight to the latest?**
Each minor can carry its own formatter style change and its own default-rule change. Jumping several
minors at once folds them into one reformat commit and one flood of violations, which is harder to
review and harder to attribute. One pull request per minor gives each mechanical change a single,
documented cause from that minor's `BREAKING_CHANGES.md` section.

---

← Prev: [14 · Upgrading ruff safely](14-upgrading-ruff.md) · [Topic index](README.md)
