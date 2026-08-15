---
title: "Secrets in dev vs prod"
sidebar_label: "06 · Secrets dev vs prod"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Docker — Use secrets in Compose](https://docs.docker.com/compose/how-tos/use-secrets/),
> [the Compose `secrets` top-level element](https://docs.docker.com/reference/compose-file/secrets/),
> [Compose environment-variable precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/),
> [`RUN --mount=type=secret`](https://docs.docker.com/reference/dockerfile/) and
> [`podman-run(1)` `--secret`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**`.env` is a convenience, not a secret store — and the difference only starts to
matter at the exact moment nobody is thinking about it.** The useful framing is
not "dev insecure, prod secure"; it is knowing which of four mechanisms you are
using and what each one leaks.

## The four places a value can come from

| Mechanism | Where it ends up | Leaks via |
|---|---|---|
| **Build `ARG`** | ⛔ **baked into the image** | `docker history`, anyone who pulls the image |
| **`environment:` / `env_file:`** | the process environment | `inspect`, `ps -e` inside the container, crash dumps, logs, child processes |
| **Compose `secrets:`** | a **file** at `/run/secrets/<name>` | filesystem access inside that one container |
| **A secret manager** | fetched at run time, never at rest | its own access model |

🔴 **Only the first is unrecoverable.** A value in a layer is published with the
image and *rebuilding does not unpublish it* — the response is always to **rotate
the credential**, never to rebuild and hope. `ARG` is visible in `docker history`
by design ([Phase 3 · `ENV` versus `ARG`](../phase-3-dockerfile/07-env-vs-arg.md)).

## Why the environment is not a secret store

Docker's own secrets guide is blunt about it: environment variables are *"often
available to all processes"* and *"can be printed in logs when debugging errors
without your knowledge"*. Both halves matter — every child process inherits them,
and the usual "dump the config on startup error" habit writes them to a log
somebody else can read.

That does not make `environment:` wrong for development. It makes it a *known*
trade-off, and the tell that you have crossed a line is when the same mechanism is
still carrying the value in production.

## Compose secrets

```yaml
services:
  api:
    build: .
    environment:
      DATABASE_URL_FILE: /run/secrets/db_url   # the app reads the FILE
    secrets:
      - db_url

secrets:
  db_url:
    file: ./secrets/db_url.txt        # a file on the host, gitignored
  api_key:
    environment: API_KEY              # from an env var at deployment time
```

The documented behaviour, precisely:

- **"Secrets are mounted as a file in `/run/secrets/<secret_name>` inside the
  container."**
- **Two sources:** `file:` reads it from a path; `environment:` takes it from an
  environment variable at deployment time.
- **A service only gets the secrets it lists**, which is *"granular access control
  within a service container via standard filesystem permissions"* rather than the
  blanket availability of the environment.
- ⚠️ **"Secrets are supported on Linux containers only"** — delivery is a
  bind-mount of a single file, and Windows containers can only bind-mount
  directories.

🔴 **This works with a plain `docker compose up`.** The thing people confuse it
with — **`docker secret`** — is **Swarm-only**, which is why "you need Swarm for
secrets" is a persistent and wrong piece of folklore.

**The application has to cooperate.** The `_FILE` convention above — an
environment variable naming a *path* rather than holding a value — is what many
official images already support, and it is trivial to add:

```js
import { readFileSync } from 'node:fs'

const fromFileOrEnv = (name) => {
  const path = process.env[`${name}_FILE`]
  return path ? readFileSync(path, 'utf8').trim() : process.env[name]
}

export const DATABASE_URL = fromFileOrEnv('DATABASE_URL')
```

That one helper is what lets a single image run with `environment:` in
development and `secrets:` in production **without a code change** — which is the
whole point of topic 02's "one image, configuration at run time".

## The three environment mechanisms, again

Because this is where secrets actually go wrong in practice
([Phase 8 · Environment and interpolation](../phase-8-compose/10-environment-and-interpolation.md)):

| | Fills | Reaches the container? |
|---|---|---|
| the project `.env` | `${...}` **in the compose file** | ⛔ **no** — not by itself |
| `env_file:` | the **container's** environment | ✅ yes |
| `environment:` | the **container's** environment | ✅ yes |

The bare-name list entry — `environment: [FOO]`, passing the ambient value
through — is what makes `.env` *look* like it feeds containers, and it is why
"remove it from `.env`" is not the same as "remove it from the container".

⚠️ **`docker compose config` prints resolved secrets and interpolated values.**
It is a debugging command, not something to paste into a ticket
([Phase 8 · Day-to-day commands](../phase-8-compose/14-day-to-day-commands/02-getting-inside.md)).

## Build-time secrets

Sometimes the *build* needs a credential — a private registry token, a licensed
package. Never `ARG`:

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --omit=dev
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc .
```

The mount exists **only for that `RUN`** and is not committed to any layer
([Phase 4 · `RUN --mount=type=secret`](../phase-4-build-strategy/05-mount-type-secret.md)).
Compose exposes the same through `build.secrets`.

## Podman

`podman run --secret` defaults to `type=mount`, placing the secret at
`/run/secrets/<name>` — the same path, so applications port cleanly. Two
differences worth knowing:

- ⚠️ **The default mode is `0444`** — world-readable *inside* the container. If
  the container runs more than one user, set `mode=`, and `uid=`/`gid=` to match
  the process.
- `type=env` exists and delivers the secret as an environment variable, which
  re-introduces exactly the exposure the file form avoids. Use it only when an
  application cannot read a file.

Compose-level `secrets:` are handled by the compose provider
([Phase 8 · `podman compose`](../phase-8-compose/15-podman-compose.md)).

## What changes between dev and prod

| | Development | Production |
|---|---|---|
| Source | `.env` and `environment:`, committed to nothing | a secret manager, or injected `secrets:` |
| Values | obviously fake — `devonly`, `postgres` | real, rotated, never seen by a developer |
| Blast radius | your laptop | everything |
| The image | **the same image** | **the same image** |

🔴 **The image must not change.** If shipping to production needs a rebuild to
change a credential, that credential was baked in at build time — which is the
failure this whole page exists to prevent.

**Make development values obviously fake.** A `POSTGRES_PASSWORD: devonly` in a
committed compose file is fine and is *better* than a realistic-looking one,
because nobody will ever mistake it for a real credential or be tempted to reuse
it.

## Gotchas

**Symptom:** A credential is in a published image.
**Cause:** It was passed as a build `ARG`, or copied in with `COPY . .` because
`.env` was not in `.dockerignore`.
**Fix:** **Rotate the credential** — rebuilding does not unpublish a layer. Then
switch to `RUN --mount=type=secret` for build-time needs and run-time delivery for
everything else.

**Symptom:** "We need Swarm to use secrets."
**Cause:** Confusing `docker secret` (Swarm-only) with Compose's `secrets:`
element, which works with a plain `docker compose up`.
**Fix:** Use the Compose top-level `secrets:` with a `file:` or `environment:`
source.

**Symptom:** The secret is mounted and the application does not see it.
**Cause:** It is a *file* at `/run/secrets/<name>`, not an environment variable.
**Fix:** Read the file — the `_FILE` convention keeps one image working with both
delivery mechanisms.

**Symptom:** A password appears in an error report.
**Cause:** Environment variables are inherited by every child process and are
routinely dumped by "print the config on failure" error handlers — the
documentation warns they *"can be printed in logs when debugging errors without
your knowledge"*.
**Fix:** Deliver secrets as files, and redact by allowlist rather than by
blocklist when logging configuration.

## Interview questions

**★ Why is an environment variable a bad place for a production secret?**
Because it is broadly readable and easily copied out by accident: it is inherited
by every child process, visible to anything that can inspect the container, and —
in Docker's own words — *"can be printed in logs when debugging errors without
your knowledge"*. A Compose secret is mounted as a file at
`/run/secrets/<name>`, visible only to the services that list it, with ordinary
filesystem permissions controlling access.

**★ Someone passed an API key as a build `ARG`. What now?**
Rotate the key. `ARG` values are visible in `docker history`, the value is in a
published layer, and rebuilding the image does not unpublish what was already
pushed or pulled. Once it is rotated, move build-time credentials to
`RUN --mount=type=secret`, which exists only for that instruction and is not
committed to any layer.

**★ How do you use the same image in development and production with different
secrets?**
Deliver configuration at run time and have the application accept either form —
the `_FILE` convention, where an environment variable names a path and the code
falls back to the plain variable. Development supplies obviously fake values
through `environment:`; production mounts real ones as Compose secrets or injects
them from a secret manager. The image is byte-identical, which is what makes "the
image you tested is the image you deployed" true.

**What is the difference between `.env`, `env_file:` and `environment:`?**
The project `.env` fills `${...}` placeholders **in the compose file** and reaches
no container by itself. `env_file:` and `environment:` both put variables **into
the container**. Conflating them is the commonest environment bug, and it matters
for secrets because removing a value from `.env` does not remove it from a
container that gets it through a bare-name passthrough.

**Do Compose secrets need Swarm?**
No. `docker secret` is the Swarm command; the Compose top-level `secrets:` element
works with plain `docker compose up`, sourcing from a file or an environment
variable and mounting the result at `/run/secrets/<name>`. The one real limitation
is that secrets are supported on Linux containers only, because delivery is a
single-file bind mount.

---

← Prev: [Hot reload inside a container](05-hot-reload/README.md) · Index: [Phase 9](README.md) · Next → **The whole stack in one file** *(not written yet)*
