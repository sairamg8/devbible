---
title: "Zero-downtime restarts without an orchestrator"
sidebar_label: "16 · Zero-downtime restarts"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the [Compose file reference — `deploy`](https://docs.docker.com/reference/compose-file/deploy/),
> [docker compose up](https://docs.docker.com/reference/cli/docker/compose/up/),
> [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Zero downtime is not a restart strategy — it is a property of the application,
plus one indirection in front of it.** Every technique on this page fails without
both, which is why "how do I do a rolling update with Compose" is usually the wrong
first question.

The mechanical obstacle is simple: **two containers cannot publish the same host
port**. So the new container must come up somewhere else, and something in front
has to decide when traffic moves. Without that something, `docker compose up -d`
stops the old container and starts the new one, and the gap between them is your
downtime.

## The four-step dance

1. **Start the new container** alongside the old, on a different name and a
   different published port (or no published port at all, if a proxy reaches it on
   the network).
2. **Wait until it is genuinely ready** — the health check going healthy, not the
   container going *running* ([topic 09](09-healthchecks-in-production.md)).
3. **Switch traffic** at the indirection: reload the proxy, update the upstream,
   move the socket.
4. **Drain and stop the old one** — give it longer than the request timeout so
   in-flight work finishes ([topic 02](02-graceful-shutdown/README.md)), then
   remove it.

🔴 **Step 2 is where this usually goes wrong, and step 4 is where it goes wrong
quietly.** A switch before readiness produces a burst of 502s; a stop that is too
fast truncates responses that nobody counts because the client had already given up.

## What has to be true before any of this works

| Precondition | Why, and where it was covered |
|---|---|
| The app handles `SIGTERM` and drains | Otherwise step 4 kills in-flight requests — [topic 02](02-graceful-shutdown/01-the-deadline.md) |
| A readiness signal that means *serving* | Step 3 needs a real answer — [topic 09](09-healthchecks-in-production.md) |
| No state inside the container | Two instances exist at once; anything in the writable layer is lost or divergent |
| The two versions can run together | Both are live during the overlap — so schema changes must be backwards-compatible |
| The stop grace period exceeds the longest request | The default is 10s, and long uploads or reports exceed it |

⚠️ **The database migration is the constraint people discover last.** For a moment
both versions are serving, so a migration that removes a column or renames one
breaks the old version while it is still taking traffic. The technique is
expand-then-contract — add the new shape, deploy code that writes both, then remove
the old shape in a later release — and it is a property of the *schema change*, not
of the container tooling.

## Where the switch happens

**A reverse proxy is the normal answer**, and the only one that generalises:

- Both containers are on the same user-defined network; the proxy addresses them by
  container name ([phase 7 · Service
  discovery](../phase-7-networking/02-service-discovery.md)).
- The proxy polls its own health endpoint against each backend, so step 2 and step 3
  are one mechanism rather than two.
- Reloading configuration is far cheaper than restarting the proxy — a proxy
  restart is itself downtime, so a proxy that cannot reload has moved the problem
  rather than solved it.

**Two published ports and an upstream switch** works without a container-aware
proxy: run the new version on `:8081` while the old serves `:8080`, flip the
upstream, then stop the old one. It costs a port and it is easy to script.

**A shared unix socket on a volume** is the third shape — the new container creates
a new socket file and the proxy is pointed at it. It avoids the port problem
entirely and couples the two containers to a shared volume, which is a real trade.

## Compose's part in this

`docker compose up -d` reconciles: it recreates the services whose definition
changed. That is exactly right for correctness and is not zero-downtime, because
recreating means stopping.

The Compose Specification does describe deployment behaviour in the `deploy`
section — `replicas`, and an `update_config` with `parallelism` ("the number of
containers to update at a time"), `delay` ("the time to wait between updating a
group of containers") and **`order`, "one of `stop-first` (old task is stopped
before starting new one), or `start-first`", defaulting to `stop-first`** — with a
matching `rollback_config`.

🔴 **Two things to take from that.** First, `start-first` is the setting that means
overlap, and it is **not** the default even where the block is honoured. Second,
`deploy` describes what a *platform* should do, and how much of it applies depends
on what is running the file — so on a plain single-host `docker compose up`, treat
the four-step dance as the thing you are actually doing, and the proxy as the thing
doing it.

## Rollback is the other half

A deployment technique without a rehearsed rollback is half a technique:

- **Keep the previous image.** This is the practical reason
  [topic 13](13-disk-growth.md) warns against `docker image prune -a` on a schedule
  — it deletes exactly the image you want at the worst moment.
- **Roll back by digest, not by tag.** The tag may have moved; the digest cannot.
- **Reverse the dance.** Start the old version alongside, wait for ready, switch,
  drain. It is the same four steps, which is what makes it rehearsable.

## Podman

The same four steps apply, and Podman adds two things worth knowing here, both
collected in phase 11:

- **Quadlet units** make the overlap expressible as systemd units, so "start the
  new one, then stop the old one" becomes ordinary unit management rather than a
  shell script — **Phase 11 · Quadlet** *(not written yet)*.
- **`podman auto-update`** does image-driven rolling updates for Quadlet services,
  with rollback — **Phase 11 · `podman auto-update`** *(not written yet)*.

**Pods** are not the answer to this: containers in a pod share a network namespace,
so two versions in one pod collide on the port exactly as before.

## Gotchas

**Symptom:** The new container starts, the proxy switches, and clients see 502s for
a few seconds.
**Cause:** The switch happened when the container was *running*, not when the
application was *ready*.
**Fix:** Gate the switch on the health check, and make readiness assert that a
request can actually be served.

**Symptom:** Long uploads fail during every deploy.
**Cause:** The stop grace period — 10 seconds by default — is shorter than the
request.
**Fix:** Raise it above the longest legitimate request, and drain: stop accepting
new connections first, then finish what is in flight.

**Symptom:** The rollout was clean and the old version started throwing errors
during the overlap.
**Cause:** A migration that changed the schema out from under the still-serving old
version.
**Fix:** Expand-then-contract — additive change, deploy, and only remove the old
shape once nothing serves the old code.

**Symptom:** The rollback failed because the previous image was gone.
**Cause:** An aggressive prune, or a moving tag that no longer points where it did.
**Fix:** Keep the last few images, pin the rollback target by digest, and rehearse
the rollback as a normal operation rather than an emergency one.

## Interview questions

**★ How do you deploy a new version with no downtime on a single host?**
Start the new container alongside the old on a different port or name, wait for its
health check to report ready, switch traffic at a reverse proxy, then drain and stop
the old one. It only works if the application shuts down gracefully, keeps no state
in the container, and can run concurrently with the previous version — including
against the same database schema.

**★ Why can't you just publish the same port from both containers?**
Because a host port can only be bound once; the second container fails to start.
That is why zero downtime always needs an indirection — a reverse proxy, a second
port with an upstream switch, or a shared socket — and why the technique is really
about that layer, not about the containers.

**★ What does a migration have to do with a rolling restart?**
For the duration of the overlap, both versions are serving traffic against one
database. Any destructive schema change breaks whichever version does not expect
it. The change has to be additive first — expand, deploy, then contract in a later
release — which makes the schema, not the tooling, the limiting factor.

**What does `docker compose up -d` do, and why is it not zero-downtime?**
It reconciles the stack, recreating the services whose definitions changed —
correct, and it means stopping a container before its replacement runs. The Compose
Specification's `deploy.update_config.order` has a `start-first` value for overlap,
but it defaults to `stop-first` and describes what a platform should do rather than
what a single-host `up` will necessarily do.

**How long should the stop grace period be?**
Longer than the longest request you are willing to complete, and the default of ten
seconds usually is not. It is a budget, not a target: a service that drains
properly exits as soon as it is finished, so a generous timeout costs nothing on a
healthy deploy and saves the truncated responses on a slow one.

**What makes a rollback reliable?**
Keeping the previous image on the host, referring to it by digest rather than by a
tag that may have moved, and performing the rollback with the same four steps as
the deployment so it is rehearsed rather than improvised.

---

← Prev: [Time, timezones and locales](15-time-and-timezones.md) · Index: [Phase 10](README.md) · Next phase → [Phase 11 — Podman in depth](../phase-11-podman-in-depth/README.md)
