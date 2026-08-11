---
title: "Process managers — pm2, systemd, or the orchestrator"
sidebar_label: "10 · Process managers"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. Operational choices for **Node 24** processes; prefer one owner
> for restarts and signals.

**Something must start your process, restart it on crash, and deliver SIGTERM on
deploy. In Kubernetes that is the orchestrator. On a VM it may be systemd. pm2 is a
Node-centric option that is often redundant — and sometimes harmful — inside containers.**

## Who owns the process

| Environment | Prefer | Why |
|---|---|---|
| Kubernetes / ECS / Nomad | Orchestrator only | Already restarts, health checks, signals |
| Single VM / bare metal | **systemd** | OS-native, journald, cgroups |
| Legacy multi-app host | pm2 / similar | When you lack an orchestrator |
| Local dev | `node --watch` / your package scripts | Not prod topology |

## systemd sketch

```ini
# pseudo-code unit
# [Service]
# ExecStart=/usr/bin/node /opt/app/dist/server.js
# Restart=on-failure
# EnvironmentFile=/etc/app.env
# KillSignal=SIGTERM
# TimeoutStopSec=30
```

systemd is PID 1's child supervisor — Node still should be the main `ExecStart` binary,
not `npm`.

## pm2 — when and when not

**Useful:** multiple apps on one VM, quick clustering without K8s, built-in log
routing for small teams.

**Avoid inside Docker/K8s:** you get **double supervision** (pm2 + kubelet), murky PID
1, and metrics that disagree. Run `node` directly; set `restartPolicy` on the pod.

`pm2 start` in a Dockerfile often means nobody thought about signals
([page 04](./04-pid1-and-signals.md)).

## cluster module vs replicas

`cluster` (or pm2 cluster mode) multiplies processes **on one machine**.
Horizontal replicas multiply **machines/pods**. Prefer platform replicas unless you
have a reason for co-located workers ([page 11](./11-scaling.md),
[Phase 5 cluster](../phase-5-http-processes/23-cluster.md)).

## Gotchas

**Symptom:** Kubernetes restarts + pm2 restarts fight
**Cause:** Two supervisors
**Fix:** Remove pm2 from the container

**Symptom:** Logs only in pm2 home, not stdout
**Cause:** pm2 captures logs away from container runtime
**Fix:** Log to stdout/stderr for the platform log driver

**Symptom:** systemd kills before drain completes
**Cause:** `TimeoutStopSec` shorter than app drain
**Fix:** Align timeout with graceful shutdown budget

## Interview questions

**★ Should you run pm2 inside a Kubernetes pod?**
Usually no — the orchestrator already supervises; double process managers complicate
signals and restarts.

**What does systemd give you on a VM?**
Restart policy, env files, stop timeout, journal logging — OS-integrated supervision.

**What should ExecStart invoke?**
`node` on your entry file (exec), not `npm start`.

**When is pm2 still reasonable?**
Small VM hosts without an orchestrator, needing simple multi-app supervision.

**Who should send SIGTERM on deploy?**
The supervisor that owns the lifecycle — kubelet, systemd, or your process manager —
once only.

---

← Prev: [Image size and hardening](./09-image-size-hardening.md) · Next → [Scaling](./11-scaling.md)
