---
title: "RUN --mount=type=bind"
sidebar_label: "10 · RUN --mount=type=bind"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the Dockerfile reference — `RUN --mount=type=bind`](https://docs.docker.com/reference/dockerfile/#run---mounttypebind),
> [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/) and
> [Docker — build cache invalidation](https://docs.docker.com/build/cache/invalidation/).
> **No sandbox** — no console output on this page.

**A bind mount lets a `RUN` read files from the build context, another stage or
another image without `COPY`ing them into a layer.** Use it when the build needs
to *see* a file but the image does not need to *contain* it.

## The distinction that matters

`COPY` does two things at once — it makes a file available to subsequent
instructions, **and** it puts that file in a layer of the image. Often you only
wanted the first.

| | `COPY requirements.txt .` then `RUN pip install …` | `RUN --mount=type=bind,source=requirements.txt,target=/tmp/r …` |
|---|---|---|
| The `RUN` can read the file | ✓ | ✓ |
| The file is in the image | ✓ — forever | ✗ |
| A layer is created for it | ✓ | ✗ |

The best-practices guide gives exactly this case: to "temporarily add a
`requirements.txt` file for a `RUN pip install` instruction" a bind mount is
"more efficient than `COPY`". And it adds the boundary — "if you need to include
files from the build context in the final image, use `COPY`."

## The syntax and options

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.13-slim
WORKDIR /app
RUN --mount=type=bind,source=requirements.txt,target=/tmp/requirements.txt \
    pip install -r /tmp/requirements.txt
COPY . .
CMD ["python", "main.py"]
```

| Option | Meaning |
|---|---|
| `target`, `dst`, `destination` | Mount path inside the build container |
| `source` | Source path in the `from`; defaults to its root |
| `from` | Build stage, context or image name for the root of the source |
| `rw`, `readwrite` | "Allow writes on the mount. Written data will be discarded after the `RUN` instruction completes." |

The default `from` is the build context, so `source=` alone reads from your
project directory. **The mount is read-only unless you say otherwise**, and even
then writes are thrown away when the instruction ends — a bind mount is never a
way to produce output.

## Three things it is good for

**1. Manifests you install from but do not ship.** The example above: the image
has the installed packages and no `requirements.txt`. Same for a lockfile,
a `go.mod`, a `composer.json`.

**2. Compiling from source without a source layer.** Mount the whole context,
build, and write only the artefact into the image:

```dockerfile
FROM golang:1.26 AS build
WORKDIR /src
RUN --mount=type=bind,target=. \
    --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /bin/app ./cmd/app
```

`/bin/app` is outside the mount, so it survives; the source never becomes a
layer of the build stage. Note how naturally it composes with cache mounts
([page 09](09-mount-type-cache.md)) — one `RUN`, three mounts, each with a
different lifetime.

**3. Borrowing a tool from another image.** `from=` accepts an image, so a
linter, a migration binary or a certificate bundle can be used during one
instruction without being installed:

```dockerfile
RUN --mount=type=bind,from=ghcr.io/example/tool:1.4,source=/usr/local/bin/tool,target=/usr/local/bin/tool \
    tool validate ./config.yaml
```

Compare with `COPY --from=<image>` ([page 07](07-copy-from.md)): copy when the
image needs the tool at runtime, bind when only the build does.

## It caches correctly

Bind mounts are one of the three forms that read the filesystem, so the builder
does not treat the instruction as text alone:

> "For the `ADD` and `COPY` instructions, and for `RUN` instructions with bind
> mounts, the builder calculates a cache checksum from file metadata to determine
> whether cache is valid."

So a `RUN --mount=type=bind` over `requirements.txt` re-executes when that file
changes and hits when it does not — the same protection the manifest-first
`COPY` gives you ([page 03](03-dependency-install-pattern.md)), without the
layer. Mount the *narrowest* path you can: binding the whole context means every
source edit invalidates the instruction, which is precisely the problem ordering
was meant to solve.

## Where the ordering pattern still wins

A bind mount is not a replacement for the dependency-install pattern; it is a
refinement of it. Both make the install depend on the manifest alone. The
difference is only whether the manifest ends up in the image.

Prefer the plain `COPY` version when:

- the file is genuinely wanted at runtime (`package.json` often is — some tools
  read it in production);
- the Dockerfile must build under an older frontend or under Buildah, where mount
  support varies ([page 08](08-buildkit.md));
- readability matters more than one small layer, which for a manifest of a few
  kilobytes is a defensible call.

Prefer the bind version when the file is large, is genuinely build-only, or when
you are already using cache mounts in the same `RUN` and the symmetry is worth
having.

## Podman

Buildah implements `RUN --mount=type=bind` with the same `target`/`dst`/`destination`,
`source` and `from` options. As with the other mount types, availability follows
the installed Buildah version rather than the `# syntax=` line, since Buildah
ignores that directive ([page 08](08-buildkit.md)). For a Dockerfile that must
build under both engines, the plain `COPY` form remains the safe default.

## Gotchas

**Symptom:** A file written during a `RUN --mount=type=bind,rw` is gone in the
next instruction.
**Cause:** "Written data will be discarded after the `RUN` instruction completes."
**Fix:** Write outputs to a path outside the mount, or to a cache mount if it is
purely an optimisation.

**Symptom:** Every source edit re-runs the install.
**Cause:** The mount targets the whole context, so its checksum changes whenever
anything changes.
**Fix:** Mount just the manifest with `source=`.

**Symptom:** The image is missing a file you expected to be there.
**Cause:** It was bind-mounted, not copied — the mount does not create a layer.
**Fix:** `COPY` it, if the runtime genuinely needs it. That is the documented
boundary.

**Symptom:** The Dockerfile builds under Docker and fails under Podman.
**Cause:** A mount option the installed Buildah version does not implement, and
the `# syntax=` pin does not help there.
**Fix:** Use `COPY` for the cross-engine path, or confirm the Buildah version's
support.

## Interview questions

**★ When would you use `RUN --mount=type=bind` instead of `COPY`?**
When the build needs to read a file but the image does not need to contain it — a
`requirements.txt` or lockfile you install from, or a whole source tree you
compile and then discard. `COPY` both exposes the file and puts it in a layer;
the bind mount only exposes it.

**★ Can a `RUN` write through a bind mount?**
Only with `rw`, and the writes are discarded when the instruction finishes. A
bind mount is never a way to produce build output.

**★ Does a bind-mounted file participate in the build cache?**
Yes. `RUN` instructions with bind mounts are one of the forms for which "the
builder calculates a cache checksum from file metadata", so the instruction
re-runs when the mounted files change — which is why you should mount the
narrowest path rather than the whole context.

**How does `--mount=type=bind,from=<image>` differ from `COPY --from=<image>`?**
The bind makes the image's files visible for one instruction; the copy puts them
in your image. Bind when only the build needs the tool, copy when the runtime
does.

**What is the default source of a bind mount?**
The build context, at its root. `from=` changes it to a stage, a named context or
an image; `source=` selects a subpath.

---

← Prev: [`RUN --mount=type=cache`](09-mount-type-cache.md) · Index: [Phase 4](README.md) · Next → **`buildx` and platforms** *(not written yet)*
