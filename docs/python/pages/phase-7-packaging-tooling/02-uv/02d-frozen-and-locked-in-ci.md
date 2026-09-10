---
title: "`--frozen` and `--locked` sound like synonyms and are opposites in the only way that matters: one silently accepts a stale lockfile and the other refuses to run against one"
sidebar_label: "02d · --frozen and --locked in CI"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), the environment variable
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)), *Using uv in
> Docker* ([docs.astral.sh](https://docs.astral.sh/uv/guides/integration/docker/)) and the release
> list ([github.com](https://github.com/astral-sh/uv/releases)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**uv locks and syncs automatically, which is right on a laptop and wrong everywhere else. In CI
you want a build to fail if someone edited `pyproject.toml` and forgot to re-lock, because the
alternative is a pipeline that quietly resolves a new dependency set, tests *that*, and then
throws the resolution away. Two flags control this and their names are actively misleading.
`--locked` asserts the lockfile is already correct and errors if it is not — that is the CI flag.
`--frozen` skips the check entirely and installs whatever the lockfile says, stale or not — that is
the flag for a container layer where `pyproject.toml` may not even be readable. Choosing the
comfortable-sounding one gives you a green pipeline that proves nothing.**

## The three flags, verbatim

> *"To disable automatic locking, use the `--locked` option... If the lockfile is not up-to-date,
> uv will raise an error instead of updating the lockfile."*

> *"To use the lockfile without checking if it is up-to-date, use the `--frozen` option."*

> *"To run a command without checking if the environment is up-to-date, use the `--no-sync`
> option."*
> — all three [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

Line them up against the two phases from [01](01-what-uv-is.md) and the confusion evaporates:

| Flag | Locking phase | Syncing phase | Fails on a stale lockfile? |
|---|---|---|---|
| *(default)* | re-lock if needed | install | ❌ no — it fixes it silently |
| `--locked` | **assert, never write** | install | ✅ **yes — this is the CI flag** |
| `--frozen` | **skip the check** | install | ❌ no — it installs the stale lock |
| `--no-sync` | as normal | **skip** | n/a — nothing is installed |

- **`--locked`** is a *guard*. It says: the lockfile in this commit is the answer, and if it is not
  consistent with `pyproject.toml`, stop.
- **`--frozen`** is a *shortcut*. It says: do not think about whether the lockfile is current, just
  install it. Cheap, and blind.
- **`--no-sync`** is for running a command against an environment you have already prepared —
  a second command in a CI job, or an entrypoint in an image where the sync happened at build time.

## `uv lock --check` is the same guard without the install

> *"You can check if the lockfile is up-to-date by passing the `--check` flag to `uv lock`."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

Useful as a standalone job: it answers *"did whoever changed dependencies re-lock?"* in isolation,
without building an environment, so the failure names the actual problem instead of appearing
halfway through an install.

```yaml
# .github/workflows/ci.yml — fragment
- name: The lockfile must match pyproject.toml
  run: uv lock --check
- name: Install exactly what the lockfile says
  run: uv sync --locked --no-dev
- name: Test
  run: uv run --no-sync pytest
```

That last line is worth noticing: the sync already happened in the previous step, so `--no-sync`
stops `uv run` from checking again. Without it, `uv run` would verify the environment before every
command — correct, but redundant work in a job that just synced.

## The environment-variable forms, and a version boundary

> `UV_FROZEN`: *"Equivalent to the `--frozen` command-line argument. If set, uv will run without
> updating the `uv.lock` file."*

> `UV_LOCKED`: *"Equivalent to the `--locked` command-line argument. If set, uv will assert that
> the `uv.lock` remains unchanged."*

> `UV_NO_SYNC`: *"Equivalent to the `--no-sync` command-line argument. If set, uv will skip updating
> the environment."*
> — all three [environment variables](https://docs.astral.sh/uv/reference/environment/)

Setting one of these at the job or image level is the clean way to make a whole pipeline
lock-strict without repeating a flag on every command. But an inherited environment variable is
invisible at the call site, and that is why a specific pair of flags exists:

🔴 **Landed in uv 0.12.9 (2026-09-01):** *"Add `--no-locked` and `--no-frozen` to disable lock modes
enabled by `UV_LOCKED` and `UV_FROZEN`"*, and in the same release *"Report the exact command-line
lock-mode flag in warnings and errors"*
([releases](https://github.com/astral-sh/uv/releases)). Before 0.12.9 there was no documented
command-line way to override an inherited `UV_FROZEN` — you had to unset the variable. If you write
`--no-frozen` into a script, that script requires **uv ≥ 0.12.9** and will fail with an
unrecognised-argument error on anything older.

```bash
# CI-wide strictness, with one deliberate escape
export UV_LOCKED=1
uv sync                       # strict, inherited
uv lock --no-locked           # ⚠️ requires uv >= 0.12.9
```

## Which flag, where

| Situation | Flag | Why |
|---|---|---|
| CI test job | `--locked` | a forgotten re-lock must fail the build |
| CI job that only runs a command after a sync | `--no-sync` | the environment is already correct |
| Deployment / release build | `--locked` | ship the reviewed resolution, nothing else |
| Docker dependency layer | `--locked` | uv's own example uses it — [02e](02e-uv-inside-a-container-image.md) |
| Docker *workspace* initial sync | `--frozen` | uv's guide: *"Use `--frozen` instead of `--locked` during the initial sync"* |
| A layer where `pyproject.toml` is absent | `--frozen` | there is nothing to compare against |
| A developer's machine | *(default)* | automatic locking is the point |

The workspace exception is documented rather than derived:

> *"Use `--frozen` instead of `--locked` during the initial sync"*
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

## 🔴 The failure mode `--frozen` produces, spelled out

You change `pyproject.toml` to require `httpx>=0.29`. You forget to run `uv lock`. CI runs
`uv sync --frozen`.

- The lockfile still pins the old `httpx`. `--frozen` does not compare, so no error.
- The environment installs the old `httpx`. Tests run against the old `httpx`, and pass.
- The merge lands. Production deploys from the same lockfile, so production also runs the old
  `httpx` — consistent, and consistent with *neither* your declared intent nor your review.
- Weeks later somebody runs `uv lock`, the resolution moves, and the change arrives in a commit
  that appears to be about something else entirely.

With `--locked`, step one fails and names the problem. That is the entire argument for preferring
it, and it is why "`--frozen` is faster" is not a reason: it is faster because it skips the check
you wanted.

## Gotchas

**★ Symptom: CI is green, and the resolution it tested is not in the repository.**
Cause: the default behaviour — *"locking and syncing are automatic in uv"* — re-locked before
installing, and the runner's working tree was discarded at the end of the job. Fix: forbid locking
in CI.

```bash
uv sync --locked
```

**★ Symptom: `uv sync --locked` fails and you cannot see what is wrong with the lockfile.**
Cause: nothing is wrong with the lockfile; it is *inconsistent with* `pyproject.toml` — someone
changed a dependency without re-locking. Fix: re-lock locally and commit the result as part of the
change that caused it.

```bash
uv lock
git add pyproject.toml uv.lock
```

**★ Symptom: you added `--frozen` to make a flaky CI step pass, and a dependency bump silently stopped taking effect.**
Cause: `--frozen` *"use[s] the lockfile without checking if it is up-to-date"*, so an out-of-date
lockfile is now the intended state. Fix: switch to `--locked` and fix the real cause; if the cause
was a slow re-lock, the answer is that CI should not be re-locking at all.

```bash
uv sync --locked
```

**★ Symptom: `--no-frozen` fails with an unrecognised argument on one machine and works on another.**
Cause: it landed in **uv 0.12.9**; the older machine predates it. Fix: check the version, and where
you cannot guarantee 0.12.9+, unset the variable instead.

```bash
uv self version
env -u UV_FROZEN uv lock       # version-independent equivalent
```

**★ Symptom: every `uv run` in a CI job re-verifies the environment even though the job synced once.**
Cause: `uv run` checks that the environment is up to date before each invocation. Fix: tell the
later commands not to.

```bash
uv sync --locked --no-dev
uv run --no-sync pytest
uv run --no-sync ruff check .
```

**★ Symptom: `UV_FROZEN` was exported in a `.envrc` or a shell profile, and now nothing ever re-locks locally.**
Cause: the variable is *"equivalent to the `--frozen` command-line argument"* and applies to every
uv command in that shell — including `uv add`, so new dependencies appear in `pyproject.toml` and
never reach the lockfile. Fix: remove it from interactive shells; lock-strictness belongs in CI.

```bash
env | grep '^UV_'          # audit what your shell is imposing on uv
```

**★ Symptom: a workspace's first sync in a container fails, and adding `--locked` makes it worse.**
Cause: uv's Docker guidance for workspaces is the opposite of the usual advice — *"Use `--frozen`
instead of `--locked` during the initial sync"*. Fix: follow it for that one step.

```dockerfile
RUN uv sync --frozen --no-install-workspace
```

**★ Symptom: `uv lock --check` passes but `uv sync --locked` still errors.**
Cause: they are not the same assertion. `--check` compares the lockfile to `pyproject.toml`;
`--locked` additionally has to be able to *use* the lockfile for this platform and interpreter, so
an interpreter outside `requires-python` or an unavailable distribution shows up here and not
there. Fix: read which phase spoke — the resolver or the installer ([01](01-what-uv-is.md)).

```bash
uv python find          # is the interpreter the one requires-python allows?
uv sync --frozen        # does the install half work at all?
```

## Interview questions

**★ `--frozen` or `--locked` in CI, and why is the wrong choice so easy to make?**
`--locked`, always, for anything that is testing or shipping a commit. uv's definitions are the
whole answer: `--locked` means *"if the lockfile is not up-to-date, uv will raise an error instead
of updating the lockfile"*, while `--frozen` means *"use the lockfile without checking if it is
up-to-date."* The wrong choice is easy because the names invite it — "frozen" sounds like the
stronger guarantee, and it is the *weaker* one: it freezes uv's *behaviour*, not the correctness of
the artefact. It is also easy because `--frozen` makes a failing pipeline green, which feels like
progress. The failure it hides is specific and expensive: a `pyproject.toml` change with no
corresponding re-lock means CI tests a dependency set that does not match the declared intent, and
the discrepancy surfaces later in an unrelated commit.

**★ When is `--frozen` the right flag?**
When there is nothing to compare against, or when comparing is known to fail for a reason you have
already accounted for. The clearest case is a container layer built from bind-mounted or partially
copied inputs, where the project's full state is not present — you want the lockfile installed and
you cannot meaningfully assert its currency. uv's own workspace guidance is exactly this shape:
*"Use `--frozen` instead of `--locked` during the initial sync."* The other legitimate case is an
offline or network-restricted environment where you want zero possibility of a resolution being
attempted. In both, the currency of the lockfile has been established somewhere else — in the CI
job that ran `uv lock --check` — which is what makes skipping the check safe rather than merely
convenient.

**★ What does `--no-sync` do, and why would a CI job that just ran `uv sync` need it?**
It means *"run a command without checking if the environment is up-to-date."* A CI job typically
syncs once and then runs several commands — pytest, ruff, a type checker — and each `uv run` would
otherwise re-verify the environment before executing. That verification is not free and it is
pointless when the previous step just converged the environment. `--no-sync` (or `UV_NO_SYNC`)
turns each later invocation into a plain exec in the project environment. The trade-off is that if
something *did* change the environment between steps, uv will not notice and will not fix it —
which is precisely why you use it after an explicit sync and not instead of one.

**★ Why do `--no-locked` and `--no-frozen` exist, and what does needing them tell you?**
They exist because `UV_LOCKED` and `UV_FROZEN` set a mode for an entire shell, container or CI job,
and a single command sometimes needs to opt out — uv 0.12.9's notes: *"Add `--no-locked` and
`--no-frozen` to disable lock modes enabled by `UV_LOCKED` and `UV_FROZEN`."* Needing one is a
signal worth reading: an inherited environment variable is controlling behaviour that is invisible
at the call site, which is exactly the situation the same release addressed from the other side by
*"report[ing] the exact command-line lock-mode flag in warnings and errors."* Also note the version
boundary — a script using `--no-frozen` requires uv ≥ 0.12.9, so on older uv the portable
equivalent is to unset the variable for that one invocation.

**Design question: why does uv re-lock automatically at all, given the trouble it causes in CI?**
Because for the workflow it is optimising — a developer editing `pyproject.toml` and running
`uv run pytest` — the alternative is worse. A tool that required an explicit `uv lock` after every
dependency edit would produce a constant stream of "lockfile out of date" errors during ordinary
work, and people would alias around it. Making locking implicit means the lockfile is *always*
current on a developer's machine, which is the state you want before committing. The cost is that
the same implicitness is dangerous in an automated context, so uv's answer is a flag rather than a
different default — and the flag is one word in a CI file. What makes this design defensible is
that `--locked` fails *loudly*: the unsafe case is opt-in, not silent.

**Your team keeps forgetting `--locked`. How do you make it structural rather than a review comment?**
Set it once at the boundary instead of per command: `UV_LOCKED=1` in the CI workflow's `env` block,
or in the image, since it is *"equivalent to the `--locked` command-line argument"* and applies to
every uv invocation in that context. Then add a standalone `uv lock --check` step so the failure
has an obvious name rather than appearing inside an install. Keep the variable out of developer
shells — a developer with `UV_LOCKED` set cannot run `uv add`, and the resulting frustration is how
the whole convention gets abandoned.

---

← Prev: [02c · uv sync](02c-uv-sync-makes-the-environment-match.md) · [Topic index](README.md) · Next → [02e · uv in a container image](02e-uv-inside-a-container-image.md)
