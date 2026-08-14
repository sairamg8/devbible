---
title: "save/load versus export/import"
sidebar_label: "11 · save/load vs export/import"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [docker image save](https://docs.docker.com/reference/cli/docker/image/save/),
> [docker image load](https://docs.docker.com/reference/cli/docker/image/load/),
> [docker container export](https://docs.docker.com/reference/cli/docker/container/export/),
> [docker image import](https://docs.docker.com/reference/cli/docker/image/import/) and
> [skopeo](https://github.com/containers/skopeo).
> **No sandbox** — no console output on this page.

**`save`/`load` moves an *image*. `export`/`import` moves a container's
*filesystem*.** The names are similar, the results are not, and the difference
costs an hour the first time somebody hits it.

## The two pairs

| | `save` / `load` | `export` / `import` |
|---|---|---|
| Operates on | An **image** | A **container** |
| Preserves layers | **Yes** | No — flattened to one |
| Preserves the config | **Yes** — `Entrypoint`, `Cmd`, `Env`, `User` | **No** |
| Preserves tags and history | Yes | No |
| Result | The same image elsewhere | A filesystem you must configure to run |
| Use it for | Moving images without a registry | Extracting or flattening a filesystem |

```bash
# Image → tar → image, intact
docker save myorg/api:1.4.2 -o api.tar
docker load -i api.tar

# Container filesystem → tar → a bare image
docker export mycontainer -o fs.tar
docker import fs.tar myorg/flattened:1.0
```

## Why `import` produces something that will not start

`Entrypoint` and `Cmd` live in the **image config**, not in any file
([page 07](07-image-config.md)). `export` writes the container's filesystem, and
a filesystem contains no config. So the imported image has no idea what to run:

```bash
docker run myorg/flattened:1.0
# no command specified
```

You can supply one at import time, but you are rebuilding metadata by hand:

```bash
docker import --change 'ENTRYPOINT ["/app/server"]' \
              --change 'ENV NODE_ENV=production' \
              fs.tar myorg/flattened:1.0
```

If your goal was "move this image to another machine", this is the wrong tool.
Use `save`/`load`.

## When each is genuinely right

**`save`/`load`:**

- Moving images to an **air-gapped** or offline environment.
- Shipping an image to someone who has no access to your registry.
- Caching a pinned base image as a build artefact.

```bash
docker save myorg/api:1.4.2 | gzip > api.tar.gz     # compress; images are large
gunzip -c api.tar.gz | docker load
docker save -o base.tar node:24-slim postgres:17    # several images in one file
```

**`export`/`import`:**

- **Extracting a filesystem** to inspect it, or to feed another tool.
- **Flattening** an image to drop its history — occasionally used to remove a
  secret from earlier layers, though rotating the secret is still mandatory
  because the original image was already published.
- Building an image from a root filesystem tarball produced elsewhere.

## `skopeo` is usually the better tool

For moving images between registries or hosts, `skopeo` beats both pairs: it
copies **directly** between transports without a local daemon, a local store, or
an intermediate `docker load`.

```bash
skopeo copy docker://docker.io/library/node:24-slim docker://registry.local:5000/node:24-slim
skopeo copy docker://myorg/api:1.4.2 oci-archive:api.tar
skopeo inspect docker://myorg/api:1.4.2        # inspect WITHOUT pulling
```

`skopeo inspect` is worth adopting on its own — it reads an image's config and
digest straight from the registry, so you can check what a tag currently points
at without downloading gigabytes.

## Podman

`podman save`, `podman load`, `podman export` and `podman import` all exist with
the same semantics. Podman additionally supports transports in `save`:
`--format oci-archive`, `docker-archive`, and `oci-dir`. Since `skopeo` comes
from the same project, it is the natural companion — and it works perfectly well
against Docker registries and Docker-produced images.

## Gotchas

**Symptom:** An imported image starts with "no command specified".
**Cause:** `export`/`import` discards the config.
**Fix:** Use `save`/`load` for moving images. If you must import, reconstruct the
config with `--change`.

**Symptom:** A saved tar is enormous.
**Cause:** It contains every layer uncompressed.
**Fix:** Pipe through `gzip`. Or use `skopeo copy`, which transfers only what the
destination lacks.

**Symptom:** `docker load` reports success but `docker images` shows
`<none>:<none>`.
**Cause:** The tar was produced by `export` (no tags) or the image was saved by
ID rather than by tag.
**Fix:** `docker save` with the **tag**, not the ID. Tag the loaded image
manually if you already have the file.

**Symptom:** Flattening an image "removed" a leaked secret.
**Cause:** It removed it from the *new* image only. The original was already
built and probably pushed.
**Fix:** Rotate the secret. Flattening is not a remediation for exposure, only a
way to stop republishing it. Phase 5.

## Interview questions

**★ What is the difference between `docker save` and `docker export`?**
`save` writes an image — all layers plus the config, tags and history — so `load`
restores something runnable. `export` writes a container's filesystem only,
flattened, so `import` yields an image with no `Entrypoint`, `Cmd` or `Env`.

**★ How do you move an image to a machine with no registry access?**
`docker save` it (piped through gzip), transfer the file, `docker load` on the
other side. Or `skopeo copy` to an `oci-archive` and back, which avoids the
daemon entirely.

**★ Why does an imported image not know what to run?**
Because the start command lives in the image config, not in the filesystem, and
`export` copies only the filesystem. You can rebuild it with `--change`, but
`save`/`load` preserves it for free.

**When is `export` the right tool?**
When you want the filesystem itself — to inspect it, feed it to another tool, or
flatten an image's history. Not for moving an image between machines.

**What does `skopeo` add?**
Direct registry-to-registry and registry-to-archive copying with no daemon and no
local image store, plus `skopeo inspect` to read an image's config and digest
from the registry without pulling it.

---

← Prev: [Multi-arch images](10-multi-arch.md) · Index: [Phase 2](README.md) · Next → [Podman's registries.conf](12-podman-registries-conf.md)
