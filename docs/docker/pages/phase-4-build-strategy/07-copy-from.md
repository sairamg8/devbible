---
title: "COPY --from"
sidebar_label: "07 · COPY --from"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the Dockerfile reference — `COPY`](https://docs.docker.com/reference/dockerfile/#copy),
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/),
> [Docker — build context](https://docs.docker.com/build/concepts/context/) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**`COPY --from` changes where the source path is read from — an earlier stage,
another image, or a named context — instead of the build context.** It is the
instruction that makes multi-stage builds actually transfer anything, and it does
two or three other useful things nobody expects.

## The three sources

> "`--from` lets you specify the source location to be a build stage, context, or
> image."

| Form | Reads from | Example |
|---|---|---|
| `--from=<stage name>` | A stage declared with `AS` | `COPY --from=build /app/dist ./dist` |
| `--from=<index>` | A stage by position, `0`-based | `COPY --from=0 /bin/hello /bin/hello` |
| `--from=<image>` | Another image entirely | `COPY --from=nginx:latest /etc/nginx/nginx.conf /nginx.conf` |

Prefer the **name**. Index references shift the moment a stage is inserted above
them, and the build keeps succeeding while copying from the wrong place.

## Copying out of an image you never run

The third form is the interesting one: an image can be used purely as a file
source. The documentation notes the image is pulled if needed, and nothing about
it is run.

```dockerfile
# a static binary from an upstream image, without its base
FROM alpine:3.23
COPY --from=ghcr.io/example/tool:1.4 /usr/local/bin/tool /usr/local/bin/tool
```

This is how you pick up a single CLI, a certificate bundle or a default config
without inheriting the whole image. Two conditions on it: the path must exist in
that image, and — as page 04 laid out — the artefact must not be dynamically
linked against a libc your base does not have.

The same form is also the polite way to take a reference config file from an
official image rather than pasting a copy into your repository that drifts.

## Named contexts — a fourth source

`--build-context` adds extra contexts alongside the positional one, and
"Dockerfile instructions can reference named contexts as if they are stages in a
multi-stage build":

```bash
docker build --build-context docs=./docs .
docker build --build-context scripts=https://github.com/user/deployment-scripts.git .
```

```dockerfile
COPY --from=docs /README.md ./README.md
```

Two things this unlocks:

- **Files from outside the build context** — the usual answer to "my Dockerfile
  needs a file from a sibling directory", which `COPY` alone cannot do.
- **Overriding an image reference without editing the Dockerfile**:

  ```bash
  docker buildx build --build-context alpine:3.23=docker-image://alpine:edge .
  ```

  "The `docker-image://` prefix marks the context as an image reference" — so a
  pinned base in the Dockerfile can be swapped for a test build without touching
  the file. That makes it a good CI tool for "does this build against the next
  base?" and a bad habit for everyday builds, because the Dockerfile no longer
  tells you what was used.

## The flags that travel with it

`COPY --from` composes with the rest of `COPY`'s options, and two matter often:

**`--chown`** — "sets ownership of copied files. Without this flag, files are
created with UID and GID of 0." Copying into an image that runs as a non-root
`USER` without it produces files the application cannot write
([Phase 3 · USER](../phase-3-dockerfile/09-user.md)):

```dockerfile
COPY --from=build --chown=node:node /app/dist ./dist
```

**`--chmod`** — sets permissions, "supports octal notation (e.g., `755`, `644`)
and symbolic notation (e.g., `+x`, `g=u`)". Available since Dockerfile 1.2.

**`--link`** (Dockerfile 1.4+) is worth knowing about: it "allows you to copy
files with enhanced semantics where your files remain independent on their own
layer and don't get invalidated when commands on previous layers are changed." In
other words, the copied layer's identity stops depending on the parent chain, so
changing an earlier instruction need not rebuild it. It is a real cache win for
large copied artefacts — with the caveat that the copy no longer sees the
existing filesystem, so it does not merge into a directory the way a plain `COPY`
does.

**`--parents`** (1.20+) preserves the source path structure, which is the
monorepo fix from [page 03](03-dependency-install-pattern.md).

## What crosses, and what does not

Only files. `COPY --from` transfers *paths*, never configuration: the source
stage's `ENV`, `WORKDIR`, `USER` and installed packages stay behind
([page 04](04-multi-stage-builds.md)). If the runtime needs an environment
variable the build stage set, set it again.

Relative source paths resolve against the source stage's `WORKDIR`, and relative
destinations against the current stage's. Mixing the two up is the usual cause of
"the file is not where I copied it" — spell the source path absolutely when in
doubt.

## Podman

`COPY --from` with a stage name, index or image works the same way. The
image form is subject to Podman's short-name resolution: an unqualified
`COPY --from=nginx:latest` may prompt or resolve differently than on Docker, so
write it fully qualified (`docker.io/library/nginx:1.29`) in any Dockerfile that
must build under both engines.

Support for the newer option flags — `--link`, `--parents` — follows the
installed Buildah version rather than the `# syntax=` line, because Buildah does
not fetch BuildKit frontends ([page 03](03-dependency-install-pattern.md)). Check
before relying on them in a cross-engine build.

## Gotchas

**Symptom:** After inserting a stage, the build copies the wrong files but does
not fail.
**Cause:** A positional `--from=0` now refers to a different stage.
**Fix:** Name every stage with `AS` and reference by name.

**Symptom:** The application cannot write to a directory it copied in.
**Cause:** Copied files are owned by UID 0 by default, and the image runs as a
non-root user.
**Fix:** `COPY --from=build --chown=<user>:<group>`.

**Symptom:** A binary copied from another image fails at start with a missing
shared library.
**Cause:** It was linked against a different libc — the classic glibc image into
an Alpine/musl base.
**Fix:** Copy only static artefacts across incompatible bases, or build on the
base you ship.

**Symptom:** `COPY --from=build ./dist ./dist` copies nothing or the wrong tree.
**Cause:** The relative source resolved against the *source stage's* `WORKDIR`,
which is not what you assumed.
**Fix:** Use an absolute source path.

## Interview questions

**★ What are the possible sources for `COPY --from`?**
A build stage by name, a build stage by index, an image reference, or a named
context passed with `--build-context`. Names are preferred over indices because
indices shift when stages are added.

**★ How do you take one file out of another image without inheriting it?**
`COPY --from=<image> <path> <dest>`. The image is pulled and used purely as a
file source; nothing in it runs, and none of its layers end up in your image.

**★ Why might copied files be unreadable or unwritable by your app?**
Because `COPY` creates them owned by UID and GID 0 unless `--chown` says
otherwise, and the image runs as a non-root `USER`. Add `--chown`, or `--chmod`
for permissions.

**What does `--link` change?**
The copied files land on their own independent layer that does not get
invalidated when earlier layers change — better caching for large artefacts. The
trade is that the copy does not see the existing filesystem, so it does not merge
into an existing directory the way a plain `COPY` does.

**When would you use `--build-context`?**
To bring in files that live outside the build context — a sibling directory or a
git repository — or to override an image reference at build time with
`docker-image://`, which is useful in CI and a bad default because the Dockerfile
stops describing what was built.

---

← Prev: [`--target` to stop at a stage](06-target.md) · Index: [Phase 4](README.md) · Next → [BuildKit](08-buildkit.md)
