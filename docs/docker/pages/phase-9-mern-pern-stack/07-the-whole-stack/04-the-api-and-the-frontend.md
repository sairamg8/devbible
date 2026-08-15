---
title: "The API and the frontend"
sidebar_label: "04 · The API and the frontend"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `healthcheck` attribute](https://docs.docker.com/reference/compose-file/services/#healthcheck),
> [the `depends_on` attribute](https://docs.docker.com/reference/compose-file/services/#depends_on),
> [the Dockerfile `HEALTHCHECK` reference](https://docs.docker.com/reference/dockerfile/#healthcheck),
> [the `build` section](https://docs.docker.com/reference/compose-file/build/) and
> [the Vite server options](https://vite.dev/config/server-options).
> **No sandbox** — no console output on this page.

**The two services you wrote yourself are the two the file says least about — and
that is the goal.** Everything specific to this application lives in its
Dockerfile and its code; the Compose entries are about *when* it is allowed to
start and *what* it is allowed to reach.

## `api`

```yaml
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
```

### The healthcheck, line by line

- **`CMD`, not `CMD-SHELL`, and not a bare string.** `CMD` execs the argument
  vector directly, so there is no shell to mis-quote. The classic permanent
  failure is one string with spaces inside a `CMD` list — it is looked up as a
  single executable name and can never succeed.
- **The runtime is already in the image.** Installing `curl` into a production
  image so it can check its own health adds a package you now have to patch, in
  the layer you were trying to keep small. `node` is right there.
- 🔴 **`start_period` plus `start_interval` removes the usual trade-off.** A
  generous 30-second grace window, probed every **two seconds inside it**, means a
  fast boot is detected in seconds and a slow one is not marked failed. Without
  `start_interval` the same generosity costs a 30-second wait on every single `up`
  ([Phase 8 · Healthchecks](../../phase-8-compose/06-healthchecks/README.md)).
- **`interval: 30s`, `timeout: 3s`, `retries: 3`** are the Dockerfile defaults for
  interval and retries, with the timeout cut hard. The documented default timeout
  is **30s**, which combined with three retries means roughly **90 seconds** of a
  wedged service still reporting healthy. Three seconds is a truer number for an
  in-process HTTP check.

The script is three lines and belongs in the repository, not in the YAML:

```js
// api/healthcheck.mjs
const res = await fetch('http://127.0.0.1:3000/readyz').catch(() => null)
process.exit(res && res.ok ? 0 : 1)
```

⚠️ **It hits `/readyz`, not `/healthz`.** That split is
[topic 04](../04-waiting-for-the-database/02-surviving-a-restart.md)'s argument:
liveness answers *is this process wedged*, readiness answers *should traffic come
here*. An endpoint that returns 200 whenever the event loop turns is the lie that
keeps a database-less API in rotation.

⚠️ **And do not check the database from inside it.** A healthcheck that queries
Postgres turns one database blip into every replica marked unhealthy at the same
moment. `/readyz` should report the state the process already knows — whether its
pool has a working connection — not go and find out.

### `depends_on` gets the first boot right, and nothing else

Three conditions, three different meanings:

| Service | Condition | Waits for |
|---|---|---|
| `migrate` | `service_completed_successfully` | exit code 0 |
| `db` | `service_healthy` | the healthcheck to pass |
| `cache` | `service_healthy` | `redis-cli ping` to answer |

🔴 **All of it is startup-only.** The documentation is clear that `depends_on`
expresses creation, start and removal order — it has **no runtime effect
whatever**. The database restarting at three in the morning re-orders nothing, and
Compose will not restart the API for it.

Which is why the file is only half the answer. The other half is in the
application: an error listener on the pool, a connection timeout, and jittered
capped backoff on reconnect ([topic 04](../04-waiting-for-the-database/README.md)).
🔴 **The single most valuable line of that half:** node-postgres documents that if
a pool *"emits an `error` event and no listeners are added node will emit an
uncaught error and potentially crash your node process"* — so three lines of
`pool.on('error', …)` are what stop a database restart from taking the API down.

Get the application half right and `depends_on` becomes a nicety that makes the
first boot tidy. Get only the Compose half right and you have a stack that works
until the first restart.

### Two networks, and what that means

`api` is the only service on both `edge` and `backend`, which makes it the single
path from the proxy to the data. It also means the API is the only place where a
mistake in configuration can expose the database — a small enough surface to
review by reading one service block.

## `web`

```yaml
  web:
    build:
      context: ./web
      target: runtime
      args:
        VITE_API_URL: /api
    image: acme/web:local
    networks: [edge]
    restart: unless-stopped
```

In production this service is a multi-stage build whose final `runtime` stage is
an nginx serving `dist/` — a static file server, nothing more. In development the
override swaps `target:` for the dev-server stage
([topic 02](../02-dev-vs-prod-image.md)).

### The API URL is a build-time problem

```yaml
      args:
        VITE_API_URL: /api
```

⚠️ **A `VITE_*` variable is baked into the bundle by the build.** It is not
configuration the container reads at startup, and no amount of `environment:` will
change it afterwards — the JavaScript that reaches the browser already has the
value in it. This is the one place in the whole stack where the "configure at run
time" rule genuinely cannot apply, and it surprises people every time
([topic 12](../12-react-vite-frontend.md)).

🔴 **Which is the real argument for `/api` rather than `http://localhost:3000`.**
A relative path needs no configuration at all: the browser sends it to whatever
origin served the page, the proxy routes it, and the same bundle works on a
laptop, in CI and in production. It also deletes CORS from the project — there is
only ever one origin, so there is no cross-origin request to configure.

The alternative, when a build per environment is genuinely unacceptable, is to
serve a small runtime configuration file the application fetches before it starts.
That is a real pattern with a real cost — an extra round trip and a second source
of truth — and it is not worth paying when a relative path will do.

### Why `web` gets `service_started` and not a healthcheck

The proxy depends on `web` with `condition: service_started`, which is the short
syntax's guarantee: the container was created and started, nothing more. For a
static file server that is honest — there is no readiness state distinct from
"the process is running". The API gets a healthcheck because it *has* a state
worth reporting: it may be running and unable to reach its database.

⚠️ **Do not add a healthcheck that always passes** in order to look consistent.
`test: ["CMD", "true"]` reports healthy unconditionally, and anything gated on
`condition: service_healthy` then acts on the lie. The documented way to turn a
check off is `disable: true`.

## Gotchas

**Symptom:** The API is marked healthy, and requests to it fail with database
errors.
**Cause:** The healthcheck hits a liveness endpoint that returns 200 whenever the
process is up, so it reports the process, not the service.
**Fix:** Point the check at readiness — an endpoint that reflects whether the
pool has a working connection — and keep liveness separate for the restart
decision.

**Symptom:** One database blip marks every API replica unhealthy at once.
**Cause:** The readiness endpoint queries the database on each probe, so a shared
dependency became a shared failure.
**Fix:** Report cached state the process already tracks. A healthcheck should
observe, not investigate.

**Symptom:** The frontend calls `http://localhost:3000` in production.
**Cause:** `VITE_API_URL` was set as a runtime `environment:` value. Vite bakes
`VITE_*` into the bundle at build time, so the runtime value was ignored and the
build-time default shipped.
**Fix:** Pass it as a build `arg`, and prefer `/api` so there is nothing to
configure — one origin, one bundle, every environment.

**Symptom:** The API starts before the migration finished, on a machine where it
used to work.
**Cause:** `depends_on` was written in short syntax. The documentation states
plainly that *"with short syntax, Compose does not wait for dependency services to
be 'healthy'"* — it waits only for them to start.
**Fix:** Long syntax with an explicit `condition:`. "It works the second time" is
the field signature of this exact bug.

## Interview questions

**★ Why does the API's healthcheck run `node` instead of `curl`?**
Because the runtime is already in the image and `curl` is not. Adding a package to
a production image so it can check itself adds something to patch and to scan, in
the layer you were trying to keep minimal — and the check gains nothing, since a
three-line script using `fetch` tests the same thing. The related choice is `CMD`
over `CMD-SHELL`: `CMD` execs the argument vector directly, so there is no shell
quoting to get wrong.

**★ `depends_on` says the database must be healthy. Why does the application still
need retry logic?**
Because `depends_on` is startup-only and has no runtime effect. It orders the
first boot and then stops mattering — a database restart at three in the morning
re-orders nothing and does not restart the API. The application half is the part
that survives: an error listener on the connection pool (node-postgres documents
that an unhandled pool `error` event can crash the process), a non-zero connection
timeout, and jittered capped backoff. With that in place, `depends_on` is a
convenience; without it, the stack works exactly until the first restart.

**★ Why is the frontend's API URL a build-time value, and what do you do about
it?**
Because Vite substitutes `VITE_*` variables into the bundle during the build, so
by the time a container starts, the value is already in the JavaScript the browser
downloads — the one thing in the stack that cannot be configured at run time. The
clean answer is to make the value trivial: use the relative path `/api` and let a
reverse proxy put the API on the same origin. That way one bundle is correct
everywhere and CORS never enters the project. If per-environment values are truly
unavoidable, fetch a small runtime config file at startup and accept the extra
round trip.

**What is the difference between `start_period` and `interval`?**
`start_period` is a grace window during which a failing check does not count
against `retries` — it exists so a slow-booting service is not killed for being
slow. `interval` is the steady-state gap between checks. `start_interval` is the
gap *inside* the start period, which is what lets you have a generous window and
still detect a fast boot in seconds. Without it you choose between long waits and
false failures.

**Why does `web` have no healthcheck?**
Because a static file server has no readiness state distinct from "running", so
`condition: service_started` says everything true about it. Adding a check that
always passes would be worse than none: anything gated on `service_healthy` would
act on it. The documented way to disable an inherited check is `disable: true`,
not a `test` that returns success.

**Why is the API the only service on both networks?**
So that it is the only path between the outside world and the data. The proxy and
the frontend cannot reach the database at all, and the database has no route off
the host. That makes the security review a matter of reading one service block,
and it makes an accidental exposure require an edit in an obvious place.

---

← Prev: [The stateful services](03-the-stateful-services.md) · Index: [Phase 9](../README.md) · Next → [The proxy and the boot](05-the-proxy-and-the-boot.md)
