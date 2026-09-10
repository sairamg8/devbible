---
title: "uv deliberately refuses to hand the process over to your command, so `uv run` stays in the tree forwarding signals — a good trade for a developer command and a decision to think about before it becomes PID 1"
sidebar_label: "04d · uv run as a process"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Running commands in projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/run/)) and *Using uv in Docker*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/integration/docker/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**Most launcher tools `exec`-replace themselves with the command you asked for, so nothing of the
launcher survives into the running process. uv states plainly that it does not: it *"does not cede
control of the process to the spawned command in order to provide better error messages on
failure."* That is a deliberate trade, and it is the right one for a command you type — uv can tell
you *why* something failed instead of leaving you with a bare exit code. It also means uv is a
parent process in the tree, your application's signals arrive via uv's forwarding, and if `uv run`
is a container entrypoint then uv is PID 1 rather than your server. This chunk is the small set of
consequences that follow, plus the `--` boundary that stops uv eating your command's flags.**

## The signal contract, verbatim

> *"uv will forward most signals (with the exception of SIGKILL, SIGCHLD, SIGIO, and SIGPOLL) to the
> child process."* (Unix)

> *"uv ignores Ctrl-C events, deferring handling to the child process so it can exit cleanly."*
> (Windows)

> *"uv does not cede control of the process to the spawned command in order to provide better error
> messages on failure."*
> — all three [running commands in projects](https://docs.astral.sh/uv/concepts/projects/run/)

Three facts, each with an operational consequence:

- **Signals are forwarded**, so `Ctrl-C` at your terminal and a container runtime's `SIGTERM` reach
  your process. Graceful shutdown works.
- **The exceptions are not really exceptions.** `SIGKILL` cannot be caught or forwarded by *any*
  process, so its appearance in that list is a statement of fact rather than a limitation of uv;
  `SIGCHLD`, `SIGIO` and `SIGPOLL` concern uv's own I/O and children and are meaningless to forward.
- **uv is a real parent, not a wrapper that vanishes.** On Windows, uv actively *ignores* Ctrl-C so
  that the child gets to decide when to exit — otherwise uv would die first and orphan it.

## What "not ceding control" costs, and where

| Context | Does it matter? | Why |
|---|---|---|
| your terminal | no | this is the case uv optimised for: better errors |
| a CI step | barely | one extra process, and the error messages help |
| a `make` target | no | the shell is already several processes deep |
| a container **entrypoint** | 🔴 yes | `uv run` becomes PID 1 and your app is its child |

PID 1 is special: it is the process the container runtime signals on `docker stop`, and it has
non-standard defaults for signal handling and for reaping orphaned children. Nothing here is broken
— uv forwards signals — but you have inserted a layer between the orchestrator and the process that
actually needs to shut down cleanly, and you have made your shutdown behaviour depend on that
layer's forwarding rather than on your application receiving the signal directly.

The cleanest container shape sidesteps the question entirely, and it is uv's own documented
alternative ([02e](02e-uv-inside-a-container-image.md)):

> *"you can either activate the project virtual environment by placing its binary directory at the
> front of the path:"* `ENV PATH="/app/.venv/bin:$PATH"`
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

```dockerfile
# ✅ your application is PID 1; no uv at runtime at all
ENV PATH="/app/.venv/bin:$PATH"
CMD ["gunicorn", "myapp.wsgi:application", "--bind", "0.0.0.0:8000"]
```

```dockerfile
# ⚠️ works, and inserts uv between the orchestrator and your server
CMD ["uv", "run", "gunicorn", "myapp.wsgi:application"]
```

This works because installed console scripts carry the interpreter in their shebang
([02b](02b-activation-and-discovery.md)) — the same mechanism that makes activation unnecessary makes
uv unnecessary at runtime.

⚠️ **What I could not confirm:** the documentation I checked does not state how `uv run` maps a
child's exit status onto its own, nor what it does when the child is stopped by a signal rather than
exiting. Do not assume a particular exit code in a script; if a pipeline depends on distinguishing
"uv failed" from "the command failed", separate the concerns — sync in one step, run in another
([02d](02d-frozen-and-locked-in-ci.md)).

## `--` and the argument-parsing boundary

`uv run` has its own flags, and so does your command. When they collide, `--` ends uv's parsing:

```bash
uv run pytest -- -x --pdb          # -x and --pdb go to pytest
uv run -- python -V                # unambiguous even for a flag uv also knows
```

The habit worth forming is to put `--` in any script you commit. The day your command grows a flag
uv also recognises, the failure without it is a confusing error from the wrong program — and the day
uv *adds* such a flag in a patch release ([01c](01c-installing-and-pinning-uv.md)), a script that
worked yesterday starts misbehaving with no change of your own.

## Windows: only three script extensions

> *"Currently only legacy scripts with the `.ps1`, `.cmd`, and `.bat` extensions are supported."*

> *"you don't need to specify the extension. `uv` will automatically look for files ending in `.ps1`,
> `.cmd`, and `.bat`"*
> — both [running commands in projects](https://docs.astral.sh/uv/concepts/projects/run/)

The word *"currently"* is uv's, and on a pre-1.0 tool it should be read as a real signal that this
may change. The portable move is to invoke the interpreter rather than the script, which works
identically everywhere:

```bash
uv run python tools/helper.py       # portable
uv run tools/helper.sh              # ⛔ not supported on Windows
```

## Project discovery is relative to the working directory

`uv run` finds the project by walking up from wherever it is invoked
([01b](01b-the-project-uv-sees.md)), which is exactly what you want interactively and a hazard in a
`Makefile`, a `git` hook, or a CI step whose working directory is set by something else. Name it:

```makefile
test:
	uv run --project . --no-sync pytest
```

`--no-project` is the opposite instruction — do not discover a project at all — for when you are
inside a project tree but deliberately want nothing from it.

## Gotchas

**★ Symptom: a container running `uv run` as its entrypoint does not shut down cleanly on `docker stop`.**
Cause: uv is PID 1 and your process is its child; uv forwards *"most signals"*, so you have added a
layer between the orchestrator and the process that needs to drain connections. Fix: run the
application directly and drop uv from the runtime.

```dockerfile
ENV PATH="/app/.venv/bin:$PATH"
CMD ["gunicorn", "myapp.wsgi:application"]
```

**★ Symptom: flags meant for your command were consumed by uv.**
Cause: no `--` separator, and uv recognised the flag as its own. Fix: separate them explicitly.

```bash
uv run pytest -- -x --pdb
```

**★ Symptom: a script that worked with `uv run` last month now errors on one of its own flags.**
Cause: uv added a flag with the same name in a patch release, and without `--` it now claims it. Fix:
add the separator, and pin uv so the surface stops moving.

```bash
uv run -- mytool --check
uv self version
```

**★ Symptom: a Windows CI step cannot run a `.sh` helper through `uv run`.**
Cause: the documented limitation — *"Currently only legacy scripts with the `.ps1`, `.cmd`, and
`.bat` extensions are supported."* Fix: invoke the interpreter rather than the script.

```bash
uv run python tools/helper.py
```

**★ Symptom: `uv run` in a `Makefile` picks a different project than the one you are editing.**
Cause: project discovery walks up from the working directory, and `make` may have changed it. Fix:
name the project.

```makefile
test:
	uv run --project . --no-sync pytest
```

**★ Symptom: `Ctrl-C` leaves a stray process behind on Windows.**
Cause: uv *"ignores Ctrl-C events, deferring handling to the child process so it can exit cleanly"* —
so if the child does not handle it, nothing does. Fix: this is your application's signal handling to
fix, not uv's; make sure the process installs a handler and exits.

**★ Symptom: a CI script cannot tell whether uv failed or your command failed.**
Cause: one invocation is doing two jobs — preparing the environment and running the command — and the
documentation does not settle how the child's status maps onto uv's. Fix: split them so each step has
one meaning.

```bash
uv sync --locked || { echo "environment preparation failed"; exit 1; }
uv run --no-sync pytest
```

## Interview questions

**★ uv says it "does not cede control of the process to the spawned command". What is the trade-off, and where does it matter?**
uv chooses not to `exec`-replace itself, so it remains the parent of your command — and it states the
reason: *"in order to provide better error messages on failure."* The cost is an extra process in the
tree and a dependency on uv's signal forwarding, documented as forwarding *"most signals (with the
exception of SIGKILL, SIGCHLD, SIGIO, and SIGPOLL)"* on Unix, and on Windows as ignoring Ctrl-C so
the child *"can exit cleanly."* For interactive development it is plainly the right trade: a
mysterious failure with no explanation is far more expensive than a process. Where it matters is a
container entrypoint, because `uv run` then becomes PID 1 and every orchestrator signal reaches your
application only because uv passes it on. It works — and the cleaner shape is to avoid the question
by putting `/app/.venv/bin` on `PATH` and exec'ing the application directly, which is uv's own
documented alternative and leaves no uv process at runtime.

**★ Would you use `uv run` in a Dockerfile's `CMD`?**
Not for the process that serves traffic. It works, but it keeps a build-time tool in the runtime
image, adds a process between the orchestrator and the application, and performs a lockfile and
environment check at container start that can only ever be a no-op or an unwelcome surprise. uv's own
guidance offers the alternative directly — put the environment's binary directory at the front of
`PATH` — and it works because installed console scripts carry their interpreter in the shebang. So:
`uv run` for *build* steps, migrations and a debugging shell; `ENV PATH` plus an exec-form `CMD` for
the long-running process.

**★ Why does `SIGKILL` appear in the list of signals uv does not forward, and is that a limitation?**
It is not a limitation; it is a property of the operating system. `SIGKILL` cannot be caught, blocked
or handled by any process, so no program can "forward" it — the kernel terminates the target
immediately. Its presence in uv's list is documentation rather than a caveat: it tells you that if
something `SIGKILL`s the uv process, uv has no opportunity to pass anything on, and the child's fate
is up to the OS and whatever supervises it. The same reasoning covers `SIGCHLD`, `SIGIO` and
`SIGPOLL`, which are about uv's own children and I/O readiness and would be meaningless to relay. The
signals that actually matter operationally — `SIGTERM` and `SIGINT` — are forwarded.

**★ Why should `--` be a habit rather than something you reach for when a command breaks?**
Because the failure it prevents is a *future* failure, and it is silent. Today your command's flags
and uv's flags may not overlap, so everything works. uv is pre-1.0 and adds flags in patch releases,
so the overlap can appear without any change on your side — at which point uv claims the argument and
your command either misbehaves or reports a confusing error about something it never received. Writing
`uv run -- mytool --check` costs three characters and removes the whole class. It is the same
reasoning as quoting shell variables: the cost is nil and the failure it prevents is one you will not
recognise when it arrives.

**Why is `--project .` worth adding in a Makefile even though it looks redundant?**
Because `uv run` locates the project by walking up from the *current working directory*, and in a
`Makefile`, a git hook, or a CI step, that directory is set by something other than you. A recursive
`make` invocation, a `cd` in a sibling target, or a runner that starts in the repository root while
your project lives in a subdirectory all change which `pyproject.toml` is found first. Naming the
project makes the command mean the same thing regardless of where it is invoked from, which is exactly
the property you want in a file that other automation calls. The counterpart flag, `--no-project`, is
for the inverse case: you are inside a project tree and want none of it.

---

← Prev: [04c · uv run](04c-uv-run.md) · [Topic index](README.md) · Next → [05 · uv python](05-uv-python.md)
