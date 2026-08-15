---
title: "RUN --mount=type=secret"
sidebar_label: "05 · RUN --mount=type=secret"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Docker — build secrets](https://docs.docker.com/build/building/secrets/),
> [Docker — build cache invalidation](https://docs.docker.com/build/cache/invalidation/),
> [`docker buildx build`](https://docs.docker.com/reference/cli/docker/buildx/build/) and
> [`podman-build(1)`](https://docs.podman.io/en/latest/markdown/podman-build.1.html).
> **No sandbox** — no console output on this page.

**A secret mount makes a value readable for the duration of one `RUN` and
present in no layer of the resulting image.** It is the correct answer to
"my build needs a private registry token", and it exists because every other
answer leaks.

## Why the obvious approaches fail

The documentation says it in one line:

> "Build arguments and environment variables are inappropriate for passing
> secrets to your build, because they persist in the final image."

Concretely, the three failing approaches, in order of how often they are tried:

| Approach | How it leaks |
|---|---|
| `ARG NPM_TOKEN` + `--build-arg` | The value is recorded in the image config and shows in `docker history` |
| `ENV NPM_TOKEN=…` | Worse — it is in the image *and* in every container's environment |
| `COPY .npmrc` then `RUN rm .npmrc` | The file is in the earlier layer; deleting it later hides nothing |

All three end the same way, and the consequence is the one Phase 2 established
and Phase 3 repeated: **rotate it — rebuilding does not unpublish.** Once a
credential has been in a pushed image, the only remediation is a new credential
([Phase 3 · ENV versus ARG](../phase-3-dockerfile/07-env-vs-arg.md)).

## The mechanism

The secret is mounted into the build container's filesystem for exactly one
instruction. It is a mount, not a layer — when the `RUN` finishes, the mount goes
away and nothing about it is committed.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./

RUN --mount=type=secret,id=npmtoken \
    NPM_TOKEN="$(cat /run/secrets/npmtoken)" npm ci
```

```bash
docker build --secret id=npmtoken,src=$HOME/.npm-token .
```

The default mount point is **`/run/secrets/<id>`**. The `id` is what ties the
`--mount` in the Dockerfile to the `--secret` on the command line; they must
match.

## The options

| Option | What it does |
|---|---|
| `id` | The identifier that matches the CLI `--secret id=…` |
| `target` | A custom path instead of `/run/secrets/<id>` |
| `env` | Mount the secret as an **environment variable** rather than a file |
| `required` | Fail the build if the secret was not supplied |
| `mode`, `uid`, `gid` | Permissions and ownership of the mounted file |

`env` is the ergonomic one for tools that read a variable rather than a file,
and it keeps the value out of the image just the same — the variable exists only
inside that `RUN`:

```dockerfile
RUN --mount=type=secret,id=npmtoken,env=NPM_TOKEN \
    npm ci
```

On the command line, the value can come from a file or from your own
environment:

```bash
docker build --secret id=npmtoken,src=/path/to/token .   # from a file
docker build --secret id=npmtoken,env=NPM_TOKEN .        # from your shell
```

`required` is worth adding to anything non-optional. Without it, a missing
secret produces an empty file and a confusing downstream failure — an
authentication error rather than "you forgot the secret".

## SSH, for private git dependencies

A related mount forwards your agent rather than a value, which is what a
`git+ssh://` dependency needs:

```dockerfile
RUN --mount=type=ssh \
    npm ci
```

```bash
docker buildx build --ssh default .
```

`default` uses `$SSH_AUTH_SOCK`. The key itself never enters the build — the
agent stays on your machine and only the signing operation crosses.

## The cache interaction, and it is a trap

From the invalidation reference:

> "The contents of build secrets are not part of the build cache."

So rotating a token does **not** cause the `RUN` that consumes it to re-execute.
The build reuses the cached layer, and if that layer captured something derived
from the old secret, the new one is never used. The secret's *id and mount path
do* participate, so changing those invalidates — the value does not.

When a changed value must take effect, change something that is part of the key
alongside it:

```dockerfile
FROM alpine
ARG CACHEBUST
RUN --mount=type=secret,id=TOKEN,env=TOKEN \
    some-command ...
```

```bash
TOKEN="tkn_pat123456" docker build --secret id=TOKEN --build-arg CACHEBUST=1 .
```

This is a deliberate design: it means a rotated credential does not needlessly
invalidate every build. It also means you must think about it once, rather than
assuming.

## What it does not protect against

**The `RUN` can still leak it.** A command that echoes the token, writes it into
a config file that survives the instruction, or bakes it into a compiled artefact
puts it back in a layer. The mount protects the *transport*, not what your
command does with the value.

**Build logs are not secrets.** A verbose tool printing its credentials puts them
in CI output, which is often retained longer than the image.

**It is a build-time mechanism only.** Runtime secrets are a separate problem
with separate answers — Compose secrets, an orchestrator's secret store, or a
mounted file. Do not reach for `--mount=type=secret` to give a *running*
container a value.

## Podman

Supported, with the same Dockerfile syntax and a compatible CLI flag:

> `--secret=id=id[,src=envOrFile][,env=ENV][,type=file | env]` — "pass secret
> information to be used in the Containerfile for building images in a safe way
> that will not end up stored in the final image", mounted "in the container at
> `/run/secrets/id` by default".

`podman build --ssh=default` covers the agent case in the same way. Two practical
notes: Podman spells the source with `src=` reading "from an environment variable
or file", and the mount path can be overridden "using the 'target', 'dst', or
'destination' option of the `RUN --mount` flag" — `dst` and `destination` are
Podman-side spellings you will not see in Docker's documentation.

## Gotchas

**Symptom:** `docker history` shows a token that was passed with `--build-arg`.
**Cause:** Build arguments persist in the image configuration.
**Fix:** Rotate the credential — the image was published with it — then switch to
`--mount=type=secret`.

**Symptom:** The build fails with an authentication error and no mention of a
missing secret.
**Cause:** The `--secret` was not passed, so the mount produced an empty file and
the tool tried to authenticate with nothing.
**Fix:** Add `required` to the mount so the build fails with the real reason.

**Symptom:** A rotated token is not being used; the build still authenticates as
the old identity.
**Cause:** Secret contents are not part of the cache key, so the `RUN` was a cache
hit and never re-executed.
**Fix:** Pair it with a changing build argument, or `--no-cache-filter` that
stage.

**Symptom:** The secret is mounted correctly but still ends up in the image.
**Cause:** The command wrote it somewhere that survives the instruction — an
`.npmrc`, a config file, a compiled bundle.
**Fix:** Consume the value in-line and write nothing derived from it. Check the
final image before concluding the mount did its job.

## Interview questions

**★ Why is `--build-arg` the wrong way to pass a token to a build?**
Because build arguments persist in the image configuration and are visible in
`docker history`. Anyone who can pull the image can read it — and rebuilding
does not unpublish, so a leaked credential must be rotated.

**★ What does `RUN --mount=type=secret` actually do?**
It mounts the value into the build container for the duration of that single
`RUN`, at `/run/secrets/<id>` by default or as an environment variable with
`env=`. The mount is not committed, so the value is in no layer of the resulting
image.

**★ You rotated the token and the build still uses the old one. Why?**
Secret contents are not part of the build cache, so the `RUN` matched its cached
layer and did not re-run. The secret's id and mount path do participate; the
value does not. Force the miss with a changing build argument or
`--no-cache-filter`.

**How do you install a private git dependency during a build?**
`RUN --mount=type=ssh` with `docker buildx build --ssh default`, which forwards
the SSH agent socket. The key stays on the host; only the signing operation
crosses into the build.

**Does the secret mount protect against every leak?**
No. It protects transport into the build. If the command echoes the value, writes
it to a file that persists, or embeds it in an artefact, it is back in a layer —
and verbose build logs are their own exposure.

**Does Podman support this?**
Yes — the same `RUN --mount=type=secret` syntax and a `--secret
id=…[,src=…][,env=…][,type=file|env]` flag, mounted at `/run/secrets/id` by
default, plus `--ssh` for the agent case.

---

← Prev: [Multi-stage builds](04-multi-stage-builds.md) · Index: [Phase 4](README.md) · Next → [`--target` to stop at a stage](06-target.md)
