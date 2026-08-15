---
title: "ps, inspect, logs and stats"
sidebar_label: "03 · ps, inspect, logs, stats"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker container ls](https://docs.docker.com/reference/cli/docker/container/ls/),
> [docker inspect](https://docs.docker.com/reference/cli/docker/inspect/),
> [docker container logs](https://docs.docker.com/reference/cli/docker/container/logs/),
> [docker container stats](https://docs.docker.com/reference/cli/docker/container/stats/)
> and the equivalent Podman man pages. **No sandbox** — no console output on this
> page.

**Four commands, four different questions.** Knowing which one answers which is
most of the difference between debugging a container in two minutes and
guessing at it for twenty.

| Command | The question it answers |
|---|---|
| `ps` | **Is it running?** — and if not, why did it stop |
| `inspect` | **How was it configured?** — the full truth about mounts, env, network |
| `logs` | **What did it say?** — the application's own account |
| `stats` | **What is it consuming?** — live CPU, memory, network, I/O |

Run them in that order and you will rarely need anything else.

## `ps` — is it running

```bash
docker ps                    # running
docker ps -a                 # everything, including exited
docker ps -s                 # + writable-layer size
docker ps -a --filter status=exited
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
```

The **STATUS** column is the payload, and it is more informative than it looks:

| Status | Means |
|---|---|
| `Up 3 hours` | Running |
| `Up 3 hours (healthy)` | Running, and its `HEALTHCHECK` is passing |
| `Up 20 seconds (health: starting)` | Inside the healthcheck's start period |
| `Up 2 minutes (unhealthy)` | Running, healthcheck failing — **still serving traffic** |
| `Exited (0) 5 minutes ago` | Finished cleanly |
| `Exited (137) 1 minute ago` | Killed — OOM or `kill` (page 09) |
| `Restarting (1) 4 seconds ago` | Crash loop; the restart policy is hiding a failure |

`Restarting` repeated is the one to notice. The container looks "up" to a casual
glance while failing continuously.

## `inspect` — how it was configured

`inspect` returns the entire configuration and state as JSON. Unfiltered it is
overwhelming; with `--format` it is precise:

```bash
docker inspect api                                          # everything

docker inspect --format '{{.State.Status}}'      api
docker inspect --format '{{.State.ExitCode}}'    api
docker inspect --format '{{.State.OOMKilled}}'   api        # the exit-137 question
docker inspect --format '{{.State.Pid}}'         api        # host PID, for nsenter
docker inspect --format '{{json .Mounts}}'       api        # what is mounted where
docker inspect --format '{{json .Config.Env}}'   api        # the real environment
docker inspect --format '{{json .NetworkSettings.Networks}}' api
```

`inspect` is the **arbiter**. When someone says "the environment variable is
set" or "the volume is mounted", this is what settles it — it reports what the
engine actually did, not what the Compose file intended.

## `logs` — what it said

```bash
docker logs api
docker logs -f api                  # follow
docker logs --tail 100 api
docker logs --since 10m api
docker logs -t api                  # timestamps
```

Two facts that explain most log confusion:

1. **`logs` shows stdout and stderr of PID 1, and nothing else.** An application
   writing to a file inside the container produces no output here. That is why
   "log to stdout" is the container contract (Phase 10).
2. **It reads what the log driver captured.** With the default `json-file`
   driver the history is on disk and survives restarts; with some other drivers
   `docker logs` returns nothing at all, by design.

## `stats` — what it is consuming

```bash
docker stats                 # live, all containers
docker stats api             # one
docker stats --no-stream     # a single sample, for scripts
```

`stats` reads the **cgroup**, so unlike `free` or `top` *inside* the container it
reports the truth: `MEM USAGE / LIMIT` shows real usage against the real ceiling.
When you suspect an OOM kill, this is where you watch the approach.

## The triage sequence

A container is misbehaving. In order:

1. **`docker ps -a`** — running, exited, or restarting? With what code?
2. **`docker logs --tail 100`** — did the application explain itself?
3. **`docker inspect`** — is it configured the way you believe? Env, mounts,
   network, command.
4. **`docker stats`** — is it starving for memory or being throttled?

Most failures are settled at step 1 or 2. Step 3 catches the ones where the
config differs from your mental model, which is the category that wastes the most
time precisely because nothing looks wrong.

## Podman

All four commands exist with the same names, flags and `--format` syntax. One
difference: `podman logs` for a rootless container reads what `conmon` wrote, and
the default log driver on many distributions is `journald` rather than
`json-file` — so log retention follows the journal's rules rather than a Docker
config. Check `podman info` if history seems shorter than expected.

## Gotchas

**Symptom:** `docker logs` is empty although the application definitely logs.
**Cause:** It writes to a file inside the container, or to a logging library
configured for a file, rather than to stdout/stderr.
**Fix:** Configure the application to log to stdout. This is the container
contract, not a preference — Phase 10.

**Symptom:** `docker inspect` shows an environment variable your Compose file
does not set.
**Cause:** It came from the image's `ENV`, an `env_file`, or the shell
environment via interpolation.
**Fix:** `inspect` is the arbiter, so trust it and trace backwards. Phase 8
covers the precedence order that produces this.

**Symptom:** `docker stats` shows memory far above what the application reports
using.
**Cause:** The cgroup figure includes page cache attributable to the container.
**Fix:** Expected. Compare against `memory.max`, and look at trends rather than
absolutes. Cache is reclaimable under pressure and is not a leak.

**Symptom:** The container says `(unhealthy)` and traffic is still reaching it.
**Cause:** A `HEALTHCHECK` in plain Docker only reports; it does not stop, remove
or de-route anything on its own.
**Fix:** Act on it — a restart policy, an orchestrator, or a proxy that reads
health. Phase 8 and Phase 10.

## Interview questions

**★ A container is not responding. What do you run, in what order, and why?**
`docker ps -a` (running, exited or restarting, and the exit code), then
`docker logs --tail 100` (the app's own account), then `docker inspect` (is the
configuration what I believe), then `docker stats` (resource starvation). Each
answers a different question and they narrow fastest in that order.

**★ Why is `docker logs` empty for an application that is definitely logging?**
It only shows stdout and stderr of the container's main process. Anything written
to a file inside the container is invisible to it — which is why logging to
stdout is the container contract.

**★ How do you tell whether a container was OOM-killed?**
`docker inspect --format '{{.State.OOMKilled}}' <name>`. The exit code 137 alone
is ambiguous — a `docker kill`, or a `stop` whose grace period expired, produces
the same code.

**What does `Restarting (1)` in `docker ps` tell you?**
It is in a crash loop: exiting with code 1 and being restarted by its restart
policy. The policy is masking a failure, so the real information is in
`docker logs`, not in the status.

**Why does `docker stats` disagree with `free` inside the container?**
`stats` reads the cgroup — the container's real usage and real limit. `free`
reads `/proc/meminfo`, which is not namespaced and reports the host. `stats` is
correct.

---

← Prev: [Foreground, detached and cleanup](02-detached-and-cleanup.md) · Index: [Phase 1](README.md) · Next → [exec versus run](04-exec-vs-run.md)
