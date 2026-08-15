---
title: ".dockerignore"
sidebar_label: "08 · .dockerignore"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the
> [Dockerfile reference — .dockerignore file](https://docs.docker.com/reference/dockerfile/#dockerignore-file),
> [Docker — build context](https://docs.docker.com/build/concepts/context/) and
> [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/).
> **No sandbox** — no console output on this page.

**`.dockerignore` controls the build context — what the builder is even allowed
to see.** It is four lines of configuration that decide your upload time, your
cache behaviour, and whether your `.env` file ships inside your image.

## The build context

When you run `docker build .`, the client packages that directory and sends it to
the builder **before** the build starts. That package is the context, and
`COPY . .` can only copy from it.

In a normal repository, the context includes:

- `.git/` — the entire history, often the largest single item
- `node_modules/` — thousands of files, about to be reinstalled anyway
- `dist/`, `build/`, `target/` — output from a previous local build
- `.env`, `*.pem`, `.aws/` — **secrets**
- `.vscode/`, `.idea/`, `coverage/`, logs, caches

`.dockerignore` excludes them. Without one, all of it is uploaded and much of it
is copied into a layer.

## Three separate problems it solves

**1. Upload time.** A 900 MB context takes seconds to transfer on every build,
including builds that change nothing.

**2. Cache invalidation.** `COPY . .` hashes what it copies. If `.git/` is in
the context, **every commit changes the hash**, so the `COPY` layer and
everything after it rebuilds — even when no source file changed. This is the
subtle one, and it is why a build that "should be cached" is not.

**3. Secrets.** `COPY . .` with a `.env` present puts credentials in a layer.
Deleting them in a later instruction does not remove them
([Phase 2, page 04](../phase-2-images-and-registries/04-layers.md)) — the image
ships them permanently.

## A working file

```gitignore
# version control
.git
.gitignore

# dependencies - reinstalled in the image
node_modules
**/node_modules

# build output
dist
build
coverage

# secrets  ← the reason this file is Master tier
.env
.env.*
*.pem
*.key
secrets/

# local noise
.vscode
.idea
*.log
.DS_Store

# docker's own files
Dockerfile*
.dockerignore
compose*.yaml
```

Excluding `Dockerfile` itself is deliberate: the builder receives it separately,
so it does not need to be in the context, and keeping it out means editing it
does not invalidate a `COPY . .` layer.

## Syntax

The format resembles `.gitignore` but is **not** identical:

| Pattern | Matches |
|---|---|
| `node_modules` | Anything with that name **at the context root** |
| `**/node_modules` | At any depth |
| `*.log` | Any `.log` file at the root |
| `**/*.log` | Any `.log` file anywhere |
| `!keep.log` | An exception — re-include |
| `# comment` | A comment line |

Two differences worth internalising:

- **`node_modules` alone does not match nested ones.** Use `**/node_modules`
  when the project has workspaces.
- **Order matters for `!` exceptions.** The last matching pattern wins, so a
  re-inclusion must come *after* the exclusion.

## The allowlist approach

For a repository with a large amount of unrelated material, inverting is
clearer and safer:

```gitignore
# exclude everything…
*

# …then re-include only what the build needs
!src/
!package.json
!package-lock.json
!tsconfig.json
```

Nothing new in the repository can reach the image by accident. The cost is
remembering to add a `!` line when a genuinely needed file appears — which fails
loudly at build time rather than silently shipping something.

## `.dockerignore` and `.gitignore` are different files

They overlap and are not interchangeable:

- **`.gitignore`** keeps things out of version control.
- **`.dockerignore`** keeps things out of the build context.

`node_modules` belongs in both. **`Dockerfile` belongs only in `.dockerignore`.**
A generated file that is committed deliberately belongs in `.dockerignore` and
not `.gitignore`. Do not symlink one to the other.

## Podman

`podman build` honours `.dockerignore`, and also `.containerignore` — same
syntax, checked first. Use `.dockerignore` unless you have a specific reason,
since it works with both.

## Gotchas

**Symptom:** Builds are slow and the first output line takes ages.
**Cause:** A huge context being transferred, usually `.git` or `node_modules`.
**Fix:** Add a `.dockerignore`. The build output reports the context size — watch
it drop.

**Symptom:** The cache misses on every commit although no source changed.
**Cause:** `.git/` in the context, so `COPY . .` sees a different hash each time.
**Fix:** Exclude `.git`. This is the most common cause of "the cache does not
work".

**Symptom:** A scanner found `.env` inside an image.
**Cause:** `COPY . .` with no `.dockerignore`.
**Fix:** Rotate every credential in that file — the image was published with
them. Then add the ignore rules.

**Symptom:** `node_modules` is excluded but still ends up in the image.
**Cause:** The pattern matched only the root-level directory, and the project has
nested ones.
**Fix:** `**/node_modules`.

## Interview questions

**★ What does `.dockerignore` actually do?**
Excludes paths from the **build context** — the archive the client sends to the
builder before the build. Excluded files cannot be `COPY`'d, are not transferred,
and do not participate in cache hashing.

**★ Why does a missing `.dockerignore` break the build cache?**
Because `.git/` ends up in the context and `COPY . .` hashes what it copies. Every
commit changes that hash, so the `COPY` layer and everything after it rebuild
even when no source file changed.

**★ What is the security consequence of not having one?**
`COPY . .` copies `.env`, keys and certificates into a layer, and later deletion
cannot remove them. Any credential that reached a published image must be
rotated.

**How does the syntax differ from `.gitignore`?**
`node_modules` matches only at the context root — nested ones need
`**/node_modules`. `!` re-includes, and the last matching pattern wins, so
exceptions must follow their exclusions.

**When would you use an allowlist instead?**
In a large or mixed repository. `*` followed by `!` lines for exactly what the
build needs means nothing new can reach the image accidentally; the trade is that
a newly-needed file fails the build until you add it.

---

← Prev: [ENV versus ARG](07-env-vs-arg.md) · Index: [Phase 3](README.md) · Next → [USER](09-user.md)
