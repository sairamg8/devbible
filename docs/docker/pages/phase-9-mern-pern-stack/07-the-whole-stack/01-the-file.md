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
phase 8, and this topic is only about which one to reach for and why.** Read it
once end to end; this page then explains its *shape*, and the next two walk the
services.

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

🔴 **Six services, exactly one published port** — everything else talks over a
Compose network by service name.

## There is no `version:` at the top

There has not been one for years, and putting one back does not help. Compose
*"always uses the most recent schema to validate the Compose file, regardless of
the `version` field"*, and warns if it is present. 🔴 **Support for a key comes
from the binary you are running, never from a number in the file** — which is why
this page states a Compose version at the top and the file does not. `name:` is
the only top-level metadata worth writing.

## The `x-` block at the top

`migrate` and `api` are **the same image running a different command**, and they
need the same credentials. Repeating twenty lines is how the two drift apart, and
the drift is silent — the migration job connects to the old database long after
the API stopped.

```yaml
x-api-base: &api-base
  build:
    context: ./api
    target: production
  image: acme/api:local
  environment:
    PGHOST: db
    ...
```

Three phase-8 facts make that legal, and each is load-bearing:

- 🔴 **`x-` is the one prefix Compose ignores** instead of rejecting. Every other
  unrecognised key is an error — which is exactly why a typo elsewhere in this
  file is caught at `up` rather than at runtime.
- 🔴 **YAML merge (`<<`) applies to mappings only, never to sequences.** That is
  the reason `environment` is written in `KEY: value` map form throughout this
  file, and the reason `networks:` is left *out* of the anchor: `api` needs two
  networks and `migrate` needs one, and a merged sequence would not have given
  either.
- For reuse *inside one file*, anchors beat
  [`extends`](../../phase-8-compose/16-include-and-extends.md), which shares
  configuration but **does not import referenced resources** — `secrets`,
  `volumes` and `depends_on` would all need re-declaring.

⚠️ **`image:` alongside `build:` is not "pull instead of build".** It names what
the build produces. That is what lets `migrate` and `api` share one image without
building it twice, and it is what makes the image pushable later.

## Where each service is explained

- **[02 · The wiring](02-the-wiring.md)** — ports and the three top-level blocks: one published port, the segmentation that costs four lines, why a volume is declared twice.
- **[03 · The stateful services](03-the-stateful-services.md)** — `db`, `cache`, `migrate`: volume paths, `_FILE`, healthchecks that tell the truth, and the migration gate.
- **[04 · The API and the frontend](04-the-api-and-the-frontend.md)** — `api` and `web`: readiness versus liveness, and why the frontend's API URL is a build-time problem.
- **[05 · The proxy and the boot](05-the-proxy-and-the-boot.md)** — `proxy`: the nginx template, the DNS trap, then the boot order end to end and how to prove the stack actually works.

## Gotchas

**Symptom:** A variable in a healthcheck or a command arrives empty.
**Cause:** A single `$` in a Compose file is *interpolation*. Compose expanded
`$POSTGRES_USER` against the environment `docker compose` was run in — where it
does not exist — and passed the empty result into the container.
**Fix:** `$$` for a literal dollar. The same rule bites bcrypt hashes, crontabs,
any password containing `$`, and the `NGINX_ENVSUBST_FILTER` regex in this file,
whose trailing `$$` is a regex anchor and not a Compose variable.

**Symptom:** An override file was supposed to replace `environment`, and instead
the variable appears twice.
**Cause:** `environment` was written as a **list**. Compose merges mappings by
key but **concatenates sequences**, so a list-form override appends.
**Fix:** Write `environment` as a mapping everywhere — which is also what makes
the `<<: *api-base` merge work at all, since YAML merge ignores sequences.

**Symptom:** The anchor was merged into `api`, but the service came up on the
wrong network — or on none.
**Cause:** `networks:` was put inside the `x-` block. YAML merge keys operate on
mappings; `networks: [edge, backend]` is a **sequence**, so the merge either drops
it or the service's own key replaces it wholesale, with no warning either way.
**Fix:** Keep sequences out of anchors you intend to merge. Networks, `ports` and
`depends_on` conditions differ per service anyway — the anchor is for the parts
that genuinely must be identical.

**Symptom:** Compose rejects the file with an error about an unrecognised key, on
a block that was added deliberately.
**Cause:** Only the `x-` prefix is ignored. Every other top-level or service-level
key Compose does not recognise is an error — there is no "extra data is fine"
mode.
**Fix:** Prefix shared fragments with `x-`. The strictness is a feature: it is the
same rule that catches `enviroment:` at `up` instead of at three in the morning.

## Interview questions

**★ Why is there no `version:` key, and what would adding one do?**
Nothing useful. Compose always validates against the most recent schema regardless
of the field and warns when it is present. The mental correction it forces is the
important part: whether `develop.watch` or `start_interval` works is decided by the
Compose binary on the machine, not by a number in the file — so "bump the version
to get feature X" is never the fix, and pinning a Compose version in CI is.

**★ What is the `x-api-base` block, and why is it not a service?**
It is an extension field. `x-` is the single prefix Compose ignores rather than
rejecting, so the block is legal, and the YAML anchor on it lets `api` and
`migrate` merge one definition instead of repeating it — which matters because
the two are the same image with different commands and would otherwise drift
apart silently. Anchors are the right tool *within* one file; `extends` is for
across files and does not import referenced resources such as secrets or
`depends_on`.

**★ What does `image:` mean when the service also has `build:`?**
It names the image the build produces — it is not "pull this instead". That is
what lets `api` and `migrate` share one built image without building it twice, and
it is what makes the result pushable to a registry later. Whether the build runs
at all is governed by `pull_policy`, whose value `build` forces a build and whose
time-based values (`daily`, `weekly`, `every_<duration>`) are the sane middle
ground given Docker Hub's pull limits.

**Why is `environment` written as a mapping rather than a list?**
Because YAML merge keys and Compose's own merge rules both distinguish mappings
from sequences: mappings merge by key, sequences **concatenate**. As a list,
`environment` in an override file would append rather than replace and the same
variable would appear twice; and the `<<: *api-base` anchor would not merge it at
all, since YAML merge applies to mappings only.

**When do you need `$$` in a Compose file?**
Whenever a literal dollar sign has to survive interpolation — a bcrypt hash, a
crontab, a password containing `$`, a regex anchor, or a shell variable you want
expanded **inside the container** rather than by Compose on the host. A single `$`
is Compose's own syntax, and an undefined variable interpolates to the empty
string rather than failing, so the mistake is silent. `${VAR:?message}` is the
opposite habit worth having: it fails at `up` with your own error text.

**Why is `PGPORT: "5432"` quoted when it is obviously a number?**
Habit, and the habit is cheap. YAML has enough type inference to hurt you —
`"8000:8000"` must be quoted *"to avoid conflicts with YAML base-60 float"*, and
boolean-looking environment values *"should be enclosed in quotes to ensure they
are not converted to True or False"*. Environment values reach the container as
strings regardless, so quoting them all costs nothing and removes a category of
surprise; `restart: "no"` is the case where forgetting it silently changes
behaviour.

---

← Overview: [The whole stack in one file](README.md) · Index: [Phase 9](../README.md) · Next → [Networks, volumes and secrets](02-networks-volumes-secrets.md)
