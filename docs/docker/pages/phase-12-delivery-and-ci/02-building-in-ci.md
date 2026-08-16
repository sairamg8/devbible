---
title: "Building images in CI"
sidebar_label: "02 · Building images in CI"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — build in CI](https://docs.docker.com/build/ci/),
> [Docker — GitHub Actions cache backend](https://docs.docker.com/build/cache/backends/gha/)
> and [Docker — building best practices](https://docs.docker.com/build/building/best-practices/).
> **No sandbox** — no console output on this page.

**A CI runner is a machine with no memory.** Everything your laptop accumulated
over months — base images, package downloads, a warm layer cache — is absent, and
that single fact explains why a build that takes fifteen seconds locally takes
eight minutes in CI.

The craft is giving that machine a memory **without giving it stale state**.

## The shape

CI's job is "running tests and builds to vet that the code changes don't cause
any unwanted or unexpected behaviors", and for a containerised project the
sequence is short:

```
checkout → build the image → test that image → push it → record the digest
```

🔴 **Build once per commit, and test the artefact you are going to ship.** The
common wrong shape is a `test` job that builds an image and a `publish` job that
builds it again — two different artefacts from one commit, with the tests having
proved something about the one you threw away
([topic 01](01-tag-strategy/02-the-strategy.md)).

The output of the pipeline is not "a green tick". It is **a digest**, recorded
somewhere the deployment can read.

## Why the cold build is slow

Nothing on a fresh runner is local:

| Cost | What is happening |
|---|---|
| Base image pull | Every layer of `FROM` comes over the network |
| Dependency install | `npm ci`, `pip install`, `apt-get` — full downloads, no cache |
| Every `RUN` | The layer cache is empty, so nothing can be reused ([Phase 4 · 01](../phase-4-build-strategy/01-how-the-cache-decides.md)) |
| Push | Every layer is new to the registry on the first build |

Only the second of these is your Dockerfile's fault, and
[Phase 4 · 03](../phase-4-build-strategy/03-dependency-install-pattern.md) is how
you make it cacheable. The rest is the runner being new, which is a CI problem
with a CI answer.

## Giving the runner a memory

BuildKit can export its cache at the end of a build and import it at the start of
the next one — `--cache-to` and `--cache-from`, with a choice of backend. The
mechanism, the backends and the `mode=min` versus `mode=max` decision are
[Phase 4 · 12](../phase-4-build-strategy/12-cache-import-export.md); what matters
here is which to pick and what it costs.

**The registry backend is the portable answer.** The cache lives in your registry
alongside the images, so it works on any CI system, on a self-hosted runner, and
from a developer's machine. Its cost is registry storage and transfer.

**A CI-native backend is the convenient answer.** The GitHub Actions backend
"utilizes the GitHub-provided Action's cache or other cache services supporting
the GitHub Actions cache protocol", with a `scope` parameter that is "a key used
to identify the cache object. By default, it is set to `buildkit`" — so separate
builds keep separate caches by giving each a distinct scope.

Two caveats the documentation names, and both show up as flaky pipelines rather
than as errors that say "cache":

- ⚠️ **Entries expire.** Stale cache entries are removed after a period, per
  GitHub's own usage limits and eviction policy — so a rarely-built branch is
  reliably cold and the occasional slow run is not a fault.
- ⚠️ **The cache API can rate-limit.** Too many requests in a short period during
  a build may cause timeouts; providing a token with repo scope mitigates it.

🔴 **Caching is not free, and it can be a net loss.** Exporting a cache takes
time and bandwidth. For a build whose layers are mostly unstable — a project
where nearly every commit touches the base of the Dockerfile — you can spend more
on cache round-trips than you save. Measure before assuming.

## PR builds and main builds are different jobs

They want different things, and conflating them is the second most common CI
mistake after double-building:

| | Pull request | Default branch |
|---|---|---|
| Tag | `pr-482` or the commit SHA | Immutable SHA tag plus moving tags |
| Push to registry? | Only if a preview needs it | Always |
| Cache | Read the main cache; write to a PR-scoped one | Read and write the main cache |
| Retention | Days | Releases forever, SHAs per policy |

⚠️ **Let PR builds write to the shared cache and one bad branch poisons every
build.** Scope PR caches separately, read from main's, and let them expire.

## What must not end up in the image

CI is where secrets are nearest to the build, so it is where they leak:

- **Never a build arg.** Build arguments are recoverable from the image, which is
  [Phase 4 · 13](../phase-4-build-strategy/13-build-args-vs-runtime-env.md)'s
  point. Use `RUN --mount=type=secret`
  ([Phase 4 · 05](../phase-4-build-strategy/05-mount-type-secret.md)), which
  never becomes a layer.
- **Never a registry password in the Dockerfile or the image.** Authentication is
  the pipeline's problem — [Phase 12 · 04 · Registry authentication in CI](04-registry-auth-in-ci.md).
- **Rotate, do not rebuild.** If something did get baked in, rebuilding does not
  unpublish the layer that already exists in the registry — the rule established
  back in [Phase 2](../phase-2-images-and-registries/README.md) and worth
  repeating every time this comes up.

CI is also the cheapest place to attach **provenance and SBOM attestations**,
because the pipeline already knows what it built and from where
([Phase 5 · 11](../phase-5-image-quality/11-sbom-and-provenance.md)).

## Multi-platform costs real time

If you publish for more than one architecture, CI is where that bill lands.
Emulation is the easy path and the slow one; cross-compilation and native runners
are the fast ones —
[Phase 4 · 11](../phase-4-build-strategy/11-buildx-and-platforms.md) ranks them.
The CI-specific note is that **an emulated build can be several times the
duration of a native one**, so it belongs on release builds rather than on every
pull request.

## Podman and Buildah in CI

Docker's documentation names GitHub Actions, GitLab, Circle CI and Render as
supported CI systems, but nothing about a container build requires Docker.
`podman build` and `buildah` produce OCI images that any registry accepts
([Phase 4 · 14](../phase-4-build-strategy/14-docker-vs-podman-vs-buildah.md)),
and being daemonless suits a runner where you would rather not have a privileged
socket ([Phase 11 · 01](../phase-11-podman-in-depth/01-daemonless/README.md)).

For a job that only moves images — retagging, promoting, mirroring — **Skopeo is
the smallest tool that does it**, with no engine on the runner at all
([Phase 11 · 12](../phase-11-podman-in-depth/12-buildah-and-skopeo.md)).

⚠️ **Pin the builder in CI.** A pipeline that works because of a builder-specific
default will break when the runner image changes, and the failure will look like
your Dockerfile's fault.

## Gotchas

**Symptom:** Tests pass in CI and the deployed image behaves differently.
**Cause:** The test job and the publish job each built their own image. Same
commit, different artefacts.
**Fix:** Build once, then test and push the same image. Pass the digest between
jobs rather than the source.

**Symptom:** The cache seems to work sometimes and not others.
**Cause:** Cache entries expire under the CI provider's eviction policy, and a
branch that builds rarely finds nothing. Scope collisions do the same thing.
**Fix:** Expect it. Give each pipeline a distinct `scope`, and treat an
occasional cold build as normal rather than as a bug to chase.

**Symptom:** Adding caching made builds slower.
**Cause:** Exporting and importing the cache costs time, and a Dockerfile whose
early layers change on most commits has little to reuse.
**Fix:** Measure with and without. Fix layer ordering first
([Phase 4 · 02](../phase-4-build-strategy/02-instruction-ordering.md)) — a
cacheable Dockerfile is what makes a cache worth carrying.

**Symptom:** A credential ended up in a published image.
**Cause:** It was passed as a build arg, or copied in and deleted in a later
layer. Both remain in the image.
**Fix:** `RUN --mount=type=secret`. And rotate the credential — the published
layer cannot be recalled.

## Interview questions

**★ Why is a CI build so much slower than the same build locally?**
Because the runner has no memory. There is no base image on disk, no package
cache, and an empty layer cache, so every step does full work and every layer is
new to the registry on push. Fixing it means exporting BuildKit's cache at the
end of a build and importing it at the start of the next, plus writing a
Dockerfile whose stable layers are actually reusable.

**★ What is wrong with building the image in the test job and again in the
publish job?**
They are two different artefacts from one commit — different base resolution,
different cache state — so the tests proved something about an image you then
discarded. Build once, test that image, push that image, and pass the digest
between jobs.

**★ How do you choose a cache backend?**
The registry backend is portable: it works on any CI system and from a developer
machine, at the cost of registry storage and transfer. A CI-native backend like
GitHub Actions' is more convenient but is scoped, expires under the provider's
eviction policy, and its API can rate-limit under heavy use. Either way, measure
— exporting a cache costs time, and on a project where early layers change
constantly it can be a net loss.

**How should pull-request builds differ from default-branch builds?**
PR builds tag ephemerally, push only if a preview needs it, read the main cache
but write to a PR-scoped one, and expire within days. Default-branch builds push
an immutable SHA tag plus moving tags and update the shared cache. Letting PR
builds write to the shared cache lets one branch poison everything else.

**Where do secrets belong in a CI build?**
Nowhere in the image. Build args are recoverable from the image, so anything
secret goes through `RUN --mount=type=secret`, which never becomes a layer.
Registry credentials belong to the pipeline, not the Dockerfile. And if something
did get baked in, the fix is rotation — rebuilding does not unpublish the layer
already in the registry.

**Do you need Docker specifically to build images in CI?**
No. `podman build` and `buildah` produce OCI images any registry accepts, and
being daemonless suits runners where a privileged socket is unwelcome. A job that
only moves images can use Skopeo with no engine installed at all. The one rule is
to pin whichever builder you choose, so a runner-image update does not silently
change your build.

---

← Prev: [Tag strategy](01-tag-strategy/README.md) · Index: [Phase 12](README.md) · Next → [03 · One image, three environments](03-one-image-three-environments/README.md)
