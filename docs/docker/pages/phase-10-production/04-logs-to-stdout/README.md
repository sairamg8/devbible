---
title: "04 · Logs go to stdout and stderr"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — configure logging drivers](https://docs.docker.com/engine/logging/configure/),
> [Docker — dual logging](https://docs.docker.com/engine/logging/dual-logging/),
> [docker container logs](https://docs.docker.com/reference/cli/docker/container/logs/),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [podman-logs(1)](https://docs.podman.io/en/latest/markdown/podman-logs.1.html) and the
> [OCI image-spec annotations](https://github.com/opencontainers/image-spec/blob/main/annotations.md).
> **No sandbox** — no console output on this page.

The syllabus row is *that is the contract. Log files inside a container are a
bug.*

🔴 **A container's log interface is two file descriptors.** Write to stdout and
stderr and something outside collects, stores, rotates and ships. Everything else
on this page follows from that, including why the last lines before a crash are
so often the ones you do not have.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The contract](01-the-contract.md)** | What happens to a write, and the driver table — `json-file` as Docker's default *with no rotation*, `local` as the recommendation, `journald` as Podman's default; when `docker logs` cannot read anything and what dual logging does about it; the two ways applications break the contract — a file inside the container, and pipe buffering that destroys the buffer explaining the crash; and why stderr is not "errors" |
| 02 | **[Writing logs a machine can read](02-logs-a-machine-can-read.md)** | One event, one line, one JSON object, and why the multi-line stack trace must be serialised into a field; what belongs in a record and why `msg` stays constant; what must never appear — secrets, personal data, whole payloads — and why the remedy is rotation; volume as a production cost including health-check noise; where the container's identity comes from without hand-logging it; and the three jobs logs are not |

## Four facts worth carrying out of this topic

- **`json-file` does not rotate by default.** That is how a host runs out of disk
  and takes every container with it.
- **`docker logs` silence can be a driver problem**, not an application one —
  check `.HostConfig.LogConfig.Type` first.
- **A pipe is block-buffered.** The crash destroys the buffer holding the
  explanation, unless you unbuffer and flush on shutdown.
- **A secret in a log is a rotated secret.** The archive is already copied;
  deleting the line changes nothing.

## Phase gate

You can explain where a log line goes between `console.log` and a dashboard, say
why the same container logs fine interactively and silently when detached, and
design a log record that supports grouping and correlation without leaking
anything.

## Where this connects

- [02 · Graceful shutdown](../02-graceful-shutdown/README.md) — flushing before
  exit, which is why the last lines exist at all
- [03 · Resource limits](../03-resource-limits/README.md) — a silent 137 leaves
  only what was already flushed
- [Phase 1 · 03 · ps, inspect, logs, stats](../../phase-1-running-containers/03-ps-inspect-logs-stats.md)
  — the reading commands
- [Phase 1 · 16 · attach versus logs](../../phase-1-running-containers/16-attach-vs-logs.md)
  — two different views of the same streams
- [Phase 3 · 11 · HEALTHCHECK](../../phase-3-dockerfile/11-healthcheck.md) and
  [12 · LABEL](../../phase-3-dockerfile/12-label-and-metadata.md) — probe noise,
  and identity that travels with the image
- [08 · Log drivers and rotation](../08-log-drivers-and-rotation.md) ·
  [11 · Observing](../11-observing.md) · **13 · Disk growth** ·
  **15 · Time, timezones and locales** *(not written yet)*

---

Start → [01 · The contract](01-the-contract.md)
