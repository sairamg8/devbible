---
title: "`uv run` does four things before your command starts — find the project, lock, sync, execute — which is why it replaces activation entirely and why the first run in a fresh clone is the slow one"
sidebar_label: "04c · uv run"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Running commands in projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/run/)), *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), the environment variable
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)) and PEP 723
> ([peps.python.org](https://peps.python.org/pep-0723/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**`uv run pytest` is not a shortcut for `.venv/bin/pytest`. Before your command executes, uv finds
the project, resolves and updates the lockfile if it has drifted, brings the environment up to date,
and only then runs what you asked for — which is why the uv workflow never activates anything, and
why the first `uv run` in a fresh clone does far more work than the second. Two details are worth
knowing before you rely on it: it syncs *inexactly* by default, the opposite of `uv sync`, so
packages you installed by hand survive it; and `--with` can supply a dependency for one invocation
that contradicts your project's own requirements.**

## What happens before your command runs

> *"When using `run`, uv will ensure that the project environment is up-to-date before running the
> given command."*
> — [running commands in projects](https://docs.astral.sh/uv/concepts/projects/run/)

> *"Locking and syncing are automatic in uv. For example, when `uv run` is used, the project is
> locked and synced before invoking the requested command."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

In order:

1. **Find the project** — walk up for `pyproject.toml` ([01b](01b-the-project-uv-sees.md)).
2. **Lock** — re-resolve if `pyproject.toml` has drifted from `uv.lock`. Suppress with `--frozen` or
   forbid with `--locked` ([02d](02d-frozen-and-locked-in-ci.md)).
3. **Sync** — install what is missing. Suppress with `--no-sync`.
4. **Run** — in the project environment.

```bash
uv run pytest                     # the whole cycle, every time
uv run --no-sync pytest           # skip step 3 — for a job that already synced
uv run --frozen pytest            # skip the up-to-date check in step 2
uv run --locked pytest            # fail if step 2 would have changed anything
```

That is the entire reason the uv workflow has no `source .venv/bin/activate`
([02b](02b-activation-and-discovery.md)): activation gives you the interpreter and nothing else,
while `uv run` gives you the interpreter *and a guarantee about what is installed in it*.

## 🔴 `uv run` syncs *inexactly*; `uv sync` syncs exactly

> *"`uv run` uses 'inexact' syncing by default... To enable exact syncing with `uv run`, use the
> `--exact` flag."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

| Command | Default | Undeclared packages |
|---|---|---|
| `uv sync` | exact | **removed** |
| `uv run` | inexact | left alone |

This asymmetry is deliberate and sensible — deleting unrelated packages as a side effect of running
a test would be a nasty surprise — and it produces a specific confusion: something you installed by
hand can survive weeks of `uv run` and then vanish on the first `uv sync`, so the failure appears
far from its cause.

## `--with` runs something that is not a dependency

> *"The `--with` option is used to include a dependency for the invocation"*

> *"The requested version will be respected regardless of the project's requirements."*
> — both [running commands in projects](https://docs.astral.sh/uv/concepts/projects/run/)

That second sentence is stronger than it looks: `--with` can supply a version that **contradicts**
your project's declared requirements, for that invocation only. Two consequences:

- It is the right tool for a one-off — a profiler, a debugger, `pytest-xdist` in one CI step —
  because it changes no file. This is what CI should use instead of `uv add`
  ([04](04-add-and-remove.md)).
- It is a trap if you use it to "fix" a missing dependency, because the fix lives in your shell
  history and nowhere else.

```bash
uv run --with pytest-xdist pytest -n auto      # ✅ one invocation, no file changed
uv run --with 'httpx==0.26' python -m myapp    # ⚠️ deliberately overrides the project requirement
```

## Running things that are not project commands

> *"The given command can be provided by the project environment or exist outside of it"*
> — [running commands in projects](https://docs.astral.sh/uv/concepts/projects/run/)

So `uv run` is not restricted to console scripts your dependencies installed. It also runs scripts,
and a script with **PEP 723** inline metadata gets its own environment:

> *"Scripts that declare inline metadata are automatically executed in environments isolated from the
> project."*
> — [running commands in projects](https://docs.astral.sh/uv/concepts/projects/run/)

```python
# tools/report.py
# /// script
# requires-python = ">=3.14"
# dependencies = ["httpx>=0.27"]
# ///
import httpx
print(httpx.get("https://example.com").status_code)
```

```bash
uv run tools/report.py        # isolated environment, NOT the project's
```

🔴 That isolation is easy to trip over: a script with an inline metadata block does **not** see your
project's dependencies, even when it sits inside your project. If the script is meant to use your
package, remove the metadata block and let it run in the project environment — or declare your
package as one of the script's dependencies. Inline metadata is topic **09 · PEP 723 inline
metadata** *(not written yet)*.

`--no-project` opts out of project discovery entirely, which is what you want when you are inside a
project directory but do not want its environment.

One more thing about `uv run` needs its own page: uv deliberately does **not** hand the process over
to your command, so it stays in the process tree forwarding signals — and that, plus the `--`
argument boundary and the Windows script limitation, is [04d](04d-uv-run-as-a-process.md).

## Gotchas

**★ Symptom: the first `uv run` in a fresh clone takes far longer than expected.**
Cause: it is doing four things, not one — discovering the project, locking, creating the environment
(possibly downloading an interpreter), and only then running. Fix: nothing is wrong; if you want that
work to be an explicit step, do it explicitly.

```bash
uv sync --locked          # prepare once
uv run --no-sync pytest   # then just run
```

**★ Symptom: a package you installed by hand survives dozens of `uv run` invocations, then disappears.**
Cause: `uv run` is inexact by default and `uv sync` is exact. The removal happened at the sync. Fix:
declare it, or make `uv run` converge too so the failure arrives immediately rather than later.

```bash
uv add httpx
uv run --exact pytest      # opt into exact syncing so strays fail fast
```

**★ Symptom: `uv run` modified `uv.lock` during a CI job.**
Cause: automatic locking. Fix: forbid it in CI — and note that `--frozen` merely *skips the check*
while `--locked` *fails* on drift.

```bash
uv run --locked pytest
```

**★ Symptom: a script inside your project cannot import your own package.**
Cause: it has a PEP 723 inline metadata block, and *"scripts that declare inline metadata are
automatically executed in environments isolated from the project."* Fix: decide which environment it
belongs in.

```bash
uv run --no-project script.py     # deliberately outside the project
```

```python
# or drop the inline block so it runs in the project environment
import myapp
```

**★ Symptom: `uv run --with X` fixed something locally and CI still fails.**
Cause: `--with` applies to one invocation and changes no file, so nothing about it is committed. Fix:
if the dependency is real, declare it; if it is genuinely one-off, put the `--with` in the CI command
too.

```bash
uv add --group test pytest-xdist          # real dependency
uv run --with pytest-xdist pytest -n auto # one-off, in both places
```

## Interview questions

**★ What exactly does `uv run` do before it runs your command?**
Four things. It discovers the project by walking up for `pyproject.toml`; it locks — re-resolving if
`pyproject.toml` has drifted from `uv.lock`, because *"locking and syncing are automatic in uv"*; it
syncs the environment, since uv *"will ensure that the project environment is up-to-date before
running the given command"*; and then it executes. Each of the first three can be switched off
(`--frozen` or `--locked` for locking, `--no-sync` for syncing), which is exactly what CI and
container entrypoints need. The reason this matters more than it sounds: it means `uv run` is not a
convenience wrapper around a path, it is a *guarantee* about the environment your command sees — and
that guarantee is why activation becomes unnecessary rather than merely optional.

**★ Why does `uv run` sync inexactly when `uv sync` syncs exactly?**
Because they are answering different questions. `uv sync` says "make this environment correct", so
convergence — including removal — is the whole point. `uv run` says "run this now"; deleting
unrelated packages as a side effect of running a test would be a surprising and destructive thing for
a run command to do. uv documents both defaults and provides each with the other's behaviour on
request (`--exact` and `--inexact`). The consequence to hold in mind while debugging is temporal: an
undeclared package can survive indefinitely under `uv run` and vanish at the next `uv sync`, so the
symptom appears long after the mistake.

**★ When is `uv run --with` the right answer, and when is it hiding a problem?**
It is right for anything that is genuinely per-invocation: a profiler, a debugger, `pytest-xdist` in
one CI step, a one-off script's dependency. uv describes it as being *"used to include a dependency
for the invocation"*, and crucially *"the requested version will be respected regardless of the
project's requirements"* — so it can even override a declared version for a single run, which makes
it a good bisection tool. It is hiding a problem the moment it becomes a habit: a `--with` lives in
your shell history and in nothing that is committed, so a colleague, CI and production all lack it.
The test is whether the next person to run your test suite needs the flag. If they do, it belongs in
`pyproject.toml` — as a dependency group, most likely.

**★ Why does a script with a PEP 723 metadata block ignore your project's dependencies?**
Because uv treats it as a self-contained program rather than part of the project: *"scripts that
declare inline metadata are automatically executed in environments isolated from the project."* That
is the point of inline metadata — the script declares everything it needs, so it can be handed to
anyone and run anywhere, and reading the project's environment would destroy that property by making
the script's behaviour depend on where it happens to live. The trap is only that the isolation is
silent: a helper script inside your repository stops seeing your package the moment somebody adds a
metadata block to it. If it needs your package, either remove the block or list your package among
the script's own dependencies.

---

← Prev: [04b · tool.uv.sources](04b-tool-uv-sources.md) · [Topic index](README.md) · Next → [04d · uv run as a process](04d-uv-run-as-a-process.md)
