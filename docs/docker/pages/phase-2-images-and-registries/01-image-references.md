---
title: "Image references"
sidebar_label: "01 · Image references"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the
> [OCI Distribution Specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md),
> [docker image pull](https://docs.docker.com/reference/cli/docker/image/pull/) and
> [Podman — registries.conf](https://github.com/containers/image/blob/main/docs/containers-registries.conf.5.md).
> **No sandbox** — no console output on this page.

**`node:24` is four things you did not type plus one you did.** Learning to read
an image reference in full is what makes registry errors, pinning and the
Docker/Podman difference all make sense at once.

## The full form

```
[registry[:port]/][namespace/]repository[:tag][@digest]
```

Everything except the repository is optional, and every omission has a default:

| Part | If omitted, Docker assumes |
|---|---|
| registry | `docker.io` — Docker Hub |
| namespace | `library` — the official-images namespace |
| tag | `latest` |
| digest | none — resolve the tag at pull time |

So the reference you type expands like this:

| You type | It means |
|---|---|
| `node` | `docker.io/library/node:latest` |
| `node:24` | `docker.io/library/node:24` |
| `myorg/api` | `docker.io/myorg/api:latest` |
| `ghcr.io/myorg/api:1.4.2` | Exactly that — the registry is explicit |
| `registry.local:5000/api:dev` | A registry on a non-default port |
| `node@sha256:abc…` | An exact image, tag irrelevant |

## How the registry is recognised

The rule is not "the first segment is the registry". It is:

> **The first segment is a registry only if it contains a `.` or a `:`, or is
> exactly `localhost`.**

That is why `myorg/api` is a Docker Hub user's repository, while
`registry.local/api` and `localhost:5000/api` are not. It also explains a
recurring confusion: a Hub namespace that looks like a hostname would be
misread, which is why nobody has one.

## `library` — the official-images namespace

Images with no namespace live in `library`, which is reserved for Docker's
**Official Images**. `node`, `postgres`, `redis`, `nginx` and `alpine` are all
`docker.io/library/…`.

Two practical consequences:

- **A single-word image name is a strong signal it is an official image.** If a
  tutorial tells you to pull `mycompany-api`, that is not a namespace-less
  official image; it does not exist.
- **On other registries there is no `library` default.** `ghcr.io/node` is not
  the Node official image, and pushing to a registry usually requires the
  namespace to be your account or organisation.

## Podman resolves short names differently

🔴 This is the first place the two engines genuinely diverge, and it surprises
everyone once.

Docker hard-codes `docker.io` for unqualified names. Podman uses
`registries.conf` and its `unqualified-search-registries` list, which on many
distributions contains several registries. So `podman run nginx` may **prompt you
to choose** which `nginx` you meant, or resolve to a registry you did not expect.

The fix is the fix for everything else on this page too:

> **Write the reference in full.** `docker.io/library/nginx:1.27` is unambiguous
> in both engines, in every configuration, forever.

Short names are a convenience for typing at a prompt. In a Dockerfile, a Compose
file or a CI pipeline they are a latent bug.

## Case and character rules

- Repository names are **lowercase**. `MyOrg/API` is invalid, which surprises
  people coming from other package ecosystems.
- Tags may contain uppercase, digits, `.`, `_`, `-`, up to 128 characters, and
  may not begin with `.` or `-`.
- The digest is `sha256:` followed by 64 hex characters.

## Gotchas

**Symptom:** `docker pull myimage` fails with "pull access denied ... repository
does not exist or may require 'docker login'".
**Cause:** It resolved to `docker.io/library/myimage`, which does not exist.
Docker cannot tell "no such image" from "you cannot see it", so the message
covers both.
**Fix:** Use the full reference including namespace and registry. The error is
almost never about authentication when you are pulling something public.

**Symptom:** `podman run nginx` asks which registry to use, or pulls from
somewhere unexpected.
**Cause:** `unqualified-search-registries` in `registries.conf`.
**Fix:** Fully qualify: `docker.io/library/nginx`. Do this in every Dockerfile
and Compose file, not just at the prompt.

**Symptom:** A build works locally and fails in CI with "manifest unknown".
**Cause:** The tag exists locally from an earlier pull but no longer exists in
the registry — it was deleted or moved.
**Fix:** Pin by digest for anything that must be reproducible, and do not assume
a local image proves a remote one exists.

**Symptom:** A push is rejected with "denied: requested access to the resource is
denied".
**Cause:** Pushing to a namespace you do not own — often `docker push myapi`,
which targets `docker.io/library/myapi`.
**Fix:** Tag it into your own namespace first: `docker tag myapi
docker.io/myuser/myapi:1.0`.

## Interview questions

**★ What does `node:24` expand to in full?**
`docker.io/library/node:24` — Docker Hub as the registry, `library` as the
official-images namespace, and the tag as given. Omitting the tag would add
`:latest`.

**★ How does the CLI decide whether the first segment is a registry?**
It is a registry only if it contains a `.` or a `:`, or is exactly `localhost`.
That is why `myorg/api` is a Hub repository while `registry.local/api` and
`localhost:5000/api` are not.

**★ Why should you fully qualify image references?**
Because short-name resolution differs between engines: Docker assumes
`docker.io`, while Podman consults `unqualified-search-registries` and may
prompt or resolve elsewhere. A full reference is unambiguous everywhere, and in
a Dockerfile or CI pipeline a short name is a latent bug.

**What is the `library` namespace?**
The namespace holding Docker Official Images, applied by default when no
namespace is given. It is why `postgres` and `library/postgres` are the same
thing, and why single-word names are a signal that an image is official.

**Why does `docker pull mytypo` say the repository "may require docker login"?**
Because the registry cannot distinguish "does not exist" from "exists but you
cannot see it" without leaking information about private repositories. The
message covers both, and for a public pull it almost always means the name is
wrong.

---

← Index: [Phase 2](README.md) · Next → [Tags move, digests do not](02-tags-vs-digests.md)
