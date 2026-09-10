---
title: "`required-version` is the one pin every ruff obeys, because it lives in the configuration they all read — so it is the tripwire that turns a stale pre-commit `rev`, a global install or an editor's bundled binary into an error; the choice of specifier decides which drift it catches, and a local hook that runs `uv run ruff` removes the second pin altogether"
sidebar_label: "12b · required-version and keeping pins in step"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — the settings reference for [`required-version`](https://docs.astral.sh/ruff/settings/#required-version)
> (doc comment in `crates/ruff_workspace/src/options.rs` at the `0.16.6` tag, also the source of `validate_required_version` and its error text);
> `crates/ruff_workspace/src/pyproject.rs` (the pre-parse check) and `configuration.rs` (`extend` inheritance) at the same tag
> ([github.com](https://github.com/astral-sh/ruff/tree/0.16.6/crates/ruff_workspace/src)); the 0.14.11 entry of the 0.14.x changelog and PR #22410
> ([github.com](https://github.com/astral-sh/ruff/pull/22410)); *Configuring Ruff: Config file discovery* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/#config-file-discovery));
> **pre-commit 4.6.2** documentation — local hooks, `language: unsupported`, `autoupdate` ([pre-commit.com](https://pre-commit.com/)); the ruff-pre-commit hook manifest at `v0.16.6`
> ([github.com](https://github.com/astral-sh/ruff-pre-commit/blob/v0.16.6/.pre-commit-hooks.yaml)).
> Version spine: **ruff 0.16.6** (2026-09-03) · uv 0.12.12 · Python 3.14.7 · **pre-commit 4.6.2**.
> Documentation-validated — **no sandbox run, no program output**.

**[12](12-pinning-ruff.md) found ruff's version stated in half a dozen places that nothing compares.
You cannot make a global install, an editor's bundled binary or a pre-commit environment read
`uv.lock` — but every one of them reads the project's ruff configuration, and the configuration
can say which ruff is allowed to read it. That is `required-version`: a PEP 440 specifier checked
at startup, before anything else in the file is parsed, by whatever ruff happens to run. It does
not install the right version; it makes the wrong one stop. The specifier decides how much drift
it tolerates, and for the one consumer that routinely drifts — the pre-commit `rev` — there is a
stronger fix than a tripwire: a hook that runs the locked ruff instead of its own.**

## What `required-version` does

> *"Enforce a requirement on the version of Ruff, to enforce at runtime. If the version of Ruff does not meet the requirement, Ruff will exit with an error."*
> *"Accepts a PEP 440 specifier, like `==0.3.1` or `>=0.3.1`."*
> — [settings: `required-version`](https://docs.astral.sh/ruff/settings/#required-version)

```toml
[tool.ruff]
required-version = "==0.16.6"
```

Three details from the 0.16.6 source decide how it behaves:

- **It is checked before the rest of the file is parsed.** `pyproject.rs` parses the TOML loosely
  first — its comment: *"Inspect `required-version` without triggering strict deserialization
  errors"* — and validates the version before strict deserialisation. So a ruff that is too old to
  know a newer option reports the version mismatch, not an unknown field. This arrived in
  **0.14.11** (*"Check `required-version` before parsing rules"*, PR #22410); a ruff older than that
  may report the configuration error instead.
- **The message names both versions.** The template in `options.rs`:
  ``Required version `{required_version}` does not match the running version `{RUFF_PKG_VERSION}` ``.
  It is raised while the configuration loads; the exit-code table has no separate line for it,
  but configuration failures are the abnormal-termination code `2`, not the violations code `1`
  ([11](11-ruff-in-ci.md)).
- **It follows `extend` and nothing else.** Combining an `extend`ed configuration takes the child's
  `required-version` if it has one, else the parent's. But discovery never merges configuration
  files — *"the "closest" configuration file is used, and any parent configuration files are
  ignored"* ([02](02-configuration-discovery.md)) — so a sub-project with its own `[tool.ruff]` and no
  `extend` has no tripwire at all.

```toml
# services/billing/pyproject.toml
[tool.ruff]
extend = "../../pyproject.toml"      # inherits required-version, and everything else
```

## Choosing the specifier

| `required-version` | Catches | Lets through | Cost |
|---|---|---|---|
| `"==0.16.6"` | every other version — older, newer, any patch | nothing | every upgrade edits this line too; an editor falling back to its bundled (newer) ruff errors until the environment is synced |
| `">=0.16.6,<0.17"` | anything older, and the next breaking minor | patch drift within 0.16 | two numbers to edit per minor; patches can still differ ([12](12-pinning-ruff.md)) |
| `">=0.16.6"` | binaries too old for the configuration | every newer ruff | the drift that hurts most — a newer minor on one machine — is invisible |

`==` is the only one that makes *every* pin in the project agree, and the cost is the point: an
upgrade pull request that forgets one consumer fails instead of merging. It is the right default
for an application team with one `uv.lock`. `">=X,<next-minor"` suits a project whose developers
genuinely run mixed patches and have preview off. A floor alone is what the earlier chunks
show as the minimum — it stops the stale editor binary that cannot parse the configuration — and
not much more.

## Keeping the pre-commit `rev` and the lock in step

### Option A — let the tripwire catch it

With `required-version = "==0.16.6"`, a hook environment on any other ruff fails as soon as it
loads the configuration, naming both versions. Nothing prevents the drift; the first commit after it reports
it.

### Option B — compare the pins in CI

```python
#!/usr/bin/env python3
"""scripts/check_ruff_pins.py — fail if uv.lock, the pre-commit rev and required-version disagree."""
import re
import sys
import tomllib
from pathlib import Path

lock = tomllib.loads(Path("uv.lock").read_text())
locked = next((p["version"] for p in lock.get("package", []) if p["name"] == "ruff"), None)

config = Path(".pre-commit-config.yaml").read_text()
match = re.search(
    r"astral-sh/ruff-pre-commit[^\n]*\n(?:[ \t]*#[^\n]*\n)*[ \t]*rev:[ \t]*['\"]?v?([^'\"\s#]+)",
    config,
)
hook = match.group(1) if match else None

pyproject = tomllib.loads(Path("pyproject.toml").read_text())
required = pyproject.get("tool", {}).get("ruff", {}).get("required-version")

problems = []
if locked is None:
    problems.append("ruff is not in uv.lock")
if hook != locked:
    problems.append(f"pre-commit rev {hook!r} does not match uv.lock {locked!r}")
if required is not None and required.startswith("==") and required != f"=={locked}":
    problems.append(f"required-version {required!r} does not match uv.lock {locked!r}")

for problem in problems:
    print(problem, file=sys.stderr)
sys.exit(1 if problems else 0)
```

It assumes the conventional layout — `rev:` directly under the `repo:` line, optionally after
comment lines, as the integrations page writes it — and a tag, not a SHA. A configuration frozen
with `pre-commit autoupdate --freeze` (*"Store 'frozen' hashes in `rev` instead of tag names"*)
stores a commit hash, and the script will report it as a mismatch — correctly, since a hash does
not say which ruff it is.

### Option C — one pin: a local hook that runs the locked ruff

pre-commit can run a command from the repository instead of installing a hook from a remote repo.
The hook then runs whatever `uv run` resolves — the locked ruff — and `rev` stops existing:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: ruff-check
        name: ruff check
        entry: uv run --locked ruff check --force-exclude --fix
        language: unsupported
        types_or: [python, pyi, jupyter]
        require_serial: true
      - id: ruff-format
        name: ruff format
        entry: uv run --locked ruff format --force-exclude
        language: unsupported
        types_or: [python, pyi, jupyter, markdown]
        require_serial: true
```

- **`language: unsupported`** is pre-commit 4.4.0's name for what used to be `language: system`
  (*"the alias will be removed in a future version"*): pre-commit gives the hook no environment of
  its own and just runs the command.
- **Arguments go in `entry`.** *"When creating local hooks, there's no reason to put command
  arguments into args as there is nothing which can override them -- instead put your arguments
  directly in the hook entry."*
- **`--force-exclude`, the `types_or` lists and `require_serial`** copy ruff-pre-commit's own
  manifest at `v0.16.6`, so the hooks select and pass files exactly as the remote ones did.
- **`uv run --locked`** fails if `pyproject.toml` and `uv.lock` disagree, instead of re-locking in
  the middle of a commit.

The trade: every place the hook runs needs uv on `PATH`. A service that runs hooks in its own
environment cannot run this hook unless it provides uv, and the hook's first run on a fresh
clone creates the project environment. In exchange there is one ruff pin in the repository, and
`pre-commit autoupdate` has nothing of ruff's to bump. The hook configuration in general is topic
**11 · pre-commit** *(not written yet)*.

## Gotchas

**★ Symptom: every commit fails in the ruff hooks with ``Required version `==0.16.6` does not match
the running version …``, right after an automated "pre-commit autoupdate" pull request merged.**
Cause: the autoupdate moved `rev` to a new ruff and nothing else; the tripwire did its job. Fix:
move all three pins in one commit — or revert the `rev`.

```bash
# .pre-commit-config.yaml already says rev: v0.16.7 — bring the other two pins to it
uv add --dev 'ruff==0.16.7'
sed -i 's/^required-version = .*/required-version = "==0.16.7"/' pyproject.toml
```

**★ Symptom: `required-version` is set, yet files in one service are checked by any ruff at all.**
Cause: that service has its own `[tool.ruff]` table and no `extend`, so it is the closest
configuration for its files and the root's `required-version` is never read for them. Fix: extend
the root.

```toml
[tool.ruff]
extend = "../../pyproject.toml"
```

**★ Symptom: the editor shows an error about the required version instead of diagnostics, only on
machines where `uv sync` was never run.** Cause: with no ruff in the environment the VS Code
extension fell back to its bundled binary, which is newer than the `==` pin. Fix: create the
environment the extension finds first, or — if the team deliberately tolerates patch drift — use a
floor-and-ceiling specifier.

```bash
uv sync
```

**Symptom: an old ruff on a CI image reports an unknown configuration field instead of a version
mismatch.** Cause: the early `required-version` check arrived in 0.14.11; an older binary parses
the whole file first and fails on the first key it does not know. Fix: the configuration is fine —
replace the binary with the locked one.

```yaml
      - run: uv sync --locked --only-dev
      - run: uv run --no-sync ruff check .
```

**Symptom: the pin check fails on a `rev` that is obviously the right commit.** Cause:
`pre-commit autoupdate --freeze` wrote a SHA, which does not say which ruff it is. Fix: use tags
for ruff-pre-commit, or move to the local hook, where there is no `rev`.

```yaml
    rev: v0.16.6
```

**Symptom: after switching to the local hook, a teammate's commit fails with a lockfile error.**
Cause: their `pyproject.toml` and `uv.lock` disagree, and `uv run --locked` refuses to re-lock in
the middle of a commit. Fix: re-lock deliberately and commit the lock with the change.

```bash
uv lock
```

## Interview questions

**★ What does ruff's `required-version` do, and what can it not do?**
It makes ruff check its own version against a PEP 440 specifier when it loads the configuration,
and exit with an error naming both versions if the check fails. Because every ruff — pre-commit's,
the editor's, a global install — reads the same configuration, it is the one pin they all obey.
What it cannot do is install the right version: it turns drift into a failure, and the fix is
still to change whichever consumer was wrong. It also only covers files whose configuration has
it, directly or through `extend`.

**★ How would you make sure pre-commit and CI run the same ruff?**
Three levels. Make disagreement fail: `required-version = "==X"` stops a hook environment on the
wrong ruff. Make it visible in review: a CI script comparing the ruff in `uv.lock`, the
ruff-pre-commit `rev` and `required-version`. Or remove the second pin: a local pre-commit hook
with `entry: uv run --locked ruff …` runs the locked ruff, so there is no `rev` to drift. The last
is the strongest, at the price of requiring uv wherever the hooks run.

**`==0.16.6` or `>=0.16.6,<0.17` in `required-version` — how do you choose?**
`==` catches every difference, including patches, and forces an upgrade to touch every pin at once;
it also turns an editor's newer bundled binary into an error until the environment exists. The
bounded range tolerates patch differences and still blocks the next breaking minor. A team with
one lockfile, CI as the arbiter and preview features in use wants `==`; a looser group with preview
off can live with the range. A bare floor catches only binaries too old to read the configuration.

**Why does `required-version` not protect a sub-project with its own `[tool.ruff]` table?**
Because ruff uses the closest configuration file for each source file and does not merge its
parents. The sub-project's table is complete on its own, so the root's `required-version` is never
consulted for those files. `extend = "../../pyproject.toml"` inherits the root's settings,
`required-version` included — the child's own value wins if it sets one.

---

← Prev: [12 · Pinning ruff](12-pinning-ruff.md) · [Topic index](README.md) · Next → **13 · Editor integration** *(not written yet)*
