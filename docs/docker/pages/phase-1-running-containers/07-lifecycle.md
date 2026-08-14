---
title: "The container lifecycle"
sidebar_label: "07 · The lifecycle"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker container create](https://docs.docker.com/reference/cli/docker/container/create/),
> [docker container start](https://docs.docker.com/reference/cli/docker/container/start/),
> [docker container pause](https://docs.docker.com/reference/cli/docker/container/pause/)
> and the equivalent Podman man pages. **No sandbox** — no console output on this
> page.

**A container moves through a small, well-defined set of states, and the
commands that move it between them are separate on purpose.** Knowing the states
turns "the container is broken" into a specific question with a specific answer.

## The states

```
            docker create
                 │
                 ▼
            ┌─────────┐   start    ┌─────────┐   pause    ┌────────┐
            │ created │ ─────────▶ │ running │ ─────────▶ │ paused │
            └─────────┘            └─────────┘ ◀───────── └────────┘
                 │                   │     ▲     unpause
                 │            stop / │     │ start
                 │            kill / │     │
                 │       process ends▼     │
                 │                 ┌─────────┐
                 └────────────────▶│ exited  │
                        rm         └─────────┘
                                        │ rm
                                        ▼
                                   (gone — writable layer destroyed)
```

| State | What it means |
|---|---|
| **created** | Configured, filesystem prepared, **nothing running** |
| **running** | The process is executing |
| **paused** | Processes frozen in place via the freezer cgroup — memory retained |
| **restarting** | Between attempts, under a restart policy |
| **exited** | The process finished. The writable layer still exists |
| **dead** | The engine failed to remove it cleanly — rare, and a bad sign |

`docker ps -a` shows the state; `docker inspect --format '{{.State.Status}}'`
gives it to a script.

## The commands

```bash
docker create --name api myorg/api:1.4.2   # configure, do not start
docker start api                           # created/exited → running
docker stop api                            # → exited, politely (page 08)
docker restart api                         # stop then start
docker kill api                            # → exited, immediately (SIGKILL)
docker pause api / docker unpause api      # freeze / thaw
docker rm api                              # exited → gone
```

Two that are worth using more than people do:

- **`create` + `start`** splits container creation from execution. If `create`
  succeeds and `start` fails, the problem is the entrypoint or the image, not
  your flags. It is also how you configure something now and start it later.
- **`pause`** freezes processes with the freezer cgroup while keeping memory
  intact. Useful to take a consistent snapshot of a volume, or to stop a runaway
  container from consuming CPU without losing its state.

## Exited is not gone

The most common misunderstanding in this phase:

> **`stop` ends the process. `rm` destroys the container.**

A stopped container still holds its writable layer, its configuration, its name
and its ID. `docker start` brings it back with everything intact. This is why:

- a name stays "already in use" after stopping,
- `docker ps` looks empty while `docker ps -a` shows a dozen containers,
- and disk keeps filling with things nobody is running.

Only `docker rm` (or `--rm` at run time) reclaims it.

## Why containers exit immediately

A container lives exactly as long as its **PID 1**. When that process returns,
the container is done. The reasons, in the order you should check them:

| Reason | How it looks | Fix |
|---|---|---|
| The command finished normally | `Exited (0)` | Nothing wrong. `alpine echo hi` is supposed to exit |
| The process crashed | `Exited (1)` and a stack trace in `logs` | Fix the application |
| The binary was not found | `Exited (127)` | Check the `CMD`; page 09 |
| The process daemonised itself | `Exited (0)`, nothing ran | Run it in the **foreground** — no `-D`, no `--daemon`, no `&` |
| It was killed | `Exited (137)` | OOM or `kill`; page 09 |
| No work to do | `Exited (0)` immediately | `alpine` with no command just exits. `-it` gives it a shell to hold |

**The daemonising case is the one that surprises people.** `nginx` started with
its default config runs in the foreground in the official image, on purpose.
Configure a service to background itself and the container exits the moment it
forks — the container has no init to keep it alive, because it is one process,
not a machine.

## Podman

Same states, same verbs, same semantics. Two notes:

- `podman ps -a` and `podman inspect` report the same status strings, so scripts
  transfer.
- Because there is no daemon, a `created` container is just database state on
  disk; nothing is holding it. This is what makes Quadlet units clean — systemd
  becomes the thing that starts and supervises, rather than a daemon (Phase 11).

## Gotchas

**Symptom:** The container exits instantly with code 0 and no logs.
**Cause:** Its command completed, or the service daemonised itself and PID 1
returned.
**Fix:** Run the process in the foreground. Every official image already does
this — copy the pattern rather than adding `&`.

**Symptom:** `docker start` on a container that exited 0 does nothing visible.
**Cause:** It ran the same short-lived command again and exited again.
**Fix:** `docker logs` will show the second run. `start` re-runs the original
command; it does not resume anything.

**Symptom:** A paused container appears hung and unreachable.
**Cause:** It is paused — processes are frozen, so connections time out.
**Fix:** `docker unpause`. `docker ps` shows `(Paused)`; it is easy to miss when
scanning.

**Symptom:** A container is stuck in `Removal In Progress` or shows `dead`.
**Cause:** The engine could not clean up — usually a busy mount or a stuck
filesystem.
**Fix:** `docker rm -f`, and if that fails look for the mount on the host. A
`dead` container usually means something is wrong at the storage layer, not with
your image.

## Interview questions

**★ What is the difference between `docker stop` and `docker rm`?**
`stop` ends the process, leaving an `exited` container that keeps its writable
layer, configuration and name. `rm` destroys the container and that layer.
`start` after `stop` brings it back intact; after `rm` there is nothing to start.

**★ Why does a container exit immediately after starting?**
Because its PID 1 returned. Either the command genuinely finished, it crashed,
the binary was not found, or the service daemonised itself so the foreground
process ended. Check `docker ps -a` for the exit code and `docker logs` for the
reason.

**★ Why must a containerised service run in the foreground?**
A container lives exactly as long as PID 1. If the service forks and the parent
returns, the container exits and takes the daemonised child with it — there is no
init system inside to keep anything alive.

**When would you use `docker create` instead of `docker run`?**
To configure a container without starting it — pre-creating it for something else
to start — and as a debugging split: if `create` succeeds and `start` fails, the
fault is in the image's entrypoint rather than in your flags.

**What does `docker pause` actually do?**
Freezes the container's processes using the freezer cgroup, keeping memory
intact. Useful for consistent snapshots or to halt a runaway container without
losing its state. Unlike `stop` it sends no signal, so the application never
knows.

---

← Prev: [Environment variables](06-environment.md) · Index: [Phase 1](README.md) · Next → [Stop is two signals](08-stop-is-two-signals.md)
