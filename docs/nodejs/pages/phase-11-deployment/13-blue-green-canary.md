---
title: "Blue/green and canary deploys"
sidebar_label: "13 · Blue/green and canary"
sidebar_position: 13
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08. Deployment patterns; Node still needs readiness and metrics from
> Phases 10–11 for these to be safe.

**Blue/green keeps two full environments and flips traffic. Canary sends a slice of
traffic to the new version first. Both reduce blast radius versus replacing all pods at
once — at the cost of more infrastructure and stricter compatibility rules.**

## Blue/green

| Step | Action |
|---|---|
| 1 | Blue serves 100% |
| 2 | Deploy green (full stack) |
| 3 | Test green privately |
| 4 | Switch router/LB to green |
| 5 | Keep blue warm for fast rollback |

**Rollback** is a second flip — fast if sessions and schemas allow.

## Canary

| Step | Action |
|---|---|
| 1 | 5% traffic → new revision |
| 2 | Watch errors, latency, lag |
| 3 | Ramp 25% → 50% → 100% or abort |

Needs **real metrics** ([Phase 10 golden signals](../phase-10-observability/11-golden-signals.md)),
not only "pods ready".

## Compared to rolling

| Strategy | Blast radius | Cost |
|---|---|---|
| Rolling | Medium | Default in K8s |
| Canary | Small at first | Analysis + mesh/weighting |
| Blue/green | Flip is all-or-nothing at switch | 2× capacity during cut |

## Node-specific constraints

- **In-memory state** does not move with the flip — sticky sessions bite  
- **Migrations** must allow old and new to coexist during canary  
- **Workers/queues** need version-tolerant payloads (expand/contract)  

## Gotchas

**Symptom:** Canary looks fine, full rollout fails
**Cause:** Canary traffic not representative (internal only, no writes)
**Fix:** Include write paths; mirror prod mix

**Symptom:** Blue/green flip drops WebSockets
**Cause:** Long-lived connections not drained
**Fix:** Drain period; clients reconnect; sticky exit

**Symptom:** Schema migration breaks the other colour
**Cause:** Expand/contract skipped
**Fix:** Compatible migrations before traffic split

## Interview questions

**★ Blue/green vs canary?**
Blue/green: two environments, switch all traffic. Canary: gradual percentage to the new
version with metrics gates.

**When is rolling enough?**
Most APIs with compatible migrations and good readiness — canary when risk is high.

**What must you measure during a canary?**
Error rate, latency percentiles, saturation (lag), business KPIs if critical.

**Why do migrations dominate deploy strategy choice?**
Old and new code run together in canary/rolling — incompatible schema breaks one side.

**What makes rollback fast in blue/green?**
Idle previous environment still running — if data changes are reversible.

---

← Prev: [Semantic release](./12-semantic-release.md) · Next → [Serverless Node](./14-serverless-node.md)
