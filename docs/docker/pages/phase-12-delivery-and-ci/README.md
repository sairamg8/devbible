---
title: "Phase 12 — Delivery, CI and orchestration"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Compose v5.4.0 · Podman 6.1.0.** Every page is
> **documentation-validated** against docs.docker.com, docs.podman.io, the OCI
> specifications, the Linux man pages or the release notes, with the sources named
> per page. **No sandbox** — nothing was run, so no page carries console output.

Everything before this phase happens on one machine. This phase is how the image
gets from there to somewhere that matters, and it ends with the question everyone
eventually asks: **do I need Kubernetes?**

🚧 **Writing — 8 of 12 topics · 🏁 the Master tier is COMPLETE at 2 of 2.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Tag strategy](01-tag-strategy/README.md)** | <span className="db-tier t-master">Master</span> | `latest` is a deployment trap; immutable tags by commit, moving tags for humans |
| 02 | **[Building images in CI](02-building-in-ci.md)** | <span className="db-tier t-understand">Understand</span> | The pipeline shape, cache export and import between runs, and the cold-build cost |
| 03 | **[One image, three environments](03-one-image-three-environments/README.md)** | <span className="db-tier t-master">Master</span> | Build once, promote the same digest; configuration comes from the environment |
| 04 | **[Registry authentication in CI](04-registry-auth-in-ci.md)** | <span className="db-tier t-know">Know</span> | Short-lived tokens and OIDC, never a long-lived password in a repository secret |
| 05 | **[Testing with containers](05-testing-with-containers.md)** | <span className="db-tier t-understand">Understand</span> | A real Postgres in the test run, and the mocks you can finally delete |
| 06 | **[Deploying without an orchestrator](06-deploying-without-an-orchestrator.md)** | <span className="db-tier t-understand">Understand</span> | Compose on a VM, Quadlet units, or a PaaS — and the trade each makes |
| 07 | **[When Compose stops being enough](07-when-compose-stops-being-enough.md)** | <span className="db-tier t-understand">Understand</span> | The honest threshold, written as four conditions rather than a feeling |
| 08 | **[Kubernetes on-ramp](08-kubernetes-on-ramp.md)** | <span className="db-tier t-know">Know</span> | What your image, services and healthchecks map to — and what has no equivalent |
| 09 | Rolling updates and rollback by hand | <span className="db-tier t-when">When Needed</span> | The four-step dance and its failure modes |
| 10 | `docker context` | <span className="db-tier t-know">Know</span> | Driving a remote engine, and the foot-gun of forgetting which one you are on |
| 11 | Cost realities | <span className="db-tier t-when">When Needed</span> | Registry storage, egress on every pull, CI minutes, and cache as a cost lever |
| 12 | Docker Swarm in 2026 | <span className="db-tier t-when">When Needed</span> | Its status, and whether it belongs on your list at all |

## Coverage

Twelve syllabus topics, twelve pages — nothing merged and nothing dropped. Two
rows are **Master** (01 and 03, the two that decide how everything else behaves),
four are Understand, three are Know and three are When Needed.

## Phase gate

A pipeline that builds one image, tags it by commit, pushes it, and deploys that
exact digest — with a rollback you have actually tested.

## Where this phase sits

It is the last phase of the track, and it collects the threads the earlier ones
deliberately left open: digest pinning from
[Phase 5 · 08](../phase-5-image-quality/08-pinning-by-digest.md), the build cache
from [Phase 4](../phase-4-build-strategy/README.md), Compose as a deployment tool
from [Phase 8](../phase-8-compose/README.md), the production concerns of
[Phase 10](../phase-10-production/README.md), and Quadlet and `kube play` from
[Phase 11](../phase-11-podman-in-depth/README.md).

---

← Prev: [Phase 11 — Podman in depth](../phase-11-podman-in-depth/README.md) · Index: [Docker & Podman pages](../README.md)
