---
title: "Phase 11 — Deployment and operations"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Patterns here assume Node runs in containers or VMs with an orchestrator or
> systemd. Pin image tags and CI Node versions to **24.x** in real pipelines.

**The difference between "it works on my machine" and "it works at 3 a.m." is how you
configure, package, signal, and roll out the process.**

## Pages

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[12-factor config](./01-twelve-factor-config.md)** | <span className="db-tier t-master">Master</span> | Env-driven, validated at boot, no secret defaults |
| 02 | **[Boot sequence](./02-boot-sequence.md)** | <span className="db-tier t-understand">Understand</span> | Validate → connect → listen → ready |
| 03 | **[Dockerizing Node](./03-dockerizing-node.md)** | <span className="db-tier t-master">Master</span> | Multi-stage, non-root, lockfile layer cache |
| 04 | **[PID 1 and signals](./04-pid1-and-signals.md)** | <span className="db-tier t-master">Master</span> | `npm start` as PID 1 swallows SIGTERM |
| 05 | **[Environment parity](./05-environment-parity.md)** | <span className="db-tier t-understand">Understand</span> | Same Node and config shape everywhere |
| 06 | **[Reverse proxy](./06-reverse-proxy.md)** | <span className="db-tier t-understand">Understand</span> | Trust hop-by-hop headers only from the edge |
| 07 | **[Zero-downtime deploys](./07-zero-downtime-deploys.md)** | <span className="db-tier t-understand">Understand</span> | Readiness gate + drain on SIGTERM |
| 08 | **[CI/CD](./08-cicd.md)** | <span className="db-tier t-understand">Understand</span> | Immutable install, matrix, promote digests |
| 09 | **[Image size and hardening](./09-image-size-hardening.md)** | <span className="db-tier t-understand">Understand</span> | Slim vs Alpine vs distroless and musl |
| 10 | **[Process managers](./10-process-managers.md)** | <span className="db-tier t-know">Know</span> | Orchestrator or systemd — not double supervisors |
| 11 | **[Scaling](./11-scaling.md)** | <span className="db-tier t-know">Know</span> | Replicas vs cluster; watch pool math |
| 12 | **[Semantic release](./12-semantic-release.md)** | <span className="db-tier t-know">Know</span> | SemVer honesty for packages and images |
| 13 | **[Blue/green and canary](./13-blue-green-canary.md)** | <span className="db-tier t-when">When Needed</span> | Smaller blast radius, harder migrations |
| 14 | **[Serverless Node](./14-serverless-node.md)** | <span className="db-tier t-when">When Needed</span> | Cold start, freeze, connection storms |

## Where this connects

- **[Phase 5](../phase-5-http-processes/)** — signals, graceful HTTP shutdown, cluster  
- **[Phase 7](../phase-7-background-work/)** — worker drain on deploy  
- **[Phase 10](../phase-10-observability/)** — readiness, lag, golden signals during rollout  
- **Docker & Nginx** (stack tracks) — deep container and proxy detail beyond Node  
