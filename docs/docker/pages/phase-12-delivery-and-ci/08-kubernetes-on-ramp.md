---
title: "Kubernetes on-ramp"
sidebar_label: "08 · Kubernetes on-ramp"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [Kubernetes — overview](https://kubernetes.io/docs/concepts/overview/),
> [Kubernetes — liveness, readiness and startup probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)
> and [podman-kube-play(1)](https://docs.podman.io/en/latest/markdown/podman-kube-play.1.html).
> **No sandbox** — no console output on this page.

**Almost everything you have learned transfers, and this page is the
translation table.** The image is the same image; the healthcheck becomes two
probes rather than one; and exactly one Compose feature has no equivalent worth
naming.

This is deliberately an on-ramp, not a Kubernetes course. Its job is to make the
first manifest legible.

## The translation table

| What you have | What it becomes | Notes |
|---|---|---|
| The image (by digest) | **The same image**, unchanged | Nothing about your Dockerfile changes |
| A Compose service | A **Deployment** (which manages a **ReplicaSet** of **Pods**) | The Deployment is what does rollouts |
| `--scale 3` | `replicas: 3` on the Deployment | Declarative, and it actually places them across nodes |
| A service name other containers reach | A **Service** | Gives a stable name and address in front of changing Pod IPs |
| `ports:` published to the host | A **Service** plus an **Ingress** or a load balancer | Publishing to "the host" stops being a meaningful idea |
| `environment:` | A **ConfigMap**, referenced by the Pod | [Topic 03](03-one-image-three-environments/README.md)'s argument, formalised |
| Compose secrets | A **Secret**, mounted or referenced | Still not encrypted by default — check your cluster |
| A named volume | A **PersistentVolumeClaim** | The bigger conceptual jump: storage is requested, not created |
| `HEALTHCHECK` | **Liveness and readiness probes** — two things | See below; this is the important row |
| `depends_on` | **Nothing** | See below; this is the other important row |
| `restart: unless-stopped` | The Pod's `restartPolicy`, plus the controller replacing Pods | Self-healing here means *replacement*, not only restart |
| A Podman pod | A **Pod**, genuinely ([Phase 11 · 03](../phase-11-podman-in-depth/03-pods.md)) | The one construct that maps exactly |

## The healthcheck row, expanded

A container healthcheck is one signal answering one question
([Phase 10 · 09](../phase-10-production/09-healthchecks-in-production.md)).
Kubernetes splits it into three probes, and the split is the single most useful
idea to bring back with you:

| Probe | Question | On failure |
|---|---|---|
| **Liveness** | Should this container be restarted? | "The kubelet restarts the container according to its restart policy" |
| **Readiness** | Should this container receive traffic? | The Pod's IP is removed from matching Services, so traffic stops being delivered |
| **Startup** | Has it finished starting? | While it runs it **disables liveness and readiness**; if it fails the container is killed |

🔴 **Liveness and readiness are genuinely different questions**, and conflating
them is the classic outage: a service that has lost its database fails a
combined check, gets restarted, still cannot reach the database, and restarts
forever. Correct is **readiness fails** (stop sending traffic) while **liveness
passes** (restarting will not help).

Two defaults worth knowing because they explain surprising behaviour:

- **"If a container does not provide a particular probe, the kubelet always
  considers the result as `Success`."** No probe means always healthy — the same
  optimism as a container with no `HEALTHCHECK`.
- **For readiness, the result is considered `Failure` before the initial delay**,
  so a Pod correctly receives no traffic during its first moments.

⚠️ **The startup probe exists because slow starters break liveness.** A container
that takes ninety seconds to load will be killed by a liveness probe with an
ordinary threshold; the startup probe holds the others off until it is up.

## The `depends_on` row, expanded

There is no ordering primitive. Kubernetes starts everything and expects
components to tolerate their dependencies being absent — the readiness probe is
how a Pod says "not yet", and controllers retry indefinitely.

🔴 **This is a design position, not a gap**, and it is the same conclusion
[Phase 9 · 04 · Waiting for the database](../phase-9-mern-pern-stack/04-waiting-for-the-database/README.md)
reaches from the other direction: an application that retries its own
dependencies is correct everywhere, and one that relies on start order is correct
only where something enforces it. If your services already retry, you have
already done the work.

## What does not change at all

Worth stating plainly, because the anxiety about adopting Kubernetes is usually
about the wrong things:

- **Your Dockerfile.** Same image, same layers, same base
  ([Phase 3](../phase-3-dockerfile/README.md), [Phase 4](../phase-4-build-strategy/README.md)).
- **Your tag strategy and digests.** Kubernetes "does not build applications" —
  no CI/CD, no source compilation — so [topics 01](01-tag-strategy/README.md)
  and [03](03-one-image-three-environments/README.md) are unchanged, and
  deploying a digest matters more, not less.
- **PID 1, signals and graceful shutdown.** A Pod termination sends `SIGTERM` and
  then kills, so [Phase 10 · 01](../phase-10-production/01-pid-1/README.md) and
  [Phase 10 · 02](../phase-10-production/02-graceful-shutdown/README.md) are the
  same lesson with a different deadline.
- **Logs to stdout and stderr** ([Phase 10 · 04](../phase-10-production/04-logs-to-stdout/README.md)),
  and **resource limits**, which become requests and limits on the Pod.

## The cheapest way to start

Write the manifests and run them locally with `podman kube play`
([Phase 11 · 11](../phase-11-podman-in-depth/11-kube-play.md)): Pod, Deployment,
DaemonSet, Job, PersistentVolumeClaim, ConfigMap and Secret all work on one host,
with no cluster involved.

⚠️ **Local success is a smoke test, not validation.** Cluster-level fields —
`nodeSelector`, `affinity`, `tolerations`, `schedulerName` — are ignored rather
than rejected, so a manifest with a mistake in them passes locally and fails on a
cluster.

## Gotchas

**Symptom:** A Pod restarts in a loop when a dependency is down.
**Cause:** One probe is doing both jobs, so a dependency failure is reported as
"restart me".
**Fix:** Readiness fails; liveness passes. Restarting a process that cannot reach
its database does not help, and the restart loop hides the real fault.

**Symptom:** A slow-starting application is killed before it finishes booting.
**Cause:** The liveness probe started evaluating immediately.
**Fix:** A startup probe, which disables liveness and readiness while it runs and
gives the application its initialisation window.

**Symptom:** Everything is reported healthy and nothing works.
**Cause:** No probes are defined, and with no probe the kubelet always considers
the result a success.
**Fix:** Define them. The default is optimism, exactly as with a container that
has no `HEALTHCHECK`.

**Symptom:** A translated Compose file starts services in the wrong order and
they crash.
**Cause:** There is no `depends_on`. Kubernetes starts everything and expects
retries.
**Fix:** Make the application retry its dependencies and report readiness
honestly. That is correct on Compose too, so it is not throwaway work.

## Interview questions

**★ What maps to what, coming from Compose?**
The image is unchanged. A service becomes a Deployment managing Pods, with a
Service in front for a stable name; `--scale` becomes `replicas`; `environment`
becomes a ConfigMap and secrets become Secrets; a named volume becomes a
PersistentVolumeClaim; and the healthcheck becomes liveness and readiness probes.
`depends_on` has no equivalent at all.

**★ Why does Kubernetes split a healthcheck into two probes?**
Because "should this be restarted?" and "should this receive traffic?" are
different questions. A liveness failure makes the kubelet restart the container;
a readiness failure removes the Pod's IP from Services so traffic stops. Merging
them produces the classic outage where a database blip becomes an endless restart
loop, when the right response was to stop sending traffic and wait.

**★ What replaces `depends_on`?**
Nothing, deliberately. Everything starts, and components are expected to tolerate
their dependencies being missing — the readiness probe is how a Pod says "not
yet". It is the same conclusion as making your application retry its own
dependencies under Compose, so a well-behaved service needs no change.

**What is a startup probe for?**
Slow starters. While it runs it disables the liveness and readiness probes, so an
application that needs ninety seconds to initialise is not killed by a liveness
probe with a normal threshold. If it ultimately fails, the kubelet kills the
container per the restart policy.

**What happens if you define no probes at all?**
The kubelet always considers the result a success, so everything reports healthy
whether or not it is. It is the same trap as shipping a container with no
`HEALTHCHECK` — the default is optimism, and optimism is not a health signal.

**How would you learn this without a cluster?**
Write the manifests and run them with `podman kube play` on one host — Pod,
Deployment, DaemonSet, Job, PVC, ConfigMap and Secret all work. Just remember
cluster-level fields are ignored rather than rejected there, so local success is
a smoke test rather than validation.

---

← Prev: [When Compose stops being enough](07-when-compose-stops-being-enough.md) · Index: [Phase 12](README.md) · Next → **09 · Rolling updates and rollback by hand** *(not written yet)*
