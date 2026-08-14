---
title: "Reading docker history"
sidebar_label: "06 · Reading docker history"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker image history](https://docs.docker.com/reference/cli/docker/image/history/),
> [docker image inspect](https://docs.docker.com/reference/cli/docker/inspect/) and the
> [OCI Image Specification](https://github.com/opencontainers/image-spec/blob/main/spec.md).
> **No sandbox** — no console output on this page.

**`docker history` shows how an image was built, layer by layer, with each
layer's size.** It is how you find the 400 MB nobody meant to ship, and how you
audit an image somebody else built.

## The command

```bash
docker history myapi:1.4.2
docker history --no-trunc myapi:1.4.2        # full commands, not elided
docker history --format '{{.Size}}\t{{.CreatedBy}}' myapi:1.4.2
docker history -H=false myapi:1.4.2          # raw bytes, for sorting
```

The output is newest layer **first**, oldest last — so your own instructions are
at the top and the base image's are underneath.

| Column | Meaning |
|---|---|
| `IMAGE` | The layer's ID, or `<missing>` |
| `CREATED` | When that layer was built |
| `CREATED BY` | The instruction that produced it |
| `SIZE` | Bytes **this layer** adds |
| `COMMENT` | Usually empty; used by some builders |

## `<missing>` is not an error

Most rows show `<missing>` in the IMAGE column. That is normal: only layers
present as full images locally have IDs, and intermediate layers pulled as part
of an image do not. It says nothing about the image's health.

## Finding the fat

The workflow is short:

1. Run `docker history` and look at the SIZE column.
2. Find the largest layer.
3. Read its `CREATED BY` — that instruction is the cause.
4. Ask whether what it added has to be in the **final** image.

Typical culprits, in rough order of frequency:

| What you see | The real problem |
|---|---|
| A large `RUN apt-get install …` | Package caches and recommended packages not cleaned in the same layer |
| A large `COPY . .` | `.dockerignore` missing, so `.git`, `node_modules` and build output came in |
| A large `RUN npm ci` | Dev dependencies in the runtime image |
| A large `RUN curl … && tar …` | A toolchain extracted and later "removed" in a different layer |
| A big base layer | The base image choice itself — page 05 |

Each has a structural fix in Phases 3–5: clean in the same `RUN`, write a
`.dockerignore`, install production-only dependencies, and use multi-stage so
build tooling never reaches the final stage.

## Auditing an image you did not build

`history` plus `inspect` tells you most of what an unfamiliar image does before
you run it:

```bash
docker history --no-trunc unknown/image:tag     # how it was built
docker image inspect unknown/image:tag          # the config it will run with
```

Read for: what it installs, whether it runs as root (`Config.User` empty means
root), what its entrypoint is, what it fetched from the network during build, and
whether any step looks like it embedded a credential.

⚠️ **`history` shows build-time `ARG` values.** A secret passed as a build
argument is visible here to anyone who has the image. This is the concrete reason
`ARG` is not a secret mechanism, and `RUN --mount=type=secret` exists (Phases 3
and 4).

## The limits of what it can tell you

- It reports the **instruction**, not the resulting files. A 400 MB
  `RUN apt-get install` does not say *which* package.
- Squashed or exported-and-reimported images lose history entirely.
- Some builders write less detail into the `CREATED BY` field than BuildKit does.

For file-level attribution you need a layer-explorer tool (the `dive`-style
approach) or to extract the layer tar and list it. `docker history` narrows it to
one instruction; that is usually enough to act.

## Podman

`podman history` mirrors it, with the same columns and `--no-trunc`. Because both
consume the OCI image format, the history of an image built by either engine
reads the same way in the other.

## Gotchas

**Symptom:** The sizes in `history` do not add up to the image size in
`docker images`.
**Cause:** Rounding, metadata-only layers with size 0, and shared base layers
counted differently.
**Fix:** Use `history` to find the *largest* layer, not to reconcile totals.
`docker system df -v` is the tool for real consumption.

**Symptom:** A big layer's `CREATED BY` is truncated with `…`.
**Cause:** The default output elides long commands.
**Fix:** `--no-trunc`.

**Symptom:** `history` on a pulled image shows almost nothing useful.
**Cause:** The image was squashed, or built by a tool that writes minimal build
metadata.
**Fix:** Accept the limit and inspect the filesystem instead — `docker create`
plus `docker export`, or extracting layer tars.

**Symptom:** An API token is visible in `history`.
**Cause:** It was passed as a build `ARG` or echoed into a `RUN`.
**Fix:** Rotate it — the image is compromised and rebuilding does not unpublish
what was already pushed. Then use `RUN --mount=type=secret`. Phase 4.

## Interview questions

**★ How do you find out why an image is unexpectedly large?**
`docker history --no-trunc <image>`, find the largest layer, and read the
instruction that created it. That instruction is the cause; the fix is
structural — same-layer cleanup, `.dockerignore`, production-only dependencies,
or multi-stage.

**★ Why do most rows show `<missing>` for the image ID?**
Only layers that exist as full images locally have IDs. Intermediate layers
pulled as part of an image do not, so `<missing>` is normal and not a fault.

**★ What can `docker history` reveal that it should not?**
Build-time `ARG` values, including secrets passed that way, and any command that
embedded a credential. Anyone with the image can read them, which is why build
arguments are not a secret mechanism.

**What are the limits of `docker history`?**
It shows the instruction, not the files it produced, so it cannot tell you which
package accounts for the size. Squashed or re-imported images lose history
entirely. It narrows the problem to one instruction, which is usually enough.

---

← Prev: [Choosing a base image](05-choosing-a-base-image.md) · Index: [Phase 2](README.md) · Next → [The image config](07-image-config.md)
