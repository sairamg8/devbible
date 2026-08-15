---
title: "The syntax directive"
sidebar_label: "15 · The syntax directive"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the
> [Dockerfile reference — parser directives](https://docs.docker.com/reference/dockerfile/#parser-directives),
> [Docker — custom Dockerfile syntax](https://docs.docker.com/build/buildkit/frontend/) and the
> [Dockerfile frontend release notes](https://docs.docker.com/build/buildkit/dockerfile-release-notes/).
> **No sandbox** — no console output on this page.

**One comment at the top of the file decides which Dockerfile *language* your
build uses.** It is how you get new Dockerfile features without upgrading the
engine, and it is the only reason `RUN --mount` and heredocs work on a machine
you did not configure.

## The line

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-slim
```

It must be the **very first line** — before any other comment, before `FROM`.
BuildKit reads it, pulls that **frontend image**, and hands it the Dockerfile to
parse. The frontend, not the engine, defines the instruction set.

## Why the version is `1` and not something more specific

`docker/dockerfile:1` means "the latest stable **1.x** frontend". BuildKit
resolves it at build time and caches it, so:

- **New features arrive without an engine upgrade** — `RUN --mount=type=cache`,
  heredocs, `COPY --link`, `ADD --checksum` and so on.
- **No breaking changes**, because 1.x is a stable major line.

That combination is why `:1` is the recommended pin rather than an exact version.
More specific forms exist when you need them:

```dockerfile
# syntax=docker/dockerfile:1            # latest stable 1.x — the default choice
# syntax=docker/dockerfile:1.7          # pin a minor line
# syntax=docker/dockerfile:1-labs       # experimental features
```

`1-labs` carries features not yet stable. Use it deliberately and expect
churn.

## What it unlocks

Without the directive you get the engine's built-in frontend, which is older.
Features that commonly need the line:

| Feature | Covered in |
|---|---|
| `RUN --mount=type=cache` | Phase 4 |
| `RUN --mount=type=secret` | Page 07, Phase 4 |
| `RUN --mount=type=bind` | Phase 4 |
| Heredocs (`RUN <<EOF`) | Page 14 |
| `COPY --link` | Phase 4 |
| `ADD --checksum`, git sources | Page 03 |

**The practical rule: put it at the top of every Dockerfile.** It costs one line,
it never hurts, and it removes an entire class of "works on my machine, fails in
CI" caused by different engine versions.

## The cost, stated honestly

The frontend is an **image that gets pulled**. So:

- The first build after a cache miss fetches it — a small download, but it is a
  network dependency.
- In an **air-gapped** environment the pull fails unless the frontend is mirrored
  into your registry (Phase 2, pages 12 and 14).
- It is one more thing coming from a registry, and it should be subject to
  whatever supply-chain policy you apply to base images.

None of these outweigh the benefit for ordinary work, but they are worth knowing
before a build fails in a locked-down network and nobody can explain why.

## Other parser directives

Two others exist, both rarely needed:

```dockerfile
# escape=`
```

Changes the line-continuation character — the one real use is Windows
Dockerfiles, where `\` is a path separator.

```dockerfile
# check=error=true
```

Turns build-check warnings into errors. Useful in CI to stop known-bad patterns
from merging.

Parser directives must all appear **before** any builder instruction, they are
case-insensitive, and a directive that appears after an instruction is treated as
an ordinary comment — silently, which is exactly how the syntax line ends up
doing nothing.

## Podman

`podman build` uses Buildah rather than BuildKit, and **does not fetch frontend
images**. The directive is accepted and ignored, so features that depend on a
newer frontend may not be available. Buildah implements many of them natively —
`RUN --mount` among them — but coverage lags BuildKit.

**Consequence for a portable Dockerfile:** keep the directive for Docker's
benefit, and test the build under Podman if it must work there. A frontend
feature that Buildah has not implemented fails at parse time, which is at least a
clear error.

## Gotchas

**Symptom:** `RUN --mount=type=cache` fails with a parse error.
**Cause:** No syntax directive, so the engine's older built-in frontend is
parsing the file.
**Fix:** Add `# syntax=docker/dockerfile:1` as the first line.

**Symptom:** The directive is present and appears to do nothing.
**Cause:** It is not the first line — a comment or a blank line precedes it, or
it comes after an instruction, in which case it is just a comment.
**Fix:** Move it to line 1.

**Symptom:** The build fails in an air-gapped environment on the frontend pull.
**Cause:** The frontend image cannot be fetched.
**Fix:** Mirror `docker/dockerfile` into the internal registry, or drop the
directive and avoid frontend-dependent features.

**Symptom:** A Dockerfile builds under Docker and fails under Podman.
**Cause:** A BuildKit frontend feature Buildah does not implement.
**Fix:** Check Buildah's support for that instruction; fall back to a portable
form if the file must build in both.

## Interview questions

**★ What does `# syntax=docker/dockerfile:1` do?**
Selects the BuildKit **frontend** that parses the Dockerfile. BuildKit pulls that
image and uses it, so new Dockerfile features become available without upgrading
the engine.

**★ Why pin `:1` rather than an exact version?**
`:1` resolves to the latest stable 1.x frontend, so you get new features with no
breaking changes. Exact minors exist for reproducibility, and `1-labs` for
experimental features.

**★ Where must it appear, and what happens if it does not?**
The very first line, before any other comment or instruction. Anywhere else it is
treated as an ordinary comment — silently — and the build uses the engine's older
built-in frontend.

**What does it cost?**
The frontend is pulled as an image, so it is a network dependency and it fails in
an air-gapped environment unless mirrored. It is also one more artefact from a
registry, deserving the same supply-chain scrutiny as a base image.

**Does it work with Podman?**
No — `podman build` uses Buildah, which does not fetch frontend images. The
directive is accepted and ignored. Buildah implements many BuildKit features
natively but lags on the newest ones, so test if the file must build under both.

---

← Prev: [Heredocs](14-heredocs.md) · Index: [Phase 3](README.md) · Next → [STOPSIGNAL and SHELL](16-stopsignal-and-shell.md)
