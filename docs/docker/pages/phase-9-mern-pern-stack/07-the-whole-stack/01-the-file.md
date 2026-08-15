---
title: "The file and its shape"
sidebar_label: "01 · The file"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the Compose file reference](https://docs.docker.com/reference/compose-file/),
> [the `services` top-level element](https://docs.docker.com/reference/compose-file/services/),
> [version and name](https://docs.docker.com/reference/compose-file/version-and-name/),
> [fragments and extensions](https://docs.docker.com/reference/compose-file/fragments/) and
> [Compose interpolation](https://docs.docker.com/reference/compose-file/interpolation/).
> **No sandbox** — no console output on this page.

**Here is the whole file. Nothing in it is new — every attribute was argued in
phase 8; this topic is only about which one to reach for, and why.** Read it end
to end; this page explains its shape, and the rest walk it.

## The stack

| Service | Image | Job | Reachable from |
|---|---|---|---|
| `proxy` | `nginx` | the **single origin** — one host port, `/api/` to the API and everything else to the frontend | the host |
| `web` | built here | the frontend — a static build in production, a dev server in development | `proxy` |
| `api` | built here | the Node/Express API | `proxy` |
| `migrate` | **the API's image** | a one-shot job that runs migrations and exits | — |
| `db` | `postgres:18` | PostgreSQL | `api`, `migrate` |
| `cache` | `redis` | Redis | `api` |

## The file

```yaml
name: acme

x-api-base: &api-base
  build:
    context: ./api
    target: production
  image: acme/api:local
  environment:
    NODE_ENV: production
    PGHOST: db
    PGPORT: "5432"
    PGUSER: acme
    PGDATABASE: acme
    DATABASE_PASSWORD_FILE: /run/secrets/db_password
    REDIS_URL: redis://cache:6379
  secrets:
    - db_password

services:
  proxy:
    image: nginx:1.29-alpine
    environment:
      API_UPSTREAM: api:3000
      WEB_UPSTREAM: web:80
      NGINX_ENVSUBST_FILTER: "^(API|WEB)_UPSTREAM$$"
    volumes:
      - ./proxy/default.conf.template:/etc/nginx/templates/default.conf.template:ro
    ports:
      - "127.0.0.1:8080:80"
    depends_on:
      api:
        condition: service_healthy
      web:
        condition: service_started
    networks: [edge]
    restart: unless-stopped

  web:
    build:
      context: ./web
      target: runtime
      args:
        VITE_API_URL: /api
    image: acme/web:local
    networks: [edge]
    restart: unless-stopped

  api:
    <<: *api-base
    depends_on:
      migrate:
        condition: service_completed_successfully
      db:
        condition: service_healthy
      cache:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "/app/healthcheck.mjs"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 30s
      start_interval: 2s
    networks: [edge, backend]
    restart: unless-stopped

  migrate:
    <<: *api-base
    command: ["node", "dist/migrate.js"]
    depends_on:
      db:
        condition: service_healthy
    networks: [backend]
    restart: "no"

  db:
    image: postgres:18
    environment:
      POSTGRES_USER: acme
      POSTGRES_DB: acme
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - db-data:/var/lib/postgresql
      - ./db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
      start_interval: 2s
    networks: [backend]
    restart: unless-stopped

  cache:
    image: redis:8-alpine
    command: ["redis-server", "--save", "60", "1"]
    volumes:
      - cache-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [backend]
    restart: unless-stopped

networks:
  edge:
  backend:
    internal: true

volumes:
  db-data:
  cache-data:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

🔴 **Six services and exactly one published port.** Everything else talks over a
Compose network by service name. That is the shape you are aiming at, and most of
the decisions in this topic follow from it.

## There is no `version:` at the top

There has not been one for years, and putting one back does not help. Compose
*"always uses the most recent schema to validate the Compose file, regardless of
the `version` field"*, and warns if it is present. 🔴 **Support for a key comes
from the binary you are running, never from a number in the file** — which is why
this page states a Compose version at the top and the file does not. `name:` is
the only top-level metadata worth writing.

## Where each chunk goes

- **[02 · The anchor](02-the-anchor.md)** — the `x-` extension field and the YAML merge key that keep `api` and `migrate` from drifting apart, and why `environment` is a mapping everywhere.
- **[03 · The wiring](03-the-wiring.md)** — ports and the three top-level blocks: one published port, the segmentation that costs four lines, why a volume is declared twice.
- **[04 · The stateful services](04-the-stateful-services.md)** — `db`, `cache`, `migrate`: volume paths, `_FILE`, healthchecks that tell the truth, and the migration gate.
- **[05 · The API and the frontend](05-the-api-and-the-frontend.md)** — `api` and `web`: readiness versus liveness, and why the frontend's API URL is a build-time problem.
- **[06 · The proxy](06-the-proxy.md)** — `proxy`: what the nginx image already does, the template mechanism, and the DNS trap that turns every API rebuild into a 502.
- **[07 · The boot, and proving it](07-the-boot-and-proving-it.md)** — the startup order end to end, and the three checks that show the stack works on a machine that is not yours.

## Gotchas

**Symptom:** A variable in a healthcheck or a command arrives empty.
**Cause:** A single `$` in a Compose file is *interpolation*. Compose expanded
`$POSTGRES_USER` against the environment `docker compose` was run in — where it
does not exist — and passed the empty result into the container.
**Fix:** `$$` for a literal dollar. The same rule bites bcrypt hashes, crontabs,
any password containing `$`, and the `NGINX_ENVSUBST_FILTER` regex in this file,
whose trailing `$$` is a regex anchor and not a Compose variable.

**Symptom:** A missing environment variable produces a confusing failure an hour
into the stack's life rather than an error at `up`.
**Cause:** Interpolation of an unset variable yields the **empty string**, not an
error. Compose starts happily with `PGHOST=` and the application fails later.
**Fix:** `${VAR:?message}` for anything genuinely required — it stops `up`
immediately with your own text. `${VAR:-default}` for anything that has a sane
fallback. The colon is the whole distinction between "set and non-empty" and
merely "set".

**Symptom:** The migration job restarts forever, or a port mapping is rejected as
invalid.
**Cause:** YAML type inference. Unquoted, `no` is the boolean `false`, so
`restart: no` does not mean what it reads as; and `"8000:8000"` must be quoted
*"to avoid conflicts with YAML base-60 float"*.
**Fix:** Quote `restart: "no"`, quote every port mapping, and quote
boolean-looking environment values — the documentation asks for the last of these
*"to ensure they are not converted to True or False"*.

**Symptom:** `docker compose up` in a subdirectory picks up a file you did not
expect — or reports no configuration file at all.
**Cause:** With no `-f`, Compose searches the working directory **and its
parents**, and prefers the canonical `compose.yaml` when both it and
`docker-compose.yaml` exist.
**Fix:** Know which file was chosen before debugging its contents —
`docker compose config` prints the resolved result, and `--project-directory`
controls what relative paths inside it resolve against.

## Interview questions

**★ Why is there no `version:` key, and what would adding one do?**
Nothing useful. Compose always validates against the most recent schema regardless
of the field and warns when it is present. The mental correction it forces is the
important part: whether `develop.watch` or `start_interval` works is decided by the
Compose binary on the machine, not by a number in the file — so "bump the version
to get feature X" is never the fix, and pinning a Compose version in CI is.

**★ Why is so much of this file quoted when the values are obviously strings or
numbers?**
Because YAML's type inference is the source of two silent bugs. `restart: no`
unquoted is the boolean `false`, so the key stops meaning "never restart" — and a
one-shot migration job then restarts forever. A port mapping must be quoted *"to
avoid conflicts with YAML base-60 float"*, and boolean-looking environment values
should be quoted *"to ensure they are not converted to True or False"*. Quoting
costs nothing because environment values reach the container as strings anyway, so
the cheap habit is to quote all of them.

**★ What does the top-level `name:` actually change?**
It sets the project name, which prefixes Compose's resources — `acme_db-data`,
`acme_edge`, the container names — so two checkouts of the same project do not
share a database. It is the lowest-precedence way to set one, below `-p` and
`COMPOSE_PROJECT_NAME`, so it acts as a default rather than a lock. It does **not**
namespace host ports: two projects publishing the same host port still collide,
because the host has never heard of a Compose project.

**When do you need `$$` in a Compose file?**
Whenever a literal dollar sign has to survive interpolation — a bcrypt hash, a
crontab, a password containing `$`, a regex anchor, or a shell variable you want
expanded **inside the container** rather than by Compose on the host. A single `$`
is Compose's own syntax, and an undefined variable interpolates to the empty
string rather than failing, so the mistake is silent.

**What is `${VAR:?message}` for?**
Failing fast, in your own words. Because an unset variable interpolates to an empty
string, a missing value normally becomes a confusing error much later; the `:?`
form stops `up` immediately with the message you wrote. It is the cheapest
documentation a project has, and it pairs with `${VAR:-default}` for the values
that genuinely have a fallback — the colon distinguishing "set and non-empty" from
merely "set".

**How does Compose decide which file it is reading?**
With no `-f`, it searches the working directory and then its parents, and prefers
the canonical `compose.yaml` where both that and `docker-compose.yaml` exist —
which means running `up` from a subdirectory can quietly pick up a parent
project's file. `--project-directory` is what relative paths resolve against, and
`docker compose config` is how you confirm which file and which values actually
won before debugging anything else.

---

← Overview: [The whole stack in one file](README.md) · Index: [Phase 9](../README.md) · Next → [The anchor](02-the-anchor.md)
