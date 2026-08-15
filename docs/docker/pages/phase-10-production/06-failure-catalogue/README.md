---
title: "06 · The production failure catalogue"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker inspect](https://docs.docker.com/reference/cli/docker/inspect/),
> [docker system df](https://docs.docker.com/reference/cli/docker/system/df/),
> [Docker Hub — usage and pull limits](https://docs.docker.com/docker-hub/usage/pulls/),
> [Docker — configure logging drivers](https://docs.docker.com/engine/logging/configure/),
> [Docker — networking](https://docs.docker.com/engine/network/),
> [Dockerfile `HEALTHCHECK`](https://docs.docker.com/reference/dockerfile/#healthcheck),
> [time_namespaces(7)](https://man7.org/linux/man-pages/man7/time_namespaces.7.html),
> [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.html) and
> [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.html).
> **No sandbox** — no console output on this page.

The syllabus row is *OOM kill, disk full from logs, image pull rate limit, clock
skew, DNS, unhealthy-but-still-serving, zombie PID 1.*

🔴 **Almost every production container incident is one of about a dozen things,
and the evidence identifying which is already on disk before you start
guessing.** This topic is the list, split by the question that changes the whole
investigation: **did the container die, or is it still running?**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Triage, and the failures that kill the container](01-triage-and-the-container-died.md)** | The four `docker inspect` fields to read before forming any hypothesis, and why `RestartCount` reframes the incident; then the OOM kill, zombie PID exhaustion, the ignored `SIGTERM`, the silent crash loop that alerts nobody, the Docker Hub pull limit that bites during scale-out, and the 125/126/127 failures where the process never ran |
| 02 | **[The failures that leave it running](02-still-running-and-useless.md)** | The disk that filled and took every container with it (and the prune flag that deletes data); the three unrelated things called DNS; why a container's wall clock is always the host's; healthy-but-not-serving and its correlated-failure opposite; throttling misread as slowness; file-descriptor exhaustion; and the short list of things that must exist *before* the incident |

## Four facts worth carrying out of this topic

- **Exit 137 is not "memory".** `OOMKilled` distinguishes the OOM kill from a stop
  timeout and from `docker kill`, in one command.
- **`docker logs` shows the current run** — in a crash loop, the one that has not
  failed yet.
- **A container's `CLOCK_REALTIME` is the host's**, always. Clock skew is never a
  container-level fix.
- **Docker reports health; it acts on nothing.** Something else must consume the
  status, or "green" means only "the process is up".

## Phase gate

You can be handed a failing container and reach the right hypothesis from
`docker inspect`, `docker events` and the host's disk — before reading
application code — and you can name which failures leave no exit code at all.

## Where this connects

- [01 · PID 1](../01-pid-1/README.md) — zombies, and why killing PID 1 ends the
  container
- [02 · Graceful shutdown](../02-graceful-shutdown/README.md) — the ten-second
  stop and exit 143
- [03 · Resource limits](../03-resource-limits/README.md) — OOM kills and
  throttling, in mechanism
- [04 · Logs go to stdout and stderr](../04-logs-to-stdout/README.md) — why the
  evidence survives the container, or does not
- [Phase 1 · 09 · Exit codes](../../phase-1-running-containers/09-exit-codes.md)
  and [12 · Restart policies](../../phase-1-running-containers/12-restart-policies.md)
- [Phase 2 · 02 · Tags versus digests](../../phase-2-images-and-registries/02-tags-vs-digests.md)
  — pinning, and not depending on a registry to recover
- **07 · Restart policies as supervision** · **08 · Log drivers and rotation** ·
  **09 · Healthchecks in production** · **11 · Observing** · **13 · Disk growth** ·
  **15 · Time, timezones and locales** *(not written yet)*

---

Start → [01 · Triage, and the failures that kill the container](01-triage-and-the-container-died.md)
