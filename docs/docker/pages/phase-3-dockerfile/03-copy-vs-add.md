---
title: "COPY versus ADD"
sidebar_label: "03 · COPY versus ADD"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the [Dockerfile reference — COPY](https://docs.docker.com/reference/dockerfile/#copy),
> [Dockerfile reference — ADD](https://docs.docker.com/reference/dockerfile/#add) and
> [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/).
> **No sandbox** — no console output on this page.

**Use `COPY`.** `ADD` does everything `COPY` does plus several things you almost
never want implicitly — and the ones you *do* want occasionally are better done
explicitly.

## What each can do

| | `COPY` | `ADD` |
|---|---|---|
| Local files and directories | ✅ | ✅ |
| **Auto-extract a local tar archive** | ❌ | ✅ |
| **Fetch a remote URL** | ❌ | ✅ (mode `600`; `--checksum` verifies SHA-256) |
| **Clone a git repository** | ❌ | ✅ (`#branch`, `#tag`, `#commit` fragments) |
| `--from=<stage>` | ✅ | ✅ |
| `--chown` / `--chmod` | ✅ | ✅ |

The rule that follows is the one Docker's own best-practices guidance gives:

> **`COPY` unless you specifically need one of `ADD`'s extra behaviours — and
> think twice even then.**

## Why the auto-extract is a trap

```dockerfile
ADD app.tar.gz /app/       # silently extracted
COPY app.tar.gz /app/      # copied as a file
```

The behaviour depends on the *file*, not on the instruction, so the same line
behaves differently for `app.tar.gz` and `app.zip` (zip is not extracted). A
reader cannot tell which happened without knowing the archive format. `COPY` plus
an explicit `RUN tar -xzf` says what it does.

## Why fetching a URL with `ADD` is worse than it looks

```dockerfile
# ❌ Fetched into its own layer; the archive ships even after extraction
ADD https://example.com/tool.tar.gz /tmp/
RUN tar -xzf /tmp/tool.tar.gz -C /opt && rm /tmp/tool.tar.gz

# ✅ Fetch, extract and clean in ONE layer - nothing left behind
RUN curl -fsSL https://example.com/tool.tar.gz | tar -xz -C /opt
```

The `ADD` version commits the downloaded archive as a layer; the later `rm` only
adds a whiteout ([Phase 2, page 04](../phase-2-images-and-registries/04-layers.md)).
The `RUN` version never writes it.

`ADD` does have one genuine advantage here — **`--checksum`** verifies a SHA-256
of the fetched file, which is a real integrity control:

```dockerfile
ADD --checksum=sha256:9f2c… https://example.com/tool.tar.gz /tmp/
```

If you need that verification and can accept the extra layer, `ADD` is
defensible. Otherwise fetch and verify inside a `RUN`.

## `COPY` in practice

```dockerfile
COPY package*.json ./                    # wildcards work
COPY --chown=node:node . /app            # ownership at copy time
COPY --chmod=755 entrypoint.sh /usr/local/bin/
COPY --from=build /app/dist ./dist       # from another stage
COPY --link /app /app                    # relaxed layer dependency (Phase 4)
```

`--chown` matters more than it looks. `COPY` writes as root by default, so an
image that runs as a non-root `USER` ends up unable to write into directories it
owns nothing in. `--chown` at copy time is cheaper than a `RUN chown -R`
afterwards, which copies every file into a new layer.

## Paths, context and the trailing slash

- **The source is relative to the build context**, and cannot escape it —
  `COPY ../secrets .` is an error by design.
- **A trailing `/` on the destination means "directory".** Without it, copying a
  single file to a non-existent path creates a *file* with that name. Get in the
  habit of the trailing slash.
- **Copying a directory copies its contents**, not the directory itself:
  `COPY src/ /app/` puts the *contents* of `src` into `/app`.

## The build context is why `.dockerignore` exists

Everything in the context is sent to the builder before the build starts, so
`COPY . .` in a repository with `.git`, `node_modules` and build output copies
all of it into a layer. That is page 08's subject, and it is the single most
common cause of an unexpectedly large image.

## Podman

Identical behaviour, including `--from`, `--chown` and `--chmod`. Coverage of the
newest `ADD` features (git-repository sources, `--checksum`) can lag behind
BuildKit; if one is unrecognised, that is a builder-version difference.

## Gotchas

**Symptom:** A `.tar.gz` was copied and mysteriously appeared unpacked.
**Cause:** `ADD` auto-extracts recognised local archive formats.
**Fix:** Use `COPY` plus an explicit `RUN tar`. Behaviour that depends on the
file extension is a readability problem even when it is what you wanted.

**Symptom:** The image contains a downloaded archive that was deleted.
**Cause:** `ADD <url>` committed it as a layer; the `rm` added a whiteout.
**Fix:** Fetch, extract and clean in a single `RUN`.

**Symptom:** A non-root process cannot write to a directory that `COPY` created.
**Cause:** `COPY` writes as root by default.
**Fix:** `COPY --chown=user:group`, rather than a `RUN chown -R` afterwards,
which duplicates every file into a new layer.

**Symptom:** `COPY ./config /etc/app/config` produced a file, not a directory.
**Cause:** No trailing slash on a destination that did not exist.
**Fix:** `COPY ./config/ /etc/app/config/`.

## Interview questions

**★ What is the difference between `COPY` and `ADD`, and which should you use?**
`COPY` copies local files. `ADD` also auto-extracts local tar archives, fetches
remote URLs and clones git repositories. Use `COPY`: `ADD`'s extras happen
implicitly and depend on the file, so a reader cannot tell what a line does.

**★ Why is `ADD <url>` usually worse than `RUN curl`?**
`ADD` commits the downloaded file as a layer, so it ships even if a later
instruction deletes it. `RUN curl … | tar -xz` fetches, extracts and discards
within one layer. `ADD --checksum` is the one genuine advantage, for integrity
verification.

**★ Why does a non-root container often fail to write to a copied directory?**
`COPY` writes as root by default. Use `--chown` at copy time; a `RUN chown -R`
afterwards works but duplicates every file into a new layer.

**What does a trailing slash on the destination change?**
It declares the destination a directory. Without it, copying a single file to a
path that does not exist creates a file with that name rather than a directory
containing it.

**Can `COPY` read files from outside the build context?**
No, by design — the context is the boundary. That is why secrets outside it
cannot be copied in, and why `RUN --mount=type=secret` exists for build-time
credentials.

---

← Prev: [RUN](02-run.md) · Index: [Phase 3](README.md) · Next → [WORKDIR](04-workdir.md)
