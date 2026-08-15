---
title: "VOLUME in a Dockerfile"
sidebar_label: "13 · VOLUME"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the [Dockerfile reference — VOLUME](https://docs.docker.com/reference/dockerfile/#volume),
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/) and
> [docker container run — rm](https://docs.docker.com/reference/cli/docker/container/run/).
> **No sandbox** — no console output on this page.

**`VOLUME` declares a path that gets an anonymous volume in every container
started from the image.** It sounds helpful. In an application image it usually
is not, and this page is mostly about why.

## What it does

```dockerfile
VOLUME /var/lib/postgresql/data
VOLUME ["/data", "/logs"]
```

For every container from this image, the engine creates an **anonymous volume**
and mounts it at that path — unless the run explicitly mounts something else
there.

The intent is protective: data written to that path survives the container, and
does not go through the union filesystem
([Phase 0, page 07](../phase-0-what-a-container-is/07-overlayfs.md)).

## Why it usually hurts

**1. Anonymous volumes accumulate.** Every container gets a fresh one with a
random name. Run a container fifty times and you have fifty orphaned volumes,
none identifiable. `docker volume ls` becomes a wall of hashes, and reclaiming
them means guessing.

**2. It silently defeats `--read-only`.** A container run with `--read-only` for
hardening still has a writable volume at the declared path, because `VOLUME`
mounted one. The hardening is quietly partial.

**3. It cannot be undone downstream.** There is no `VOLUME NONE`. If your base
image declares one, every image built `FROM` it inherits it, and neither you nor
your users can remove it in a child Dockerfile.

**4. Later `RUN`s writing to that path are discarded.** Changes made to a
declared volume path in a subsequent build step do not persist into the image —
a genuinely surprising behaviour that produces "my seed data is missing".

**5. It takes the decision away from the operator.** Where data lives is a
deployment decision. The image should not force an anonymous volume on everyone.

## The better pattern

**Leave `VOLUME` out and mount explicitly at run time**, where the operator
chooses a named volume, a bind mount, or nothing:

```bash
docker run -v pgdata:/var/lib/postgresql/data postgres:17
```

```yaml
services:
  db:
    image: postgres:17
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Named volumes are identifiable, survive `docker system prune --volumes`
([Phase 1, page 13](../phase-1-running-containers/13-reclaiming-disk.md)), and
make the data's existence visible in the Compose file, where a reader can see it.

## When it is defensible

Official database images (`postgres`, `mysql`, `mongo`) declare `VOLUME` on their
data directories deliberately, and it is a reasonable choice for them: it means a
user who forgets to mount anything still does not lose their database to the
writable layer, and the performance penalty of running a database on the union
filesystem is avoided.

The reasoning is "our users will otherwise be badly surprised" — a bar an
application image rarely meets. **Document the path instead**, and let the
Compose file mount it.

## Gotchas

**Symptom:** `docker volume ls` is full of unnamed volumes.
**Cause:** An image declaring `VOLUME`, run repeatedly.
**Fix:** `docker volume prune` removes the unused ones; mount a **named** volume
at that path so future containers stop creating anonymous ones.

**Symptom:** Files written to a path during the build are missing at run time.
**Cause:** The path was declared a `VOLUME` earlier in the Dockerfile, so
subsequent build writes to it are discarded.
**Fix:** Declare `VOLUME` after the writes, or not at all. Seed data belongs in
an entrypoint script or an init directory.

**Symptom:** `--read-only` is set and the container can still write somewhere.
**Cause:** An inherited `VOLUME` mounted a writable anonymous volume.
**Fix:** Check `docker image inspect --format '{{json .Config.Volumes}}'`. Mount
your own `tmpfs` or named volume there deliberately, and know it is writable.

**Symptom:** `--rm` deleted data you wanted to keep.
**Cause:** `--rm` removes **anonymous** volumes, which is exactly what `VOLUME`
creates
([Phase 1, page 02](../phase-1-running-containers/02-detached-and-cleanup.md)).
**Fix:** Named volumes for anything durable.

## Interview questions

**★ What does `VOLUME` do in a Dockerfile?**
Declares a path that receives an **anonymous** volume in every container from
that image, unless the run mounts something else there. The data then bypasses
the union filesystem and survives the container.

**★ Why is it usually a bad idea in an application image?**
Anonymous volumes accumulate unidentifiably, it silently defeats `--read-only`,
it cannot be removed by a downstream Dockerfile, later build writes to that path
are discarded, and it takes a deployment decision away from the operator.

**★ Why do official database images use it then?**
Because a user who mounts nothing would otherwise keep their database in the
container's writable layer — losing it on `rm` and paying the union filesystem's
copy-up cost. The bar is "users will be badly surprised otherwise", which an
application image rarely meets.

**How do you remove an inherited `VOLUME` declaration?**
You cannot — there is no `VOLUME NONE`. You can only mount something specific
there at run time. That irreversibility is one of the main arguments against
declaring it.

**Why did files written during the build disappear?**
They were written to a path already declared as a `VOLUME`, and changes to a
declared volume path in later build steps are discarded. Declare it after the
writes, or leave it out.

---

← Prev: [LABEL and image metadata](12-label-and-metadata.md) · Index: [Phase 3](README.md) · Next → [Heredocs](14-heredocs.md)
