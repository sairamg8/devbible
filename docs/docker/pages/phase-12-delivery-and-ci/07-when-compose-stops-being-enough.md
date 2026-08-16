---
title: "When Compose stops being enough"
sidebar_label: "07 · When Compose stops being enough"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Kubernetes — overview](https://kubernetes.io/docs/concepts/overview/),
> [Compose in production](https://docs.docker.com/compose/how-tos/production/)
> and [Compose file reference — `deploy`](https://docs.docker.com/reference/compose-file/deploy/).
> **No sandbox** — no console output on this page.

**There is a threshold, and it is four conditions rather than a feeling.** Teams
adopt an orchestrator far too early, on the strength of "we will need it
eventually", and pay for a control plane they do not use. The useful skill is
naming the moment.

## The four conditions

Cross one of these and the tooling in [topic 06](06-deploying-without-an-orchestrator.md)
starts costing more than it saves. Cross two and the argument is over.

**1 · More than one host.** This is the big one. Compose describes containers on
*a* machine, so the moment your stack spans two you are hand-writing the thing an
orchestrator is: which container is on which host, how they find each other, what
happens when one host dies. Everything else on this list is a matter of degree;
this one is a category change.

**2 · Rolling updates gated on health.** "Start the new one, check it is healthy,
then stop the old one" is a script you can write
([Phase 10 · 16](../phase-10-production/16-zero-downtime-restarts.md)) — and a
script that has to handle a failed health check, a partial rollout and a
rollback, correctly, every time. Compose's `deploy.update_config` describes the
behaviour, but the reference frames `deploy` as **what a platform should do** —
support depends on what is running the file — and its `order` defaults to
**`stop-first`**, so even where it is honoured the default is downtime.

**3 · Autoscaling.** `--scale` starts N containers on one host
([Phase 8 · 17](../phase-8-compose/17-scale-and-limits.md)); it does not add
hosts, react to load, or take capacity away again. If demand genuinely varies by
an order of magnitude, that gap is real.

**4 · Team isolation.** Several teams deploying independently to shared
infrastructure need namespaces, quotas and access control. A Compose host has one
of each: root, everything, and whoever has SSH.

⚠️ **None of these is "our stack has a lot of services".** Fifteen services on
one host is a Compose file. Two services on three hosts is not.

## What you are actually buying

Kubernetes describes itself as "a portable, extensible, open-source platform for
managing containerized workloads and services" that facilitates "declarative
configuration and automation", and lists what it provides:

| Capability | Do you have it now? |
|---|---|
| Service discovery and load balancing | Compose gives DNS on one host; load balancing across hosts, no |
| Storage orchestration — automatic mounting of storage systems | Volumes on one host, yes; across hosts, no |
| **Automated rollouts and rollbacks** | No — condition 2 |
| **Automatic bin packing** — placing containers on nodes | No — needs nodes, condition 1 |
| **Self-healing** — restarting and replacing containers | Restart policies give the restart, not the *replacement* |
| Secret and configuration management | Compose secrets exist; scope and rotation are yours |
| Batch execution | A cron job on the host |
| **Horizontal scaling** | No — condition 3 |
| IPv4/IPv6 dual-stack | Configurable ([Phase 7 · 13](../phase-7-networking/13-subnets-ipv6-and-vpn.md)) |

🔴 **The bolded rows are the ones you cannot approximate on a single host.**
Everything else you already have in some form, which is precisely why adopting an
orchestrator for those reasons is a bad trade.

## What it explicitly does not give you

Kubernetes' own documentation is unusually direct about its limits, and this is
the half people skip:

- It is **not a traditional PaaS** — it offers "optional, pluggable solutions
  rather than all-inclusive" ones.
- It **does not build your application**: no CI/CD, no source compilation. Every
  page in this phase before this one still applies, unchanged.
- It **does not provide application-level services** — no built-in database,
  message bus or cache.

⚠️ **So adopting it does not delete work; it moves it.** You still build images,
tag them, authenticate to a registry and promote digests — and you add cluster
operation on top.

## The honest cost

Before crossing the threshold, price the whole thing:

- **A control plane to run or to buy.** Managed control planes are the sensible
  answer and they are a recurring bill.
- **A second description of your application** — manifests, or a templating
  system over them — living alongside your Compose file, unless you commit to one
  ([Phase 11 · 11](../phase-11-podman-in-depth/11-kube-play.md) is how you might).
- **New failure modes.** Scheduling, eviction, networking plugins and resource
  pressure become things you debug at 3am, and none of them existed before.
- **The learning curve, on the whole team.** One person who knows Kubernetes and
  four who do not is worse than five who know Compose.

🔴 **The middle grounds are real and under-used.** A managed container service
that runs your image without a cluster, a PaaS, or two VMs behind a load balancer
with Quadlet units on each — all of these cross condition 1 or 2 without a
control plane. Reach past them deliberately, not by default.

## Signals it is genuinely time

Rather than the four conditions in the abstract, the observable versions:

- You have written more than a hundred lines of deployment shell script, and it
  has a rollback branch nobody has tested.
- Deploys are scheduled for quiet hours because they cause downtime.
- Somebody is manually deciding which service runs on which server.
- A host failure means a person is paged to move things by hand.
- Two teams are coordinating deploys over chat to avoid colliding.

⚠️ **One of these is a nuisance. Three of them is a threshold.**

## Gotchas

**Symptom:** A cluster was adopted and the deployment problems are unchanged.
**Cause:** The problems were build and delivery problems — tagging, promotion,
configuration — and Kubernetes explicitly does not build applications or provide
CI/CD.
**Fix:** Fix the pipeline first. It is the same pipeline either way, and it is
cheaper to fix without a cluster underneath it.

**Symptom:** `deploy.update_config` is in the Compose file and nothing rolls.
**Cause:** `deploy` describes what a *platform* should do, and support depends on
what is running the file — so it is not a promise the block will be acted on.
⚠️ The documentation does not say Compose ignores it; it says support varies, and
this page does not upgrade that into a stronger claim.
**Fix:** Verify what your runner actually does with it. Otherwise do the dance
explicitly, and note that the documented default is `stop-first`, so even where
it is honoured the default is downtime.

**Symptom:** `--scale` was used and the host fell over.
**Cause:** Scaling on one machine multiplies the load on one machine. There is no
capacity being added.
**Fix:** Resource limits per container so the host survives, and recognise the
requirement as condition 3 — this is a hosts problem, not a Compose flag.

**Symptom:** Nobody can explain what the cluster is doing, and the team ships
slower than before.
**Cause:** The operational surface grew past the team's capacity, which is the
cost nobody prices.
**Fix:** A managed control plane, or step back to a middle ground. Choosing less
infrastructure is a legitimate outcome.

## Interview questions

**★ When does an orchestrator become necessary?**
Four conditions: more than one host, health-gated rolling updates, autoscaling,
or several teams needing isolation on shared infrastructure. More than one host
is the category change — Compose describes containers on *a* machine, so spanning
two means hand-writing placement, cross-host discovery and failover. The others
are matters of degree.

**★ What does Kubernetes explicitly not do?**
Its own documentation says it is not a traditional PaaS, does not build your
application — no CI/CD, no source compilation — and does not provide
application-level services such as databases, message buses or caches. So
adopting it removes none of this phase's work; it adds cluster operation on top.

**★ What is the strongest argument against adopting one early?**
That most of what it provides you already have in some form on a single host —
service discovery, storage, secrets, batch jobs — and the parts you genuinely
cannot approximate are automated rollouts, bin packing across nodes, self-healing
replacement and horizontal scaling. If you do not need those four, you are buying
a control plane, a second description of your application and a new set of
failure modes for nothing.

**Why doesn't `--scale` solve the scaling condition?**
Because it starts more containers on the same machine. It adds no capacity,
reacts to no load, and removes nothing when demand falls. It is useful for
testing that a service can run as multiple instances; it is not horizontal
scaling.

**What are the middle grounds?**
A managed container service that runs your image without you operating a cluster,
a PaaS, or a small number of VMs behind a load balancer each running Quadlet
units. Each of these crosses "more than one host" or "rolling updates" without a
control plane, and they are under-used because Kubernetes is the default answer
in conversation rather than the default answer on merit.

**How would you tell a team it is time?**
By observable signals rather than sentiment: a deployment script long enough to
have an untested rollback branch, deploys scheduled for quiet hours because they
cause downtime, a person deciding which service runs where, a host failure
paging someone to move things by hand, teams coordinating deploys in chat. One is
a nuisance; three is a threshold.

---

← Prev: [Deploying without an orchestrator](06-deploying-without-an-orchestrator.md) · Index: [Phase 12](README.md) · Next → **08 · Kubernetes on-ramp** *(not written yet)*
