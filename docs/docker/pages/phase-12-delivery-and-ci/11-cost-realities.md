---
title: "Cost realities"
sidebar_label: "11 · Cost realities"
sidebar_position: 11
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against [Docker Hub usage and rate limits](https://docs.docker.com/docker-hub/usage/),
> [docker system df](https://docs.docker.com/reference/cli/docker/system/df/)
> and [Docker — GitHub Actions cache backend](https://docs.docker.com/build/cache/backends/gha/).
> ⚠️ **No prices appear on this page.** Vendor pricing changes constantly and any
> figure written here would be wrong within months — the *shape* of each cost is
> what is durable, and that is what this page gives you.
> **No sandbox** — no console output on this page.

Containers make four things cost money that used not to, and none of them appear
in a monthly review as "containers". They arrive as registry storage, network
egress, CI minutes, and disk on hosts nobody is watching.

## 1 · Registry storage grows with your merge rate

[Topic 01](01-tag-strategy/02-the-strategy.md) argues for one immutable tag per
commit, which is correct and has a direct consequence: **an image per merge,
forever, unless something deletes them**.

Two properties make it worse than it looks:

- **Layers are shared, so per-image size overstates the total** — but the reverse
  bites at deletion. Removing an image frees only its *unique* layers, which is
  exactly the distinction `docker system df` draws between `SIZE` and
  `RECLAIMABLE` ([Phase 10 · 13](../phase-10-production/13-disk-growth.md)).
- **Deleting a tag does not delete data.** The blobs go when the registry's
  garbage collector runs ([Phase 11 · 12](../phase-11-podman-in-depth/12-buildah-and-skopeo.md)),
  which is a separate, scheduled thing.

**The lever:** retention by class, decided early — branch and PR builds expire in
days, releases stay, and no deployed digest is ever deleted. Retrofitting
retention means deciding what to delete under pressure and with incomplete
information.

## 2 · Egress is charged on every pull

A pull moves the layers you do not already have, from the registry to wherever
the container runs. If those are in different networks, somebody is billed for
the transfer — and it happens **on every deploy, every scale-up and every CI
job**, not once.

Three levers, in order of effect:

- **Smaller images.** [Phase 5](../phase-5-image-quality/README.md) is the whole
  topic; the cost argument is that image size is a *recurring* charge, not a
  one-off download.
- **A registry close to the workload**, or a pull-through cache, so the traffic
  is local.
- **Stable base layers.** If your base image and dependency layers do not change,
  a host that already has them transfers only your application layer — which is
  the layer-ordering discipline of
  [Phase 4 · 02](../phase-4-build-strategy/02-instruction-ordering.md) showing up
  as a bandwidth saving.

⚠️ **Rate limits are a cost in a different currency.** Docker Hub's
unauthenticated limit is "100 per IPv4 address or IPv6 /64 subnet", 200 per six
hours for an authenticated Personal account, and unlimited on paid plans — and
because unauthenticated pulls are counted per address, **a shared CI egress
address spends one pool collectively**. The bill arrives as failed builds rather
than as money.

## 3 · CI minutes are the one you can actually feel

Build time is charged per minute on hosted runners and paid in engineer waiting
everywhere else. The dominant term is almost always **how much of the build is
cached**.

| Lever | Effect |
|---|---|
| Layer ordering so dependencies cache ([Phase 4 · 03](../phase-4-build-strategy/03-dependency-install-pattern.md)) | Largest, and free |
| Cache import/export between runs ([topic 02](02-building-in-ci.md)) | Large — but the export costs time too |
| Not building twice per commit ([topic 02](02-building-in-ci.md)) | Halves it outright when it applies |
| Multi-platform only on releases ([Phase 4 · 11](../phase-4-build-strategy/11-buildx-and-platforms.md)) | Emulated builds are the expensive kind |
| Skipping builds when nothing relevant changed | Real, and easy to get subtly wrong |

🔴 **Cache is a lever in both directions.** Exporting a cache costs time and
transfer, and a CI-native cache expires under the provider's eviction policy — so
a rarely-built branch pays full price anyway. Measure a cached and an uncached
run before assuming the cache is winning.

## 4 · Disk on hosts, which nobody is watching

The cost that shows up as an outage rather than an invoice. Images, stopped
containers, build cache, volumes and unrotated logs all accumulate on every host
that runs containers — the four pools of
[Phase 10 · 13](../phase-10-production/13-disk-growth.md), plus log rotation from
[Phase 10 · 08](../phase-10-production/08-log-drivers-and-rotation.md).

⚠️ **Docker's default `json-file` driver does not rotate.** A long-lived host
with a chatty service will fill its disk eventually, and the failure takes
everything on the box with it.

## Reading the actual numbers

Before optimising anything, look:

```bash
docker system df            # and `-v` for per-image detail
```

🔴 **Read `RECLAIMABLE`, not `SIZE`.** `SIZE` is documented as the sum of shared
and unique size, so it *overstates* what deleting would free; `RECLAIMABLE` is
the honest column ([Phase 10 · 13](../phase-10-production/13-disk-growth.md)).

For registry and egress, the numbers live with your provider — but the questions
are the same everywhere: how many images do we keep, how large are they, how
often are they pulled, and from where.

## Gotchas

**Symptom:** Registry storage keeps growing although old images are deleted.
**Cause:** Deleting a tag marks blobs for the registry's garbage collector; it
does not free space by itself. And shared layers only go when nothing references
them.
**Fix:** Ensure garbage collection actually runs, and measure reclaimable space
rather than the sum of image sizes.

**Symptom:** The CI bill rose sharply with no change in commit volume.
**Cause:** Usually a cache that stopped being effective — a reordered Dockerfile,
a new scope, or eviction on a branch that builds rarely.
**Fix:** Compare a cached and an uncached run. If the cache is not saving more
than it costs to export, turn it off for that pipeline.

**Symptom:** Deploys are slow and egress is high, and the application barely
changed.
**Cause:** A change early in the Dockerfile invalidates everything after it, so
every deploy transfers the whole image instead of one layer.
**Fix:** Move stable things earlier and volatile things later. Layer ordering is
a bandwidth decision as much as a build-time one.

**Symptom:** A host ran out of disk and nobody had touched it in months.
**Cause:** Unrotated logs, or accumulated images and build cache. The default
`json-file` driver does not rotate.
**Fix:** Configure rotation, prune on a schedule with an age filter — and never
`--volumes` in a cron job.

## Interview questions

**★ Where does containerisation actually cost money?**
Four places: registry storage that grows with your merge rate, network egress
charged on every pull, CI minutes dominated by how much of the build is cached,
and disk on hosts that fills quietly. None of them appear labelled as
"containers", which is why they go unnoticed until one of them fails.

**★ Why is image size a recurring cost rather than a one-off?**
Because it is paid on every pull — every deploy, every scale-up, every CI job
that runs the image. A large image is charged repeatedly in egress and in
deployment latency, which is a much stronger argument for slimming it than disk
space on a laptop.

**How is the build cache a cost lever in both directions?**
It usually saves far more than it costs, but exporting and importing a cache is
itself time and transfer, and a CI-native cache expires under the provider's
eviction policy — so a branch that builds rarely pays full price anyway. The
right move is measuring a cached and an uncached run rather than assuming.

**Why can't you judge cleanup by the `SIZE` column?**
Because it is the sum of shared and unique size, so it overstates what deleting
would free — shared layers stay while anything still references them.
`RECLAIMABLE` is the column that answers "how much would I actually get back".

**How do rate limits turn into a cost?**
They arrive as failed builds. Unauthenticated Docker Hub pulls are counted per
IPv4 address or IPv6 /64 subnet, so a shared CI egress address spends one pool
across everyone using it — and the failure looks like your pipeline's fault.
Authenticating makes the limit yours.

---

← Prev: [`docker context`](10-docker-context.md) · Index: [Phase 12](README.md) · Next → [12 · Docker Swarm in 2026](12-swarm-in-2026.md)
