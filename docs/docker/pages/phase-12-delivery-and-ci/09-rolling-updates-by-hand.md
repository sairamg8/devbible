---
title: "Rolling updates and rollback by hand"
sidebar_label: "09 · Rolling updates by hand"
sidebar_position: 9
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against [Compose file reference — `deploy`](https://docs.docker.com/reference/compose-file/deploy/)
> and [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/).
> The mechanics of the switch are [Phase 10 · 16](../phase-10-production/16-zero-downtime-restarts.md);
> this page is the **failure modes** around it, and its arguments are reasoning
> over those documented behaviours rather than new product claims.
> **No sandbox** — no console output on this page.

[Phase 10 · 16](../phase-10-production/16-zero-downtime-restarts.md) gives the
four-step dance: start the new container, wait for it to be healthy, switch
traffic, stop the old one. **This page is about what goes wrong during it**, and
almost all of it comes from one fact people forget:

🔴 **During a rolling update, both versions are running at once.** Not
conceptually — actually, serving real requests, against the same database, for as
long as the rollout takes.

## The compatibility requirement nobody writes down

If v1 and v2 are live simultaneously, then for the duration of the rollout:

- **The database schema must satisfy both.** Any migration that v2 needs must
  already be applied and must not break v1.
- **The API must satisfy both.** If a v2 frontend is talking to a v1 backend —
  which it will, transiently — v1 must not reject it.
- **Queues and caches are shared.** A message written by v2 may be consumed by
  v1, and a cache entry written by one may be read by the other with a different
  shape.

⚠️ **This is not an orchestration problem, and switching to Kubernetes does not
solve it.** A rolling update anywhere has the same requirement; an orchestrator
just performs the rollout more reliably.

## Migrations are where rollouts actually fail

The one-shot migration service of
[Phase 9 · 10](../phase-9-mern-pern-stack/10-migrations-and-seeds.md) runs the
migration before the new version starts. Under a rolling update that means **the
schema changes while v1 is still serving**, so a destructive migration takes v1
down mid-rollout — and takes your rollback with it.

The pattern that survives this is **expand and contract**, over two releases:

| Release | Migration | Code |
|---|---|---|
| **1 — expand** | Add the new column, nullable; add the new table; **change nothing existing** | Write to both old and new; read from old |
| **2 — contract** | Drop the old column, once nothing reads it | Read from new; stop writing old |

🔴 **Each release is independently rollback-safe**, which is the whole point: at
no moment is there a schema the previous version cannot run against. It costs a
second deployment, and it buys the ability to go back.

⚠️ **A rename is two releases, not one.** `ALTER TABLE … RENAME COLUMN` is the
canonical way to break a rollout, because it is destructive and instantaneous.

## Rollback is not "the same thing backwards"

Rolling forward and rolling back look symmetric and are not:

| | Roll forward | Roll back |
|---|---|---|
| Image | New digest | The previous digest — you recorded it ([topic 01](01-tag-strategy/02-the-strategy.md)) |
| Schema | Already migrated | **May not be reversible** |
| Data written by the new version | n/a | **Still there**, possibly in a shape the old version cannot read |
| Confidence | Tested in staging | Tested… when? |

🔴 **The asymmetry is data.** The image goes back cleanly; anything v2 wrote does
not. That is why "we can always roll back" is only true if the schema and the
data written under v2 remain readable by v1 — which is exactly what expand and
contract guarantees and what a destructive migration destroys.

⚠️ **A rollback you have never performed is a plan, not a capability.** The phase
gate asks for one you have actually tested, and that is why.

## The failure modes, and what each looks like

**The half-rolled state.** The rollout stops partway: some traffic on v1, some on
v2, indefinitely. Usually a health check that never passes on the new version.
The trap is leaving it there "until someone looks" — decide up front whether a
stuck rollout auto-reverts or pages someone.

**Traffic switched before ready.** The proxy is repointed on "container started"
rather than on a real readiness check, so the first requests hit a process that
is up and not serving ([Phase 10 · 09](../phase-10-production/09-healthchecks-in-production.md)).

**The old version killed too early.** In-flight requests are dropped because the
old container was stopped before it drained. This is graceful shutdown
([Phase 10 · 02](../phase-10-production/02-graceful-shutdown/README.md)) —
`SIGTERM`, stop accepting new connections, finish what is in progress, exit — and
the stop timeout has to be longer than the longest request you actually serve.

**Sticky state.** Sessions in memory, WebSockets, long polls, uploads in
progress. Every one of these makes "just switch traffic" lossy. In-memory
sessions are the common case, and moving them to a shared store is the fix, not a
longer drain window.

**Configuration rolled without the image.** A configuration change deployed
independently means the running version is a combination nobody tested. Version
configuration alongside the digest and roll them together
([topic 03](03-one-image-three-environments/02-configuration-from-outside.md)).

**Both versions writing incompatible data.** The one that is discovered days
later. It is prevented by the compatibility requirement above, not detected by
monitoring.

## The checklist before you start one

1. **The previous digest is recorded** and reachable from the machine that would
   roll back.
2. **Migrations are expand-only**, or there is no migration in this release.
3. **The health check tests something real** — a dependency-touching readiness
   endpoint, not `/` returning 200.
4. **Stop timeouts exceed the longest request.** The Compose and `docker stop`
   default is 10 seconds, which is short for a slow endpoint.
5. **Someone is watching**, and there is a stated condition for aborting.
6. **The rollback has been performed at least once**, on purpose, when nothing
   was on fire.

⚠️ **Point 6 is the one that gets skipped and the one that matters.** Everything
else is a property of the system; this one is a property of the team.

## Gotchas

**Symptom:** The rollout completed and the old version started throwing errors
just before it stopped.
**Cause:** The migration for v2 ran while v1 was still serving, and it changed
something v1 depends on.
**Fix:** Expand and contract. Additive migration in one release, destructive
cleanup in a later one, once nothing reads the old shape.

**Symptom:** The rollback restored the previous image and the application is
still broken.
**Cause:** The data or schema moved. The image went back; what v2 wrote did not.
**Fix:** There is no fix at that point — only a restore. Prevent it by keeping
every release rollback-safe at the schema level.

**Symptom:** Users lost their sessions during a deploy that "had no downtime".
**Cause:** Sessions were in the container's memory, so switching traffic
discarded them.
**Fix:** A shared session store. No amount of rollout care makes in-memory state
survive replacing the process holding it.

**Symptom:** A rollout has been half-applied for two days.
**Cause:** The new version never became healthy and nothing decided what to do
about it.
**Fix:** Define the abort condition before starting: a time limit, then revert.
An indefinite mixed state is the worst of both versions.

## Interview questions

**★ What is the requirement a rolling update imposes on your application?**
That two versions can run at once, because during the rollout they do — against
the same database, the same queues and the same caches. So the schema must
satisfy both, the API must tolerate both, and messages written by one must be
readable by the other. This is true on any platform; an orchestrator performs the
rollout, it does not remove the requirement.

**★ How do you make a schema change rollback-safe?**
Expand and contract, over two releases. First release: additive only — new
column nullable, new table added, nothing existing changed — with code that
writes both shapes and reads the old. Second release, once nothing reads the old
shape: drop it. Every release is then independently reversible, which a rename or
a drop in a single release destroys.

**★ Why is rollback not symmetric with rolling forward?**
Because data is not reversible. The image goes back to the previous digest
cleanly; the rows the new version wrote, and any schema change it made, do not.
That is why "we can always roll back" is a claim about your migration discipline
rather than about your deployment tool — and why a rollback you have never
performed is a plan, not a capability.

**What do you check before starting a manual rolling update?**
That the previous digest is recorded and reachable, that the release's migrations
are expand-only, that the health check tests something real, that stop timeouts
exceed your longest request (the default is 10 seconds), that someone is watching
with a stated abort condition, and that the rollback has been rehearsed at least
once when nothing was wrong.

**What makes "no downtime" untrue even when the rollout is perfect?**
Sticky state — in-memory sessions, WebSockets, long polls, in-flight uploads.
Switching traffic away from a process discards whatever only it held. The fix is
moving that state out of the process, not lengthening the drain window.

---

← Prev: [Kubernetes on-ramp](08-kubernetes-on-ramp.md) · Index: [Phase 12](README.md) · Next → [10 · `docker context`](10-docker-context.md)
