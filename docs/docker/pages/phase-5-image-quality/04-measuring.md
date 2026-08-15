---
title: "Measuring"
sidebar_label: "04 · Measuring"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [`docker image history`](https://docs.docker.com/reference/cli/docker/image/history/),
> [`docker image ls`](https://docs.docker.com/reference/cli/docker/image/ls/),
> [`docker system df`](https://docs.docker.com/reference/cli/docker/system/df/) and
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
> **No sandbox** — no console output on this page.

**Do not guess which layer is large — ask.** `docker history` attributes every
byte to the instruction that produced it, which turns image slimming from
folklore into a two-minute investigation.

## The three commands, and what each answers

| Command | Question it answers |
|---|---|
| `docker images` | How big is this image in total, including everything it inherits? |
| `docker history <image>` | **Which instruction** produced each layer, and how big is it? |
| `docker system df -v` | How much disk is this actually costing, once sharing is accounted for? |

They answer different questions and are not interchangeable. Most "why is my
image huge" conversations go wrong because someone used the first to answer the
second.

## `docker history` — the one that matters

It "displays the history of an image", one row per layer, with these columns:

| Column | What it is |
|---|---|
| `IMAGE` | The layer's image ID, or `<missing>` |
| `CREATED` | When the layer was built |
| `CREATED BY` | **The command that produced it** |
| `SIZE` | The space that layer consumes |
| `COMMENT` | Notes |

Read it bottom-up (oldest first) and look for the largest `SIZE`. The
`CREATED BY` on that row is the Dockerfile instruction to fix — and it is nearly
always one of the four sources from
[page 01](01-where-size-goes.md).

Two options make it usable:

```bash
docker history --no-trunc myapp:1.0
docker history --format '{{.Size}}\t{{.CreatedBy}}' myapp:1.0
```

`--no-trunc` stops the `CREATED BY` column being cut off, which matters because
the interesting part of a long `RUN` is usually at the end. `--format` takes a Go
template with `.ID`, `.CreatedSince`, `.CreatedAt`, `.CreatedBy`, `.Size` and
`.Comment`. `--human` is on by default; `--quiet` gives IDs only.

For a multi-architecture image, `--platform` selects which one to inspect —
"formatted as `os[/arch[/variant]]`" — so a manifest list does not have to be
pulled apart by hand
([Phase 4 · buildx and platforms](../phase-4-build-strategy/11-buildx-and-platforms.md)).

### `<missing>` is normal

Layers from a **pulled** image show `<missing>` in the `IMAGE` column: the layer
is part of the image's construction history but has no separately addressable
image locally. It is not damage, and it is not something to fix. In practice it
means the rows above your own instructions — the base image's — are anonymous,
which is fine because they are one line item you address by choosing a different
base.

### What multi-stage does to it

`docker history` shows the **final image's** layers only. A multi-stage build's
intermediate stages are not in the shipped image, so they do not appear — which
is exactly the point, and also why the history of a well-staged image is short
and dull. If you want to look inside a build stage, build it with
`--target` and inspect that
([Phase 4 · `--target`](../phase-4-build-strategy/06-target.md)).

## The thing history proves

The single most useful demonstration in this phase, and you can read it directly
off the output: **a `RUN` that deletes files still has a size, and the layer that
created them still has its size too.**

```dockerfile
RUN curl -o /tmp/big.tar.gz https://example.com/big.tar.gz   # layer A: large
RUN rm /tmp/big.tar.gz                                       # layer B: tiny
```

Layer A keeps its bytes. Layer B records a deletion and is nearly free. The image
contains both, and the file is gone from the *filesystem view* while still being
in the *image*. That is why every fix in
[page 02](02-classic-mistakes.md) is "same instruction" or "different stage".

It also means `docker history` is a **disclosure check**, not just a size check:
a `CREATED BY` that mentions a credential file, or a large layer for an
instruction that should have been small, is worth reading closely before the
image is pushed.

## Reading `docker images` honestly

> "The `SIZE` is the cumulative space taken up by the image and all its parent
> images."

So it includes the base, uncompressed, and two images sharing a base each report
it in full:

> "An image will be listed more than once if it has multiple repository names or
> tags. This single image (identifiable by its matching `IMAGE ID`) uses up the
> `SIZE` listed only once."

For the real disk answer, `docker system df -v` splits it:

- **SHARED SIZE** — "the amount of space that an image shares with another one
  (i.e. their common data)"
- **UNIQUE SIZE** — "the amount of space that's only used by a given image"

And note that **none of these is the pull size.** Registry layers are compressed,
and a layer the puller already has is not transferred at all — so an image that
looks large on disk may be cheap to deploy if it shares its base with everything
else on the host. When the number that matters is deployment time, the question
is how many layers are *new*, not how many bytes the image reports.

## A workflow

1. `docker history --no-trunc <image>` and find the largest layer.
2. Read its `CREATED BY`. Classify it: base, package cache, dev dependency,
   toolchain ([page 01](01-where-size-goes.md)).
3. Apply the matching fix — staging, `.dockerignore`, same-layer cleanup, cache
   mount.
4. Rebuild and run `docker history` again. **Compare, do not assume.**
5. When the largest remaining layer is one you can justify in a sentence, stop.

Step 5 is the phase gate: "justify every remaining megabyte" means being able to
name what each large layer is for.

:::note No output shown, deliberately
There is no sandbox on this track, so this page does not print a `docker history`
table or any byte counts. Run it against your own image — the largest row is the
answer, and it is legible without any further tooling.
:::

## Third-party tools

`dive` is the commonly used interactive layer explorer, and there are others that
render the same information more richly. They are reading exactly what
`docker history` and the image manifest expose, so nothing here depends on them —
they make a long history easier to browse, and none of them will tell you
something the built-in command cannot.

## Podman

`podman history`, `podman images` and `podman system df` mirror the Docker
commands with the same columns and the same meanings, including `<missing>` for
pulled layers. Nothing on this page changes under Podman.

## Gotchas

**Symptom:** `docker history` truncates the interesting part of a long `RUN`.
**Cause:** The default output truncates `CREATED BY`.
**Fix:** `--no-trunc`, or `--format '{{.Size}}\t{{.CreatedBy}}'`.

**Symptom:** Most rows show `<missing>` and it looks broken.
**Cause:** Layers from a pulled base image have no local image ID.
**Fix:** Nothing — it is expected. Those rows are the base, addressed by choosing
a different base.

**Symptom:** Summing `docker images` sizes far exceeds the disk actually used.
**Cause:** The column is cumulative and includes shared parent layers per image.
**Fix:** `docker system df -v` for SHARED and UNIQUE.

**Symptom:** The image shrank but deploys are no faster.
**Cause:** The saving was in a layer everyone already had, or the remaining new
layer is the large one; transfer is per-layer and compressed.
**Fix:** Look at which layers actually change per build — usually the one holding
your application code — rather than at the total.

## Interview questions

**★ How do you find out why an image is large?**
`docker history --no-trunc <image>`, read the largest `SIZE` row, and look at its
`CREATED BY` — that is the instruction responsible. Then classify it as base,
package cache, dev dependency or toolchain and apply the matching fix.

**★ What does `<missing>` mean in `docker history` output?**
The layer came from a pulled image and has no separately addressable local image
ID. It is normal for base-image layers and is not an error.

**★ Why is `docker images` SIZE misleading?**
It is "the cumulative space taken up by the image and all its parent images",
uncompressed — so images sharing a base each report it in full, and summing the
column overstates disk usage. `docker system df -v` gives SHARED and UNIQUE
sizes.

**Does `docker history` show a multi-stage build's intermediate stages?**
No — only the final image's layers, because the intermediate stages are not part
of it. Build with `--target` to inspect a stage.

**How would you demonstrate that deleting a file does not shrink an image?**
Create a large file in one `RUN` and delete it in the next, then look at
`docker history`: the creating layer keeps its full size and the deleting layer
is nearly empty, while the file is absent from the filesystem view.

---

← Prev: [Least privilege in the image](03-least-privilege.md) · Index: [Phase 5](README.md) · Next → [Alpine and musl](05-alpine-and-musl.md)
