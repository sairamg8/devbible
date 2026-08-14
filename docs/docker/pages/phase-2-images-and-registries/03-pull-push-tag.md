---
title: "pull, push, images, tag and rmi"
sidebar_label: "03 · pull, push, tag, rmi"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker image pull](https://docs.docker.com/reference/cli/docker/image/pull/),
> [docker image push](https://docs.docker.com/reference/cli/docker/image/push/),
> [docker image tag](https://docs.docker.com/reference/cli/docker/image/tag/),
> [docker image rm](https://docs.docker.com/reference/cli/docker/image/rm/) and
> [docker image ls](https://docs.docker.com/reference/cli/docker/image/ls/).
> **No sandbox** — no console output on this page.

**Five verbs cover the whole local image store.** The one that surprises people
is `tag`, because it does not copy anything.

## The commands

```bash
docker pull node:24                     # fetch into the local store
docker images                           # what is here
docker images -a                        # including intermediate layers
docker tag myapi:1.4.2 ghcr.io/org/api:1.4.2   # add a NAME, copy nothing
docker push ghcr.io/org/api:1.4.2       # upload
docker rmi myapi:1.4.2                  # remove a tag (and layers if last)
```

## `tag` creates a name, not a copy

`docker tag` adds a second reference to the **same** image. No bytes are copied,
nothing is duplicated on disk, and both names resolve to the same image ID.

```bash
docker build -t myapi:1.4.2 .
docker tag myapi:1.4.2 ghcr.io/myorg/api:1.4.2
docker tag myapi:1.4.2 ghcr.io/myorg/api:latest
docker push ghcr.io/myorg/api:1.4.2
docker push ghcr.io/myorg/api:latest
```

Three names, one image, three pushes that upload the layers once and then just
register the additional names.

This is also **how you push anywhere but Docker Hub**: the destination registry
is part of the image name, so you retag before pushing. There is no
`docker push --registry` flag; the registry lives in the reference
([page 01](01-image-references.md)).

## `pull` and what it actually transfers

`pull` fetches the manifest, then only the layers you do not already have.
Layers are shared across images, so pulling a second image built on the same base
downloads very little.

```bash
docker pull node:24                       # tag
docker pull node@sha256:9f2c…             # digest — exact
docker pull --platform linux/amd64 node:24  # a specific architecture
docker pull -a myorg/api                  # every tag in the repository, rarely wanted
```

`--platform` matters on Apple Silicon and arm64 servers, where you sometimes need
the `amd64` variant deliberately — page 10.

## `images` — reading the list

```bash
docker images
docker images --filter dangling=true         # untagged leftovers
docker images --filter reference='myorg/*'
docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}'
docker images --digests                      # show digests, not just tags
```

Two things to know about the **SIZE** column:

- It is the image's **total** size, including shared layers. Adding up the
  column overcounts badly — five images built on the same 200 MB base do not
  occupy 1 GB. Use `docker system df` for real consumption.
- `<none>:<none>` rows are **dangling** images: layers that were tagged and then
  had the tag moved to a newer build. Normal, and what `image prune` clears.

## `rmi` removes a name first, layers second

```bash
docker rmi myapi:1.4.2      # remove this tag
docker rmi -f myapi:1.4.2   # force
docker image prune          # dangling only
docker image prune -a       # every unused image
```

If an image has three tags, `rmi` on one of them just removes that name. The
layers go only when the last reference disappears **and** no container references
the image. That is why `rmi` sometimes appears to free nothing.

⚠️ **A stopped container still counts as a reference.** "Image is being used by
stopped container abc123" is not a bug; remove the container first.

## `push` — what can go wrong

| Error | Cause |
|---|---|
| `denied: requested access to the resource is denied` | Not logged in, or pushing to a namespace you do not own |
| `unauthorized: authentication required` | Credentials expired or absent |
| `manifest blob unknown` | Usually a partial or interrupted push; retry |
| Push appears to succeed but the tag is missing | Pushed to a different registry than intended — check the full reference |

The commonest is the first, and it is nearly always the image name rather than
the credentials: `docker push myapi` targets `docker.io/library/myapi`, which
nobody but Docker can write to.

## Podman

All five verbs exist with the same names and flags. Two differences:

- **`podman push` requires a fully-qualified destination** more often, because
  short-name resolution differs (page 01). Write the full reference.
- Podman also supports **transports** — `podman push myimage
  docker-archive:/tmp/img.tar` or `oci-archive:`, and `skopeo` does this at a
  larger scale. Useful for moving images between hosts with no shared registry.

## Gotchas

**Symptom:** `docker tag` seems to have doubled your disk usage.
**Cause:** It did not. `docker images` lists the same image twice, each row
showing the full size.
**Fix:** `docker system df` for real usage. Two tags on one image cost one image.

**Symptom:** `docker push` says access denied and the credentials are correct.
**Cause:** The image name targets a namespace you do not own — typically Docker
Hub's `library`.
**Fix:** `docker tag` it into your own namespace or registry, then push that
name.

**Symptom:** `docker rmi` reports "image is being used by stopped container".
**Cause:** A stopped container still references the image.
**Fix:** `docker ps -a --filter ancestor=<image>`, remove the container, then the
image. Do not reach for `-f` first — it can leave dangling layers behind.

**Symptom:** Disk full of `<none>:<none>` images.
**Cause:** Dangling images from repeated rebuilds, where the tag moved to each
new build.
**Fix:** `docker image prune`. This is the safe prune — it only removes
untagged, unreferenced images.

## Interview questions

**★ What does `docker tag` do?**
Adds another name for an existing image. It copies nothing: both references
resolve to the same image ID and the same layers. It is how you retarget an image
at a different registry before pushing.

**★ How do you push an image to GHCR instead of Docker Hub?**
Tag it with the registry in the name — `docker tag myapi:1.4.2
ghcr.io/myorg/api:1.4.2` — then push that reference. The registry is part of the
image name; there is no separate flag.

**★ Why does `docker rmi` sometimes free no space?**
Because it removed a tag, not the image. Layers are deleted only when the last
reference to them is gone and no container — including a stopped one — still
references the image.

**What are `<none>:<none>` images?**
Dangling images: previously-tagged builds whose tag has since moved to a newer
image. They are normal after repeated rebuilds and are what `docker image prune`
removes.

**Why is summing the SIZE column in `docker images` misleading?**
Each row shows the image's total size including shared layers, so images built on
a common base are counted many times over. `docker system df` reports actual
consumption.

---

← Prev: [Tags move, digests do not](02-tags-vs-digests.md) · Index: [Phase 2](README.md) · Next → [Layers](04-layers.md)
