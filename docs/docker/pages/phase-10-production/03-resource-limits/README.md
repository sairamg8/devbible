---
title: "03 · Resource limits"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — resource constraints](https://docs.docker.com/engine/containers/resource_constraints/),
> [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [docker inspect](https://docs.docker.com/reference/cli/docker/inspect/),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [cgroups(7)](https://man7.org/linux/man-pages/man7/cgroups.html),
> [systemd.resource-control(5)](https://www.man7.org/linux/man-pages/man5/systemd.resource-control.5.html)
> and the Node.js [`os`](https://nodejs.org/api/os.html) documentation.
> **No sandbox** — no console output on this page.

The syllabus row is *`--memory`, `--cpus`, `--pids-limit`; what an OOM kill looks
like (exit 137) and why the process "just vanished".*

🔴 **A memory limit is enforced by killing. A CPU limit is enforced by
waiting.** Every symptom in this topic follows from that asymmetry — which is
also why one failure leaves no logs and the other leaves no obvious failure at
all.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Memory — the limit that kills](01-memory-the-limit-that-kills.md)** | What the cgroup limit does and why the OOM killer picks PID 1; why `SIGKILL` leaves no evidence in your logs; the three causes of exit 137 and the one field that separates them; `--memory`, the counter-intuitive `--memory-swap` table, the soft `--memory-reservation` and why `--oom-kill-disable` makes things worse; and sizing the limit when the runtime sizes its heap from the wrong number |
| 02 | **[CPU and PIDs — the limits that throttle](02-cpu-and-pids.md)** | `--cpus` as a quota per period, and why a service is throttled at 40% average CPU; `nr_throttled` as the real evidence; shares versus quota versus pinning; runtimes that read the host CPU count, and what `os.availableParallelism()` does and does not reflect; `--pids-limit` (Docker none, Podman 2048) as the cheap bound on fork bombs and PID leaks; `--ulimit nofile`; and the rootless cgroups-v1 caveat |

## Four facts worth carrying out of this topic

- **Exit 137 with `OOMKilled=true` is a memory limit; with `false` it is a stop
  timeout or a `kill`.** One `docker inspect` settles it.
- **The container limit must sit meaningfully above the heap limit**, because the
  cgroup charges native memory, buffers and stacks that the heap flag does not.
- **`--cpu-shares` is not a ceiling.** Only `--cpus` (quota/period) caps anything.
- **Throttling shows up as tail latency at healthy-looking utilisation.** Averages
  hide the bursts that spend the quota.

## Phase gate

You can size memory and CPU for a Node service and justify both numbers, read a
137 correctly from `docker inspect` alone, and explain a p99 cliff at moderate
CPU without reaching for "add more replicas".

## Where this connects

- [01 · PID 1 is not a normal process](../01-pid-1/README.md) — why killing PID 1
  ends the container, and the PID leak `--pids-limit` bounds
- [02 · Graceful shutdown](../02-graceful-shutdown/README.md) — the *other* source
  of exit 137
- [Phase 0 · 03 · cgroups](../../phase-0-what-a-container-is/03-cgroups.md) — the
  mechanism every flag on this page writes to
- [Phase 1 · 09 · Exit codes](../../phase-1-running-containers/09-exit-codes.md) —
  137, 143 and the rest
- [Phase 1 · 03 · ps, inspect, logs, stats](../../phase-1-running-containers/03-ps-inspect-logs-stats.md)
  — where the evidence is read
- [06 · The production failure catalogue](../06-failure-catalogue/README.md) ·
  [11 · Observing](../11-observing.md) ·
  [14 · Running containers under systemd](../14-under-systemd.md)

---

Start → [01 · Memory — the limit that kills](01-memory-the-limit-that-kills.md)
