---
title: "The build context"
sidebar_label: "15 · The build context"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [Docker — build context](https://docs.docker.com/build/concepts/context/),
> [Docker — BuildKit](https://docs.docker.com/build/buildkit/),
> [the Dockerfile reference — `.dockerignore`](https://docs.docker.com/reference/dockerfile/#dockerignore-file) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**"The build context is the set of files that your build can access."** It is
the positional argument at the end of `docker build .`, everyone types a dot
without thinking about it, and it decides upload time, cache behaviour and
whether `.env` ends up in the image.

## The four kinds

The positional argument does not have to be a directory.

| Context | Example | What it is |
|---|---|---|
| **Local directory** | `docker build .` | That directory, recursively |
| **Git repository** | `docker build https://github.com/user/repo.git` | A shallow clone, submodules included recursively |
| **Remote tarball** | `docker build https://example.com/ctx.tar.gz` | Downloaded and extracted — xz, bzip2, gzip or plain tar |
| **Stdin** | `docker build - < Dockerfile` | A Dockerfile with **no filesystem context at all** |

The stdin form has a sharp edge worth knowing: with a text-file context there is
no filesystem, so "Dockerfile instructions such as `COPY` can't refer to local
files." It is for a self-contained Dockerfile — one that only pulls a base image
and runs commands — and nothing else.

## Git contexts, precisely

The builder clones for you, which is genuinely useful in CI where the source is
already in a repository:

```bash
docker build https://github.com/user/myrepo.git#container:docker
docker buildx build 'https://github.com/user/myrepo.git?branch=container&subdir=docker'
```

The fragment form is `#ref:dir` — `ref` a branch, tag or commit hash, `dir` a
subdirectory to use as the context root. The query-parameter form does the same
thing and is the recommended spelling. **Commit hashes must be the full 40
characters**; a truncated hash is not accepted.

## Why the dot is a decision

`docker build .` at a repository root hands the builder everything: `.git`,
`node_modules`, `dist/`, `.env`, editor directories, coverage reports. Three
separate consequences, all covered in
[Phase 3 · .dockerignore](../phase-3-dockerfile/08-dockerignore.md) and worth
restating here because they are properties of the *context*, not of `COPY`:

1. **Transfer.** Everything in the context has to reach the builder. BuildKit
   makes this incremental — it "incrementally transfer[s] only the changed files
   in your build context between builds" and can "detect and skip transferring
   unused files" — but a cold builder still reads the lot.
2. **Cache.** `COPY . .` hashes the context, so anything in it can invalidate the
   layer. `.git` present means every commit is a new checksum
   ([page 01](01-how-the-cache-decides.md)).
3. **Secrets.** A file in the context can be copied into a layer, deliberately or
   by a broad `COPY`.

The narrower answer is often the better one: point the build at a subdirectory
rather than the repository root, and let `.dockerignore` handle what remains.

## `.dockerignore`, and the per-Dockerfile variant

> "The build client looks for a file named `.dockerignore` in the root directory
> of the context."

Matching follows Go's `filepath.Match` rules with `**` support, and `!` marks
exceptions. One detail that is easy to miss and very useful in a repository with
several Dockerfiles:

**A Dockerfile-specific ignore file takes precedence over the root one.**
`build.Dockerfile.dockerignore` applies when building `build.Dockerfile`, so a
production build and a development build can have genuinely different contexts
without either one over-including.

## Named contexts

`--build-context` adds more contexts alongside the positional one, referenced as
if they were stages ([page 07](07-copy-from.md)):

```bash
docker build --build-context docs=./docs .
docker build --build-context scripts=https://github.com/user/deployment-scripts.git .
```

This is the supported answer to "my Dockerfile needs a file from a sibling
directory" — a `COPY ../shared/thing .` cannot work, because `../shared` is
outside the context by definition.

## Reading the size

The build output reports the context being transferred, and it is the first
number to look at when a build is slow before it has done anything. A large
context on a project with no `.dockerignore` is the single most common cause.

:::note No figures on this page
There is no sandbox on this track, so no transfer times or byte counts are shown.
Watch the context line in your own build output before and after adding a
`.dockerignore` — the change is usually obvious without measurement tooling.
:::

## Podman

`podman build` takes the same positional context argument, including local
directories and remote git or tarball URLs, and honours `.dockerignore` — and
also `.containerignore`, which it checks first. Use `.dockerignore` unless you
have a reason not to, since it works with both engines
([Phase 3 · .dockerignore](../phase-3-dockerfile/08-dockerignore.md)).

## Gotchas

**Symptom:** The build sits for a long time before the first instruction runs.
**Cause:** A large context being read and transferred — usually `.git` or
`node_modules`.
**Fix:** Add a `.dockerignore`, or point the build at a narrower directory.

**Symptom:** `COPY ../shared/config.json .` fails.
**Cause:** Anything outside the context is invisible to the build, by design.
**Fix:** Build from a higher directory with `-f` pointing at the Dockerfile, or
pass the sibling directory as a named context with `--build-context`.

**Symptom:** `docker build - < Dockerfile` fails on a `COPY`.
**Cause:** A stdin text-file context has no filesystem, so `COPY` has nothing to
read.
**Fix:** Use a directory context, or make the Dockerfile self-contained.

**Symptom:** A git-URL build fails to resolve a commit.
**Cause:** A shortened commit hash — the full 40 characters are required.
**Fix:** Use the full hash, or a branch or tag name.

## Interview questions

**★ What is the build context, and why does it matter?**
"The set of files that your build can access" — the positional argument to
`docker build`. It decides what has to be transferred to the builder, what
`COPY` can read, and what participates in the cache checksum for `COPY`/`ADD`.

**★ What can the context be, besides a directory?**
A git repository URL (shallow-cloned, submodules included, with `#ref:dir` or
query-parameter selection), a remote tarball (xz, bzip2, gzip or plain), or
stdin — where there is no filesystem, so `COPY` cannot refer to local files.

**★ How do you use a file that lives outside the build context?**
Pass it as a named context with `--build-context name=path` and reference it with
`COPY --from=name`. A `COPY ../` cannot work, because the context defines the
boundary.

**Where is `.dockerignore` looked up, and can there be more than one?**
In the root directory of the context. A Dockerfile-specific file such as
`build.Dockerfile.dockerignore` takes precedence over the root `.dockerignore`
when building that Dockerfile.

**Does BuildKit still upload the whole context every build?**
No — it transfers incrementally, sending only changed files and skipping unused
ones. A cold builder still reads everything, and excluded files never enter the
calculation at all, so `.dockerignore` still matters.

---

← Prev: [`docker build` vs `podman build` vs `buildah`](14-docker-vs-podman-vs-buildah.md) · Index: [Phase 4](README.md) · Next → [Reproducible builds](16-reproducible-builds.md)
