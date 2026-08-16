---
title: "Deploying without an orchestrator"
sidebar_label: "06 · Deploying without an orchestrator"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Compose in production](https://docs.docker.com/compose/how-tos/production/)
> and [podman-systemd.unit(5) — Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html).
> **No sandbox** — no console output on this page.

**Most applications never need an orchestrator, and saying so out loud is the
useful part of this topic.** One VM running your containers under a supervisor
serves an enormous number of real production systems, and it costs a fraction of
the operational attention.

There are three honest options, and each makes a different trade.

## Option 1 — Compose on a VM

You already have the file. `compose.yaml` describes the stack, the server runs
`docker compose up -d`, and deployment is pulling a new image and recreating a
service.

Docker's own production guidance is mostly about what to *change* from your
development file: "removing any volume bindings for application code" so the code
comes from the image, adjusting port bindings, changing environment variables,
adding **restart policies**, and adding services such as log aggregation. In
practice that is exactly what an override file is for
([Phase 8 · 11](../phase-8-compose/11-override-files.md)) — one base file, a
production override, no second copy to drift.

Redeploying one service without disturbing its dependencies is documented as:

```bash
docker compose up --no-deps -d api
```

**What it is good at:** you already know it, one file describes everything, and
the local and production descriptions are the same document.

**Where it hurts:**

- ⚠️ **Restart-on-boot depends on the engine coming back**, and Compose is not a
  supervisor — the restart policy is
  ([Phase 10 · 07](../phase-10-production/07-restart-as-supervision.md)).
- ⚠️ **Rolling updates are a manual dance**
  ([Phase 10 · 16](../phase-10-production/16-zero-downtime-restarts.md)); `up`
  recreates, and recreation is downtime unless you arrange otherwise.
- ⚠️ **The Compose file becomes the deployment interface**, so `git pull` on a
  server starts being how you deploy — workable, and easy to do badly.

## Option 2 — Quadlet units under systemd

The Podman answer, and the strongest one on a Linux host that already runs
systemd. Each service is a `.container` file that systemd's generator turns into
a real unit ([Phase 11 · 04](../phase-11-podman-in-depth/04-quadlet/README.md)).

What you get is not a smaller version of Compose — it is a different set of
guarantees:

| | |
|---|---|
| Boot | systemd starts it, with the whole dependency system available |
| Supervision | One supervisor, the host's own, rather than two arguing ([Phase 10 · 14](../phase-10-production/14-under-systemd.md)) |
| Dependencies | `Volume=data.volume` generates a real unit dependency; ordering is systemd's problem |
| Readiness | `Notify=` and `sd_notify`, which is what makes rollback and health meaningful |
| Logs | journald by default, with the host's rotation and retention |
| Updates | `podman auto-update` where you want them ([Phase 11 · 10](../phase-11-podman-in-depth/10-auto-update.md)) |

**Where it hurts:** it is Podman-specific, it is more files than one
`compose.yaml`, and the local development story is still Compose — so you
maintain two descriptions of the same stack unless you drive Quadlet from
Kubernetes YAML instead ([Phase 11 · 11](../phase-11-podman-in-depth/11-kube-play.md)).

## Option 3 — A PaaS that takes your image

Hand a platform an image reference and let it run it. The whole of this phase
still applies — you still need [tag strategy](01-tag-strategy/README.md),
[one image per environment](03-one-image-three-environments/README.md) and
[registry auth](04-registry-auth-in-ci.md) — but restart, TLS, rolling updates,
log collection and scaling stop being yours.

**Where it hurts:** cost at scale, less control over networking and placement,
and a real switching cost once your deployment description is in someone's
proprietary format. That last one is the reason to keep the image and the
Compose or Quadlet definition working independently: it is what makes leaving
possible.

## Choosing

| If | Then |
|---|---|
| One host, a team that knows Compose, downtime on deploy acceptable | **Compose on a VM** |
| One Linux host, Podman, you want boot, supervision and updates to be the OS's job | **Quadlet** |
| You would rather not operate a host at all | **PaaS** |
| Multiple hosts, health-gated rolling updates, autoscaling | You are past this page — **Phase 12 · 07 · When Compose stops being enough** *(not written yet)* |

🔴 **Notice what is not on this list: "Kubernetes because it is what people
use."** Every option above is a smaller operational surface, and the threshold
for needing more is a set of conditions rather than a feeling — which is the next
topic's job to state.

## What you owe the host either way

Whichever option you pick, the production concerns do not disappear — they are
the whole of [Phase 10](../phase-10-production/README.md):

- **Restart policy or systemd unit**, so a reboot brings the stack back
  ([Phase 10 · 07](../phase-10-production/07-restart-as-supervision.md)).
- **Log rotation**, or the disk fills
  ([Phase 10 · 08](../phase-10-production/08-log-drivers-and-rotation.md)).
- **Resource limits**, so one container cannot take the host down
  ([Phase 10 · 03](../phase-10-production/03-resource-limits/README.md)).
- **Healthchecks that test something real**, and something that acts on them
  ([Phase 10 · 09](../phase-10-production/09-healthchecks-in-production.md)).
- **Disk hygiene**, because images and volumes accumulate
  ([Phase 10 · 13](../phase-10-production/13-disk-growth.md)).
- **Backups of your volumes**, which no deployment method does for you
  ([Phase 6 · 10](../phase-6-storage/10-backup-and-restore.md)).

⚠️ **A PaaS covers several of these and not the last one.** Data is still yours.

## Gotchas

**Symptom:** After a server reboot, nothing came back.
**Cause:** No restart policy and no systemd unit — Compose is a description, not
a supervisor.
**Fix:** `restart: unless-stopped` in the production override, or Quadlet units
so systemd owns it. Then reboot the server once, deliberately, and check.

**Symptom:** A deploy took the site down for thirty seconds.
**Cause:** `compose up` recreates the container, and recreation is downtime.
**Fix:** Either accept it and deploy in a quiet window, or do the start-new /
health-check / stop-old dance by hand
([Phase 10 · 16](../phase-10-production/16-zero-downtime-restarts.md)). Wanting
this to be automatic is one of the real thresholds for an orchestrator.

**Symptom:** Production is running code that is not in any commit.
**Cause:** Deployment is `git pull` plus a local edit on the server, and the
Compose file on the host has drifted from the repository.
**Fix:** Deploy an image by digest and keep the host's configuration in version
control. Nothing should be edited in place on a server.

**Symptom:** Two supervisors are fighting — the container restarts twice, or
systemd reports failure while the container is running.
**Cause:** A restart policy *and* a systemd unit both trying to own the same
container.
**Fix:** One supervisor. Under Quadlet, systemd owns it and the engine's restart
policy stays out.

## Interview questions

**★ When is an orchestrator genuinely unnecessary?**
When you run on one host, can tolerate a short deploy window, and do not need
autoscaling or health-gated rolling updates — which describes a very large share
of real production systems. Compose on a VM or Quadlet units give you restart,
logging, limits and health for a fraction of the operational surface, and the
whole of Phase 10 still applies either way.

**★ What changes between a development Compose file and a production one?**
Docker's guidance is the short list: remove volume bindings for application code
so the code comes from the image, adjust port bindings, change environment
variables, add restart policies, and add supporting services such as log
aggregation. All of it belongs in an override file rather than a second copy, so
there is one description and no drift.

**★ Why is Quadlet the stronger answer on a Linux host?**
Because it makes the host's own supervisor own the container. Boot ordering,
dependencies, restart, readiness via `sd_notify` and journald logging are all
systemd's, rather than a second supervisor arguing with the engine's restart
policy. The cost is that it is Podman-specific and it is not what you run
locally.

**What does a PaaS actually take off your plate, and what does it not?**
It takes restart, TLS, rolling updates, log collection and scaling. It does not
take tag strategy, one-image-per-environment, registry credentials — or your
data: backups of persistent storage remain yours. It also introduces a switching
cost, which is why keeping the image and a portable deployment definition working
is worth the small effort.

**How do you deploy a single service without disturbing the rest of a Compose
stack?**
`docker compose up --no-deps -d <service>` — recreate that service without
recreating its dependencies. It is documented for exactly this, and it is the
difference between deploying an API and restarting your database along with it.

**What is the most common way a no-orchestrator deployment goes wrong?**
The server becomes the source of truth. Someone edits the Compose file in place,
or deploys by `git pull`, and production drifts from anything in version control.
Deploying an image by digest with the host configuration under review is what
keeps it honest.

---

← Prev: [Testing with containers](05-testing-with-containers.md) · Index: [Phase 12](README.md) · Next → **07 · When Compose stops being enough** *(not written yet)*
