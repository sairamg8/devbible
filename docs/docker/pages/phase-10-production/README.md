---
title: "Phase 10 — Running containers in production"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Compose v5.4.0 · Podman 6.1.0.** Every page is
> **documentation-validated** against docs.docker.com, docs.podman.io, the OCI
> specifications, the Linux man pages or the release notes, with the sources named
> per page. **No sandbox** — nothing was run, so no page carries console output.

Most production container incidents are one of about a dozen things. This phase
is that list, with the mechanism and the fix for each.

🚧 **Writing — 2 of 16 topics.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[PID 1 is not a normal process](01-pid-1/README.md)** | <span className="db-tier t-master">Master</span> | No default signal dispositions, no reaping — the ten-second stop and exit 137 |
| 02 | **[Graceful shutdown](02-graceful-shutdown/README.md)** | <span className="db-tier t-master">Master</span> | Handling `SIGTERM`, draining connections, and the stop timeout that kills you mid-request |
| 03 | **Resource limits** *(not written yet)* | <span className="db-tier t-master">Master</span> | `--memory`, `--cpus`, `--pids-limit`, and why the process "just vanished" |
| 04 | **Logs go to stdout and stderr** *(not written yet)* | <span className="db-tier t-master">Master</span> | That is the contract; a log file inside a container is a bug |
| 05 | **Configuration and secrets at run time** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | "Not in the image" and "not in the process list" are different claims |
| 06 | **The production failure catalogue** *(not written yet)* | <span className="db-tier t-master">Master</span> | OOM, full disk, pull limits, clock skew, DNS, unhealthy-but-serving, zombies |
| 07 | **Restart policies as supervision** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | What they cover, what they hide, and the silent crash loop |
| 08 | **Log drivers and rotation** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `max-size`, `max-file`, `journald`, and the 40 GB file that filled the disk |
| 09 | **Healthchecks in production** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Liveness versus readiness as concepts, with or without an orchestrator |
| 10 | **Hardening at run time** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `--read-only`, `--cap-drop=ALL`, `no-new-privileges`, non-root |
| 11 | **Observing** *(not written yet)* | <span className="db-tier t-know">Know</span> | `stats`, exporters, and host memory versus cgroup memory |
| 12 | **Debugging a container you cannot shell into** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Distroless and scratch, ephemeral attach, `nsenter`, copying a binary in |
| 13 | **Disk growth** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Images, dangling layers, volumes, build cache — and the flag that deletes volumes |
| 14 | **Running containers under systemd** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The unit that supervises, restarts and orders your container |
| 15 | **Time, timezones and locales** *(not written yet)* | <span className="db-tier t-know">Know</span> | Why the container thinks it is UTC and your logs disagree |
| 16 | **Zero-downtime restarts without an orchestrator** *(not written yet)* | <span className="db-tier t-know">Know</span> | Start-new, health-check, switch, stop-old |

## Coverage

Sixteen syllabus topics; nothing merged and nothing dropped so far. Topics 01 and
02 are chunked directories — each carries two genuinely separate arguments.

| Syllabus topic | Page |
|---|---|
| PID 1 is not a normal process | 01 |
| Graceful shutdown | 02 |

## Phase gate

Move on to Phase 11 when you can **explain exit code 137 three different ways —
OOM kill, `docker kill`, and a stop timeout after an ignored `SIGTERM` — and say
which one applies from the evidence in front of you.**

## Where this connects

- **Phase 1** is where the run-time behaviour was introduced:
  [stop is two signals](../phase-1-running-containers/08-stop-is-two-signals.md),
  [exit codes](../phase-1-running-containers/09-exit-codes.md),
  [restart policies](../phase-1-running-containers/12-restart-policies.md) and
  [reclaiming disk](../phase-1-running-containers/13-reclaiming-disk.md).
- **Phase 3** is where most production behaviour is actually decided:
  [CMD versus ENTRYPOINT](../phase-3-dockerfile/05-cmd-vs-entrypoint.md),
  [exec versus shell form](../phase-3-dockerfile/06-exec-vs-shell-form.md),
  [USER](../phase-3-dockerfile/09-user.md) and
  [HEALTHCHECK](../phase-3-dockerfile/11-healthcheck.md).
- **Phase 0** supplies the mechanisms:
  [namespaces](../phase-0-what-a-container-is/02-namespaces.md),
  [cgroups](../phase-0-what-a-container-is/03-cgroups.md) and
  [capabilities](../phase-0-what-a-container-is/09-capabilities.md).
- **Phase 11 — Podman in depth** is where "containers under systemd" becomes
  Quadlet, and where the no-daemon consequences of this phase are collected.
- **Phase 12 — Delivery and CI** takes the image that survives all of this and
  gets it onto a machine that matters.

---

← Syllabus: [Part 4 — Production and depth](../../syllabus/04-production-and-depth.md) · Prev phase: **Phase 9 — The MERN/PERN stack** *(not written yet)* · Start → [PID 1 is not a normal process](01-pid-1/README.md)
