---
title: "cgroups v2 — what the container may use"
sidebar_label: "03 · cgroups v2"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [cgroups(7)](https://man7.org/linux/man-pages/man7/cgroups.7.html),
> [Docker — Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)
> and the [Podman 6.0 release notes](https://github.com/containers/podman/releases)
> for the removal of cgroups v1. **No sandbox** — no console output on this page.

**Namespaces decide what a process can see. cgroups decide what it may
consume.** A container without cgroups is isolated and still able to take the
whole machine down; that is why both halves are required.

## The unified hierarchy

cgroups v2 puts every controller in **one** hierarchy, mounted at
`/sys/fs/cgroup`. This is the headline change from v1, where each controller
(memory, cpu, blkio…) had its own separately-mountable tree and the controllers
had been, in the man page's words, developed largely uncoordinated.

Two v2 rules are worth knowing because they explain error messages:

- **Controllers must be explicitly enabled** for children, by writing to
  `cgroup.subtree_control`. A controller that looks "missing" is often just not
  enabled on that subtree.
- **The "no internal processes" rule** — processes may live only in leaf
  cgroups, never in a cgroup that has children (the root is the exception).
  This removes v1's ambiguity about how to split resources between a parent's
  own processes and its children.

🔴 **Podman 6.0 removed cgroups v1 support entirely.** Every mainstream
distribution defaults to v2 and has for years, so this mostly matters if you meet
an old host. Docker still supports v1 hosts but treats v2 as the target.

## The files that matter

You can read a container's real limits and real usage from inside it. This is
the cure for every "the limit is being ignored" argument:

```bash
# Inside the container, on a cgroups v2 host
cat /sys/fs/cgroup/memory.max        # the ceiling ("max" means unlimited)
cat /sys/fs/cgroup/memory.current    # what it is using right now
cat /sys/fs/cgroup/cpu.max           # "quota period" in microseconds
cat /sys/fs/cgroup/pids.max          # process/thread cap
```

| File | Meaning |
|---|---|
| `memory.max` | Hard ceiling. Exceeding it triggers the OOM killer **inside this cgroup** |
| `memory.high` | Soft ceiling — the kernel throttles allocation rather than killing |
| `memory.current` | Current usage, the number to compare against the ceiling |
| `cpu.max` | Two values: quota and period. `50000 100000` means half a CPU |
| `cpu.weight` | Relative share when CPUs are contended — not a cap |
| `pids.max` | Maximum processes and threads; the fork-bomb defence |

## The flags that set them

| Flag | Sets | Notes |
|---|---|---|
| `--memory` / `-m` | `memory.max` | The one that matters. Without it, a leak takes the host down |
| `--memory-reservation` | `memory.high`-like soft limit | Pressure, not a kill |
| `--memory-swap` | Memory **plus** swap total | Set equal to `--memory` to forbid swap |
| `--cpus` | `cpu.max` | `--cpus=1.5` is a real ceiling in CPU-time terms |
| `--cpu-shares` | `cpu.weight` | Relative weight under contention only; not a limit |
| `--cpu-period` / `--cpu-quota` | `cpu.max` directly | The long-hand `--cpus` is sugar for |
| `--cpuset-cpus` | Which physical CPUs | Pinning, e.g. `0-3` |
| `--pids-limit` | `pids.max` | Cheap insurance against runaway thread creation |

```bash
docker run -d --name api \
  --memory=512m --memory-swap=512m \
  --cpus=1.5 --pids-limit=256 \
  myorg/api:1.4.2
```

The same flags work on `podman run`. In Compose they live under
`deploy.resources.limits` — Phase 8 covers the syntax difference, which is one of
Compose's genuinely awkward corners.

## What "out of memory" actually does

This is the mechanism behind exit code **137**, and it is worth being precise
because the wrong diagnosis wastes hours.

When a cgroup's usage would exceed `memory.max`, the kernel invokes the OOM
killer **scoped to that cgroup** and kills a process inside it — usually the
biggest one, which is usually your application. The container then exits with
`137` (128 + 9, i.e. `SIGKILL`).

Two things follow:

1. **`--memory` does not make your application use less memory.** It makes the
   kernel kill it sooner. Limits are a blast-radius control, not a tuning knob.
2. **The application gets no warning and cannot clean up.** `SIGKILL` is not
   catchable. If graceful behaviour matters, keep usage well under the limit and
   watch `memory.current`, rather than relying on the kill.

Docker's documentation is explicit that by default an OOM condition means the
kernel kills processes in the container, and that `--oom-kill-disable` should
only ever be paired with `--memory` — otherwise you have merely moved the
failure onto the host, which is strictly worse.

## The trap: applications that cannot see their own limit

Because `/proc/meminfo` and CPU count are **not** namespaced (see
[Namespaces](02-namespaces.md)), a program that sizes itself from "available
memory" or "number of CPUs" reads the **host's** figures and sizes itself for a
machine it does not have.

Concretely, on a 64 GB / 32-core host with `--memory=512m --cpus=2`:

- A JVM without container awareness picks a heap based on 64 GB.
- A thread pool sized to `os.cpus().length` creates 32 threads for 2 CPUs.
- A worker-per-core process manager forks 32 workers into a 512 MB ceiling.

Each of these is a straight path to exit 137, and none of them looks like a
memory bug in your code. Modern JVMs read the cgroup; Node does not size the
heap from it automatically. **Pass the intended figures in explicitly** —
`--max-old-space-size`, a `WEB_CONCURRENCY` variable, an explicit pool size — and
treat "reads the machine" as a bug in a containerised process.

## Gotchas

**Symptom:** Container dies with exit code 137 and no application error in the
logs.
**Cause:** OOM kill by the kernel. `SIGKILL` cannot be caught, so nothing was
logged by the app.
**Fix:** Confirm it — `docker inspect --format '{{.State.OOMKilled}}' <name>`
returns `true`. Then either raise `--memory` or find the leak. Watch
`memory.current` against `memory.max` over time rather than sampling once.

**Symptom:** The container is slow but nothing is dying, and CPU usage sits at a
suspiciously flat number.
**Cause:** CPU quota throttling — the cgroup exhausts its quota inside each
period and is descheduled until the next one.
**Fix:** Check throttling counters in `cpu.stat` (`nr_throttled`,
`throttled_usec`). Raise `--cpus`, or reduce concurrency. A latency spike with
flat CPU is the signature.

**Symptom:** `--cpu-shares=512` "did nothing".
**Cause:** Shares are a *relative weight applied only under contention*. On an
idle host a container with a low weight still gets everything it asks for.
**Fix:** Use `--cpus` when you want a ceiling. Use shares only for prioritising
between containers competing for a saturated host.

**Symptom:** "We set a memory limit, but the host still ran out of memory."
**Cause:** Swap. `--memory=512m` without `--memory-swap` permits swap use beyond
the ceiling.
**Fix:** Set `--memory-swap` equal to `--memory` to forbid swap entirely, which
is what you almost always want for a server.

## Interview questions

**★ What is the difference between namespaces and cgroups?**
Namespaces control visibility — what a process can see. cgroups control
consumption — how much CPU, memory, PIDs and I/O it may use. A container needs
both; either alone is insufficient.

**★ What does exit code 137 mean?**
128 + 9 — the process received `SIGKILL`. In a container the usual cause is the
kernel OOM killer enforcing `memory.max`, but a `docker kill`, or a `docker stop`
whose grace period expired, produces the same code. Distinguish them with
`.State.OOMKilled` in `docker inspect`.

**★ Why does an application inside a container sometimes size itself for the
whole host?**
Because CPU count and total memory are not namespaced. `/proc/meminfo` and the
CPU list report host values, so anything reading them sizes for the host. Read
the cgroup files, or pass the values explicitly.

**`--cpus` versus `--cpu-shares` — when do you use each?**
`--cpus` is an absolute ceiling and is what you want for predictable behaviour
and capacity planning. `--cpu-shares` is a relative weight that only takes effect
when CPUs are contended, useful for prioritising batch work below interactive
work on a shared host.

**What changed in cgroups v2?**
One unified hierarchy instead of per-controller hierarchies, controllers enabled
explicitly through `cgroup.subtree_control`, a consistent interface-file naming
scheme, and the "no internal processes" rule that confines processes to leaf
cgroups. Podman 6.0 dropped v1 support entirely.

**Does setting a memory limit make my application use less memory?**
No. It makes the kernel kill it sooner. Limits bound the blast radius of a leak;
they are not a tuning mechanism, and treating them as one produces a service that
restarts on a timer.

---

← Prev: [Namespaces](02-namespaces.md) · Index: [Phase 0](README.md) · Next → [The image is not the container](04-image-vs-container.md)
