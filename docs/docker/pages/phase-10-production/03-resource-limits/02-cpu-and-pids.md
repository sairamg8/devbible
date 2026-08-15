---
title: "CPU and PIDs — the limits that throttle"
sidebar_label: "02 · CPU and PIDs — the limits that throttle"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — resource constraints](https://docs.docker.com/engine/containers/resource_constraints/),
> [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> (`--pids-limit` default **2048**; `--memory`, `--cpus` and `--pids-limit` are *not
> supported on cgroups V1 rootless systems*), [cgroups(7)](https://man7.org/linux/man-pages/man7/cgroups.html),
> the Node.js [`os`](https://nodejs.org/api/os.html) documentation and
> [systemd.resource-control(5)](https://www.man7.org/linux/man-pages/man5/systemd.resource-control.5.html).
> **No sandbox** — no console output on this page.

**A CPU limit never kills anything. It makes your process wait.** Which means the
symptom is not a crash but latency — and latency that appears at a CPU
utilisation figure which looks perfectly healthy on a dashboard.

## `--cpus` is a quota per period

The CFS scheduler gives the cgroup a **quota** of CPU time per fixed **period**
(cgroup v2 writes both into `cpu.max`). `--cpus` is the friendly spelling:

```bash
docker run --cpus="1.5" myimage             # 1.5 CPUs' worth of time per period
docker run --cpu-period=100000 --cpu-quota=150000 myimage   # the same thing
```

On a two-CPU host, `--cpus="1.5"` means the container is guaranteed *at most* one
and a half CPUs. The important word is **at most**, and the important hidden
detail is *per period*: when the cgroup spends its quota early in a period, every
thread in it is **stopped until the next period begins**.

That is where the counter-intuitive failure lives:

- **A container can be throttled at 40% average CPU.** Averages hide the shape.
  Work that arrives in bursts — a request that fans out across threads, a GC
  pause, a JSON parse of something large — burns the whole quota in a few
  milliseconds and then waits out the rest of the period.
- **The symptom is tail latency, not throughput.** p50 is fine, p99 has a cliff
  at a suspiciously regular value, and no single component looks slow.
- **The evidence is in the cgroup, not in `docker stats`.** `cpu.stat` counts
  `nr_throttled` and `throttled_usec`; a rising `nr_throttled` while utilisation
  looks moderate *is* the diagnosis. Where those numbers surface for you is
  **11 · Observing** *(not written yet)*.

The fix is usually one of: raise the quota, lower the concurrency inside the
container so bursts are smaller, or accept the throttling because the workload is
genuinely batch. It is almost never "add more replicas", which multiplies the
problem.

## Shares and pinning are different tools

| Flag | Kind | When it matters |
|---|---|---|
| `--cpus`, `--cpu-quota`/`--cpu-period` | **Hard cap** | Always — even on an idle host |
| `--cpu-shares` | **Relative weight**, default **1024** | Only under contention; ignored when the host is idle |
| `--cpuset-cpus` | **Pinning** to specific cores | Cache locality, NUMA, or keeping a noisy neighbour off a core |

`--cpu-shares` is the one people set expecting a limit. It is a proportion: two
containers at 1024 and 512 split a contended CPU two-to-one, and on an unloaded
host both run as fast as they like. **If you wanted a ceiling, you wanted
`--cpus`.**

`--cpuset-cpus="0,1"` is a genuine affinity mask, which matters below — it is
visible to a process asking about parallelism in a way a CFS quota is not.

## The runtime does not know, again

The same problem as the heap, in a different costume: runtimes size their thread
pools from the machine, and the machine is not what the container got.

- **Node** documents this explicitly: *`os.cpus().length` should not be used to
  calculate the amount of parallelism available to an application* — use
  **`os.availableParallelism()`** (v18.14.0 / v19.4.0), a wrapper around libuv's
  `uv_available_parallelism()`. That accounts for the process's CPU **affinity
  mask**, so `--cpuset-cpus` is reflected. ⚠️ **A CFS quota is not an affinity
  mask**, and whether it is taken into account has varied with the libuv version,
  so **do not infer your concurrency from a `--cpus` value being detected**. Set
  worker counts and pool sizes explicitly when you set a quota.
- **`cluster` with one worker per `os.cpus().length`** is the classic version of
  this bug: eight workers inside `--cpus="1"`, all competing for one CPU's worth
  of quota, each with its own heap counted against the same memory limit.
- **The JVM** derives its thread pools from an active-processor count that
  honours container limits; **Go** sets `GOMAXPROCS` from the CPU count it sees.
  Both are worth setting explicitly when a quota is in play.

The rule that survives all of it: **when you set a CPU quota, set the
application's concurrency to match.** Detection is a convenience, not a contract.

## `--pids-limit`: the cheap one nobody sets

```bash
docker run --pids-limit=256 myimage       # -1 for unlimited
podman run --pids-limit=256 myimage
```

It caps the number of processes **and threads** in the cgroup (`pids.max`). The
defaults differ, and the difference is worth knowing:

| Engine | Default |
|---|---|
| Docker | none listed — effectively unlimited unless you set it |
| **Podman** | **2048**, on systems with the `pids` cgroup controller |

Two reasons to set one:

- **It converts a fork bomb or a runaway spawn into a bounded, obvious failure.**
  Without it, a container can exhaust the host's PID space and take neighbours
  with it.
- **It makes zombie accumulation visible early.** The slow PID leak from
  [topic 01](../01-pid-1/01-what-the-kernel-does.md) — orphans reparented to a
  PID 1 that never reaps — hits a container-local wall instead of the host's, and
  hits it while the cause is still findable.

⚠️ **Threads count.** A runtime with a large thread pool, or one thread per
connection, can pass a low `--pids-limit` in normal operation and fail under
load with "resource temporarily unavailable" — the same message the zombie
failure produces, from a different cause. Size it against peak threads, not
against the number of processes you think you have.

## `--ulimit` is a different layer

```bash
docker run --ulimit nofile=8192:16384 myimage
```

`--ulimit` sets per-process kernel limits — open file descriptors being the one
that matters, because every socket is one. A server that accepts thousands of
connections fails on `EMFILE` with an unremarkable-looking limit, and this is not
a cgroup setting: it applies per process, where `--pids-limit` applies to the
whole container.

## Where to set all of this

```yaml
services:
  api:
    cpus: 1.5                     # Compose short form
    pids_limit: 256
    mem_limit: 512m
    deploy:
      resources:
        limits: {cpus: '1.5', memory: 512M}
```

Under systemd, the same three are `CPUQuota=`, `TasksMax=` and `MemoryMax=` from
`systemd.resource-control(5)` — which is how a Quadlet unit expresses them
(Phase 11). **A container run four different ways has four places to keep in
agreement**, and that mismatch is a recurring entry in
**06 · The production failure catalogue** *(not written yet)*.

## Podman

The flags match Docker's, with the same rootless caveat as memory: `--cpus`,
`--memory` and `--pids-limit` are **not supported on cgroups V1 rootless
systems**. Two practical notes:

- **Podman 6 removed cgroups v1 entirely**, which makes this a non-question on a
  current system and a real one on an old rootless host — where the limit you
  set may quietly not apply.
- Rootless resource control depends on the user session having the controllers
  delegated to it. Where it is not delegated, the failure is again *silent
  non-enforcement* rather than an error, so verify a limit is in force before
  relying on it in a rootless deployment.

## Gotchas

**Symptom:** p99 latency has a cliff at a regular value; CPU utilisation looks
moderate.
**Cause:** CFS throttling. The quota is spent early in each period and every
thread waits for the next one.
**Fix:** Check `nr_throttled` in the cgroup's `cpu.stat`. Then raise the quota or
reduce in-container concurrency — not replicas.

**Symptom:** `--cpu-shares` was set and the container still uses the whole
machine.
**Cause:** Shares are a relative weight under contention, not a ceiling.
**Fix:** `--cpus`. Shares only decide who wins when several cgroups want CPU at
once.

**Symptom:** A Node service is far slower inside `--cpus="1"` than the same code
outside it, and memory use is much higher too.
**Cause:** `cluster` sized from `os.cpus().length` — host CPUs — so N workers
share one CPU's quota and N heaps share one memory limit.
**Fix:** Size workers from the quota you set, using `os.availableParallelism()`
as a floor rather than a source of truth.

**Symptom:** "Resource temporarily unavailable" under load, with no zombies.
**Cause:** `--pids-limit` counts threads, and the runtime's pool crossed it at
peak.
**Fix:** Size the limit against peak threads. Keep the limit — it is what makes
the failure bounded and legible.

## Interview questions

**★ What is the difference between a memory limit and a CPU limit?**
Memory is enforced by killing — the cgroup OOM killer `SIGKILL`s a process and
the container exits 137. CPU is enforced by throttling — threads are stopped
until the next scheduling period. One produces a dead container with no logs, the
other a live container with latency.

**★ A service is throttled at 40% average CPU. How?**
Because the quota is per period. Bursty work spends the whole quota in the first
few milliseconds of each 100 ms period and then waits, so the average across the
period looks low while the tail latency is dominated by waiting. `nr_throttled`
in `cpu.stat` is the evidence.

**★ `--cpus` versus `--cpu-shares`?**
`--cpus` is a hard cap enforced as a CFS quota per period, in force even on an
idle host. `--cpu-shares` is a relative weight, default 1024, that only decides
proportions when cgroups actually contend. Setting shares when you meant a
ceiling is a common and silent mistake.

**Why set `--pids-limit` at all?**
It bounds processes and threads inside the container, turning a fork bomb or a
PID leak into a container-local failure instead of a host-wide one — and it makes
the zombie-reaping problem hit a visible wall while the cause is still findable.
Podman defaults it to 2048; Docker sets none.

**Why should a containerised runtime not trust `os.cpus().length` or the host's
memory?**
Because both report the machine, not the container's cgroup limits. Node's own
documentation says not to use `os.cpus().length` for parallelism and points to
`os.availableParallelism()`, which reflects the affinity mask — but a CFS quota
is not an affinity mask, so concurrency should be set explicitly alongside the
quota.

**What does `--ulimit nofile` solve that `--pids-limit` does not?**
Open file descriptors, which every socket consumes. It is a per-process kernel
limit, not a cgroup one, and it produces `EMFILE` under connection load rather
than a fork failure.

---

← [01 · Memory — the limit that kills](01-memory-the-limit-that-kills.md) · [Topic index](README.md)
