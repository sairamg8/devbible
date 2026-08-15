---
title: "Observing"
sidebar_label: "11 · Observing"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [docker container stats](https://docs.docker.com/reference/cli/docker/container/stats/),
> [Docker — runtime metrics](https://docs.docker.com/engine/containers/runmetrics/),
> [Collect Docker metrics with Prometheus](https://docs.docker.com/engine/daemon/prometheus/),
> [podman-stats(1)](https://docs.podman.io/en/latest/markdown/podman-stats.1.html)
> and the [cAdvisor README](https://github.com/google/cadvisor).
> **No sandbox** — no console output on this page.

**Every number that matters is in the cgroup; `docker stats` is one convenient and
slightly lossy view of it.** Knowing that is the whole of this topic, because the
two most common monitoring mistakes both come from trusting a summary — the tool's
memory figure, or the host's.

## `docker stats`

> "returns a live data stream for running containers"

| Column | The documentation's words |
|---|---|
| `CPU %` / `MEM %` | "the percentage of the host's CPU and memory the container is using" |
| `MEM USAGE / LIMIT` | "the total memory the container is using, and the total amount of memory it is allowed to use" |
| `NET I/O` | "The amount of data the container has received and sent over its network interface" |
| `BLOCK I/O` | "The amount of data the container has written to and read from block devices" |
| `PIDS` | "the number of processes or threads the container has created" |

```bash
docker stats                                   # live, all running containers
docker stats --no-stream                       # one sample, for a script
docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

`--no-stream` "disable[s] streaming stats and only pull[s] the first result", which
is the form that belongs in a script or an alert; the default streams forever.
`--all` shows stopped containers too, with empty numbers.

**`MEM USAGE / LIMIT` is the pair to read together.** The limit is what
[topic 03](03-resource-limits/01-memory-the-limit-that-kills.md) set, and usage
approaching it is the only early warning you get before exit 137.

## 🔴 The CLI subtracts the page cache; the API does not

The single most important sentence on the command's reference page: on Linux
**"the Docker CLI reports memory usage by subtracting cache usage from the total
memory usage"**, while the API returns both values so a client can choose.

That matters because **the kernel kills on the total, not on the CLI's figure.**
A container reading large files accumulates page cache that counts toward the
cgroup's usage; the CLI hides it, so `docker stats` can show comfortable headroom
shortly before an OOM kill. The cache is reclaimable — the kernel will drop it
under pressure rather than kill immediately — but a dashboard built on the CLI
number and one built on the API number will disagree, and only one of them is
watching what the limit is enforced against.

**So: alerting built on `docker stats` output is alerting on a derived number.**
Anything serious reads the API or the cgroup files.

## Host memory and cgroup memory are different questions

The syllabus row names this and it is the classic mistake:

- **Inside the container, `free` and `/proc/meminfo` report the host.** They are
  not namespaced per cgroup, so a 512 MB container on a 64 GB host sees 64 GB.
  Runtimes inherit the error — [topic 03](03-resource-limits/01-memory-the-limit-that-kills.md)
  covers Node's `os.totalmem()` and the heap sized from it.
- **The limit lives in the cgroup**, and so does actual usage. That is the number
  the kernel enforces and the number to alarm on.
- **On the host, `docker stats` percentages are against the host's totals**, per
  the wording above — so a container at "6%" of a large host may be at 100% of its
  own limit. Read `MEM USAGE / LIMIT`, not `MEM %`.

## Where the numbers actually live

`docker stats` reads control-group accounting, and so can you. The documented
locations depend on the cgroup version and the driver:

| | Path |
|---|---|
| **cgroups v2** | `/sys/fs/cgroup/docker/<longid>/`, or `/sys/fs/cgroup/system.slice/docker-<longid>.scope/` under systemd |
| **cgroups v1** (memory) | `/sys/fs/cgroup/memory/docker/<longid>/`, or `/sys/fs/cgroup/memory/system.slice/docker-<longid>.scope/` |

The two `memory.stat` fields worth knowing by name, in the documentation's words:

- **cache** — "The amount of memory used by the processes of this control group
  that can be associated precisely with a block on a block device."
- **RSS** — "The amount of memory that doesn't correspond to anything on disk:
  stacks, heaps, and anonymous memory maps."

**RSS is the part that cannot be reclaimed by dropping it**, which is why a
steadily rising RSS is a leak and a steadily rising cache usually is not. CPU
accounting is in its own controller, "broken down into `user` and `system` time",
and throttling — the number that explains a slow service at 40% CPU — is in
`cpu.stat`, covered in [topic 03 · CPU and PIDs](03-resource-limits/02-cpu-and-pids.md).

⚠️ **Network counters are not cgroup metrics.** The documentation is explicit that
"network metrics aren't exposed directly by control groups", because "processes in
a single cgroup can belong to multiple network namespaces". `docker stats` gets
them from the interface instead, which is why they behave differently from the
others — including under rootless Podman, below.

## What `stats` cannot tell you

- **Anything about an exited container.** The accounting goes when the cgroup goes;
  the documentation notes that the tooling "carefully cleans up after itself". If
  you need the last numbers before a container died, they must have been collected
  *before* — which is the argument for a collector rather than a terminal window.
- **Whether the container is throttled.** CPU percentage looks moderate while the
  quota is being hit; `cpu.stat` is the evidence.
- **Anything about the application.** Queue depth, request latency, pool
  saturation — none of it is visible from outside the process.

## Exporting it: collectors, not commands

> "Running a new process each time you want to update metrics is (relatively)
> expensive."

That is the documentation's own reason not to build monitoring out of a loop
around `docker stats`. The standard pieces:

- **cAdvisor** — "provides container users an understanding of the resource usage
  and performance characteristics of their running containers", running as "a
  daemon that collects, aggregates, processes, and exports information about
  running containers", keeping per-container "resource isolation parameters,
  historical resource usage, histograms of complete historical resource usage and
  network statistics". It has "native support for Docker containers", runs from a
  container image with host paths mounted, and serves a UI on port **8080**.
- **The Docker daemon's own Prometheus endpoint**, configured with
  `metrics-address` in `daemon.json`. 🔴 **Read the caveat before planning around
  it:** *"Currently, you can only monitor Docker itself. You can't currently
  monitor your application using the Docker target"*, and the metric names are
  "in active development and may change at any time". It is daemon health, not
  container metrics.
- **The application's own metrics endpoint**, which is the only source for the
  numbers that describe your service rather than its container.

🔴 **The three layers answer different questions** — is the host healthy, is the
container within its limits, is the service doing its job — and an incident
usually needs all three. Container metrics alone tell you a service was killed,
never why it was allocating.

## Podman

`podman stats` is the same command with two differences worth knowing:

- **`--interval` / `-i` "defaults to 5 seconds"**, an explicit knob Docker's
  command does not expose.
- ⚠️ **"Rootless environments are not able to report statistics about their
  networking usage."** With rootlesskit port forwarding, traffic "gets accounted
  to the `lo` device" instead. So a rootless container that is plainly serving
  traffic can show nothing under `NET I/O` — an artefact of the mode, not a
  network fault.

The format fields match Docker's (`.CPUPerc`, `.MemUsage`, `.MemPerc`, `.NetIO`,
`.PIDs`), so a `--format` string ports across.

## Gotchas

**Symptom:** `docker stats` showed plenty of free memory and the container was
OOM-killed anyway.
**Cause:** The CLI subtracts page cache from the reported usage; the kernel
enforces the limit against the total.
**Fix:** Read the API or the cgroup files for alerting, and treat the CLI figure
as a human-facing summary.

**Symptom:** Memory monitoring inside the container reports gigabytes free on a
512 MB container.
**Cause:** `/proc/meminfo` and `free` report the host — they are not per-cgroup.
**Fix:** Read the cgroup limit and usage, and configure runtimes from the limit
you set rather than from what the process can see.

**Symptom:** A rootless Podman container serves traffic and reports no network I/O.
**Cause:** Rootless environments cannot report networking statistics, and
port-forwarded traffic is accounted to `lo`.
**Fix:** Measure at the application or the proxy. Nothing is wrong with the
container.

**Symptom:** A container died and there are no metrics from the minutes before it.
**Cause:** Accounting disappears with the cgroup, and nothing was collecting.
**Fix:** A collector scraping continuously — the numbers have to exist before the
incident, not be requested after it.

## Interview questions

**★ Why can `docker stats` disagree with the kernel about memory?**
Because the CLI reports memory usage by subtracting cache usage from the total,
while the limit is enforced against the total. A container doing heavy file I/O
accumulates reclaimable page cache that the CLI hides, so the display can look
comfortable shortly before an OOM kill. The API returns both figures; alerting
should use those or the cgroup files directly.

**★ Why does a process inside a container see the host's memory?**
`/proc/meminfo` and `free` are not namespaced per cgroup — they report the kernel's
view of the machine. The container's real ceiling is the cgroup limit, which is
invisible from those files, so runtimes that size themselves from "available
memory" size themselves from the host and overshoot.

**★ What is the difference between the Docker daemon's Prometheus endpoint and
cAdvisor?**
The daemon endpoint monitors Docker itself — the documentation says you "can't
currently monitor your application using the Docker target", and warns the metric
names are still changing. cAdvisor is a daemon that collects per-container resource
usage and history and exports it. They answer different questions, and neither
replaces the application's own metrics.

**What does `--no-stream` change, and when do you want it?**
It disables the live stream and pulls only the first result, so the command
terminates. That is the form for scripts, health snapshots and one-off captures;
the streaming default is for a human watching a terminal.

**Where do the numbers `docker stats` prints actually come from?**
Control-group accounting under `/sys/fs/cgroup` — `/sys/fs/cgroup/docker/<id>/` on
v2, or the `system.slice/docker-<id>.scope` path under systemd. Network counters are
the exception: cgroups do not expose them, because processes in one cgroup can
belong to several network namespaces, so those come from the interface.

**A container is slow, and CPU usage looks fine. What do you look at?**
`cpu.stat` in the container's cgroup, for throttling. A quota is enforced per
period, so a service that bursts can be throttled repeatedly while its average
utilisation looks moderate — `docker stats` cannot show that, and adding replicas
will not fix it.

---

← Prev: [Hardening at run time](10-hardening/README.md) · Index: [Phase 10](README.md) · Next → **Debugging a container you cannot shell into** *(not written yet)*
