---
title: "The strategy"
sidebar_label: "02 · The strategy"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker image tag](https://docs.docker.com/reference/cli/docker/image/tag/),
> [docker buildx imagetools create](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/),
> [Docker — building best practices](https://docs.docker.com/build/building/best-practices/)
> and [podman-auto-update(1)](https://docs.podman.io/en/latest/markdown/podman-auto-update.1.html).
> **No sandbox** — no console output on this page.

The rule, and everything below is a consequence of it:

> **Immutable tags for machines. Moving tags for humans. Deploy the digest.**

Three tags on one image, each with a job, and only one of them ever appears in a
deployment.

## What a build pushes

One build, several references to the same image:

```bash
# the identity — never re-pointed, one per commit
myapp:1.4.2-9f6c1ab

# the human label — moves with each release of this line
myapp:1.4

# the convenience pointer — for a human typing `docker run`
myapp:latest
```

| Tag | Moves? | Who reads it |
|---|---|---|
| `1.4.2-9f6c1ab` | **Never** | Your deployment, your rollback, your audit |
| `1.4` | On each patch release | A person choosing a version line |
| `latest` | On each release | A person trying it out |

🔴 **The moving tags are for people, and only for people.** Their mutability is
the feature: someone who wants "the current 1.4" should get it without editing
anything. The moment a machine resolves one, you have lost the ability to say
what is running.

⚠️ **If you publish images others consume, publishing only immutable tags is
unkind** — nobody wants to look up a SHA to try your image. Publish both. The
discipline is about what *you deploy*, not about what exists.

## Deploy the digest, not the tag

A deployment should name a digest, and the pipeline that built the image is what
knows it:

```
myapp@sha256:9f6c1ab…
```

That single change buys four things at once:

- **"What is running?" has an answer** — one that cannot drift between the moment
  you looked and the moment it started.
- **Two hosts cannot disagree.** Same digest, same image, by definition.
- **Rollback becomes trivial** — the previous digest is a value you already
  recorded, so rolling back is redeploying a string, not rebuilding anything.
- **A registry-side re-push cannot change what you run.** Someone force-pushing
  a tag is a real incident; with a digest it is a non-event.

Keep the tag alongside it for readability — `myapp:1.4.2@sha256:…` — the same
shape Docker's base-image guidance uses.

## Promotion: build once, move the digest

The corollary is that **environments should not each build their own image**.
Build once, then promote the identical digest through dev, staging and production
— which is topic 03's subject and the reason it is the phase's other Master row
([Phase 12 · 03](../03-one-image-three-environments/README.md)).

Promotion in practice is re-tagging the same digest, not rebuilding:

```bash
docker buildx imagetools create -t myregistry/myapp:staging myregistry/myapp@sha256:9f6c1ab…
```

`imagetools create` "create[s] a new manifest list based on source manifests",
and those "must already exist in the registry where the new manifest is created"
— so the promotion happens registry-side, with nothing pulled and nothing built.

⚠️ **A rebuild for another environment is a different image**, even from the same
commit — different base-image resolution, different build cache, different
timestamps. If staging and production run different artefacts, staging tested
something else.

## The base-image half

Your own tags are only one direction. The `FROM` line is the other, and the
guidance is explicit: "consider pinning base image versions", because otherwise
"you don't have an audit trail of the exact image versions that you're using".

The honest trade is stated in the same place — pinning a digest means "you're
opting out of automated security fixes, which is likely something you want to
get" — so the complete answer is **pin, plus automation to move the pin**.
Docker Scout, for instance, can "automatically raise a pull request on your
repository to update your Dockerfiles to use the latest version". A pinned digest
with a bot watching it is reproducible *and* patched; a pinned digest with nobody
watching is a security debt with a date on it.

[Phase 5 · 08](../../phase-5-image-quality/08-pinning-by-digest.md) is the full
argument.

## Retention, or the bill arrives later

Immutable tags mean **one image per commit**, which is the point and also a
storage cost that grows linearly with your merge rate.

Decide the policy at the same time as the scheme, because retrofitting it means
deciding what to delete under pressure:

- **Keep every digest that is deployed anywhere**, including anything you might
  roll back to. This is the constraint everything else works around.
- **Keep release tags indefinitely** — they are small, few, and exactly what
  someone will ask for.
- **Expire branch and PR builds aggressively** — days, not months. They exist to
  be looked at once.
- **Never garbage-collect by tag count alone.** The digest a running deployment
  references may have no tag at all if a moving tag was re-pointed.

⚠️ **Deleting a tag is not deleting an image.** On Podman's side `skopeo delete`
"mark[s] the image-name for later deletion by the registry's garbage collector"
([Phase 11 · 12](../../phase-11-podman-in-depth/12-buildah-and-skopeo.md)) —
registries behave this way generally, so freeing space is a two-step affair.

## What this means for automated updates

An image-driven updater is a moving tag with a robot attached.
`podman auto-update` with the `registry` policy checks the tag you deployed and
restarts the unit when it changes
([Phase 11 · 10](../../phase-11-podman-in-depth/10-auto-update.md)) — which is
either exactly what you want or a production deployment at midnight nobody
reviewed, depending entirely on the tag you gave it.

The two are mutually exclusive by construction: **a digest never updates**, so a
service you deploy by digest cannot be auto-updated, and a service you
auto-update is by definition deployed on a moving tag. Choose per service rather
than per host, and be honest about which services can survive an unreviewed
change.

## The checklist

1. **Every build pushes an immutable tag** containing the commit SHA.
2. **Moving tags are pushed for humans**, never consumed by a deployment.
3. **Deployments reference a digest**, with a tag alongside for readability.
4. **Environments promote a digest**; they never rebuild.
5. **Base images are pinned**, with automation to move the pin.
6. **Retention is defined before the registry fills up**, and never deletes a
   deployed digest.
7. **Rollback is redeploying the previous digest**, and it has been tested at
   least once.

Point 7 is the phase gate, and it is the only one you can verify by doing rather
than by reading.

## Gotchas

**Symptom:** A rollback to "the previous version" cannot be performed because
nobody knows what it was.
**Cause:** The deployment referenced a moving tag, which has no history.
**Fix:** Deploy digests and record them. The previous digest *is* the rollback
plan; there is nothing else to build.

**Symptom:** Staging passed and production failed with the same commit.
**Cause:** Each environment built its own image, so they are different artefacts
— different base resolution, different cache, different build time.
**Fix:** Build once and promote the digest. A rebuild is a new image, not the
same one.

**Symptom:** The registry bill grows steadily and nobody can safely clean up.
**Cause:** One immutable tag per commit with no retention policy, and no record
of which digests are deployed.
**Fix:** Expire branch and PR builds on a short clock, keep releases, and track
deployed digests so cleanup has a safe list. Remember that deleting a tag only
marks the blobs for the registry's garbage collector.

**Symptom:** A service updated itself overnight and broke.
**Cause:** It was deployed on a moving tag with an automatic updater watching it.
**Fix:** Decide deliberately: auto-update needs a moving tag and tolerance for
unreviewed change. Anything that cannot tolerate that gets a digest, which by
construction never updates.

## Interview questions

**★ Describe a tagging strategy you would defend.**
Three tags per build: an immutable one containing the commit SHA, a moving
version tag like `1.4`, and `latest`. The moving tags exist for humans choosing
what to pull; deployments reference the **digest**, with a tag alongside for
readability. Environments promote that digest rather than rebuilding, so staging
and production are provably the same artefact, and rollback is redeploying the
previous digest.

**★ Why deploy a digest rather than an immutable tag?**
An immutable tag is only immutable by convention — the registry will happily let
someone re-push it, and then your "immutable" reference means something else. A
digest is content-addressed, so it cannot be re-pointed at all. The tag documents
intent; the digest enforces it.

**★ What is the trade-off in pinning base images, and how do you resolve it?**
Pinning gives reproducible builds and an audit trail, but as Docker's own
guidance says, you are "opting out of automated security fixes, which is likely
something you want to get". The resolution is to pin *and* automate moving the
pin — tooling that raises a pull request to update the digest — so the pin is
reviewed rather than absent.

**Why must environments not rebuild the same commit?**
Because a rebuild produces a different image. Base-image tags may have moved, the
cache differs, timestamps differ. If production builds its own image, whatever
staging tested was a different artefact and the testing proved less than you
think. Build once, promote the digest.

**How do you keep a registry from filling up without breaking rollback?**
Define retention before it becomes urgent: expire branch and PR builds within
days, keep release tags indefinitely, and never delete a digest that is deployed
or that you might roll back to. Track deployed digests explicitly, because a
digest can be running with no tag pointing at it. And remember deleting a tag
only marks blobs for garbage collection.

**Can you use `podman auto-update` and digest-based deployment together?**
No, and that is a structural fact rather than a limitation. Auto-update watches a
tag for change; a digest never changes. Deciding between them is deciding whether
that service can accept an unreviewed update — which is a per-service question,
not a per-host one.

---

← Prev: [What a tag actually is](01-what-a-tag-is.md) · Index: [Phase 12](../README.md) · Next → [02 · Building images in CI](../02-building-in-ci.md)
