---
title: "The boot, and proving it"
sidebar_label: "06 · The boot, and proving it"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [`docker compose up`](https://docs.docker.com/reference/cli/docker/compose/up/),
> [`docker compose down`](https://docs.docker.com/reference/cli/docker/compose/down/),
> [`docker compose config`](https://docs.docker.com/reference/cli/docker/compose/config/),
> [the `depends_on` attribute](https://docs.docker.com/reference/compose-file/services/#depends_on),
> [`docker image history`](https://docs.docker.com/reference/cli/docker/image/history/) and
> [`docker builder prune`](https://docs.docker.com/reference/cli/docker/builder/prune/).
> **No sandbox** — no console output on this page.

**A stack that works is not the deliverable. A stack that works on a machine that
has never seen it is.** The difference is entirely in what you did *not* write
down, and there are three commands that find it.

## The boot, end to end

With the file as written, `docker compose up` produces this order, and none of it
is coincidence:

| # | What happens | What made it happen |
|---|---|---|
| 1 | `db` and `cache` are created and started | nothing depends on them being *ready* yet |
| 2 | `db` goes **healthy** | `pg_isready` over TCP succeeds — on a first run, after `initdb` and the init scripts, which is what `start_period: 30s` is for |
| 3 | `cache` goes **healthy** | `redis-cli ping` answers, which it will not do while a dump is loading |
| 4 | `migrate` runs and **exits 0** | gated on `db: service_healthy`; `restart: "no"` makes the exit final |
| 5 | `api` starts | gated on all three — migration completed, database healthy, cache healthy |
| 6 | `api` goes **healthy** | `/readyz` reports a working pool |
| 7 | `proxy` starts and binds `127.0.0.1:8080` | gated on `api: service_healthy`, `web: service_started` |

🔴 **Step 5 is the one that fails on other people's stacks.** Written in short
syntax, `depends_on` waits only for the dependency to *start* — the documentation
states that *"with short syntax, Compose does not wait for dependency services to
be 'healthy'"*. So the API races the migration, fails, and works when you run it
again. **"It works the second time" is the field signature of exactly this bug**,
and the second run works only because the database is already up from the first.

⚠️ **Everything in that table is startup ordering and nothing else.** The
documentation is explicit that `depends_on` governs creation, start and removal
order; it has no runtime effect. The 3am database restart re-orders nothing, which
is why [topic 04](../04-waiting-for-the-database/README.md) exists.

## Check 1 · Start from nothing

```bash
docker compose down -v
docker builder prune -f
docker compose up --build --wait
```

Three commands, three different pieces of hidden state:

- **`down -v`** removes named volumes declared in the file *and* anonymous volumes
  attached to containers — so the database starts empty and the init scripts
  actually run. Without it you are testing a database that was seeded weeks ago by
  a command nobody remembers.
- **`builder prune`** removes the build cache, so a `COPY` that only worked
  because a stale layer still had the file fails here rather than in CI.
- 🔴 **`--wait`** *"implies detached mode"* and returns when the containers are
  **healthy**, not merely started — so the command's exit status is a real answer.
  Plain `up -d` returns as soon as containers exist, which is why scripts that use
  it fail one step later with a connection error that looks like flakiness.

⚠️ **`--wait` is only as honest as the healthchecks.** A service with no
healthcheck counts as ready the moment it starts, and one whose check always
passes counts as ready always. The flag reports what the file claims, which is
exactly why a `test: ["CMD", "true"]` placed "temporarily" is so expensive.

If the seed data has to be reproducible, that is `migrate`'s companion — a seed
step run through `docker compose run --rm` rather than baked into an init script
that can never run twice ([topic 10](../10-migrations-and-seeds.md)).

## Check 2 · Restart the database underneath it

```bash
docker compose restart db
```

The API must recover **on its own**, with no intervention and no restart. This is
the check that `depends_on` cannot help with, because it is startup-only — what is
being tested is the application's connection-pool error handler, its connection
timeout and its backoff.

🔴 **The specific failure this catches is a process death, not a slow request.**
node-postgres documents that when the database goes away *"all the idle,
connected clients in your application will emit an error through the pool's error
event emitter"*, and that if a pool *"emits an `error` event and no listeners are
added node will emit an uncaught error and potentially crash your node process"*.
So the symptom of failing this check is usually the API container exiting, not
returning 500s.

⚠️ **`restart` does not apply file changes** — the documentation says such changes
*"are not reflected after running this command"*. It bounces the process, which is
what makes it the right command here and the wrong command for anything else.

## Check 3 · Read the image and the resolved file, not the sources

```bash
docker compose config
docker image history acme/api:local
docker image inspect acme/api:local --format '{{json .Config}}'
```

`compose config` prints what Compose actually decided — every `${...}` resolved,
every override file merged, every default filled in. It is the only way to see the
file the engine sees, and the gap between it and what you *thought* you wrote is
where override-file bugs live.

⚠️ **It also prints resolved secrets and interpolated values.** It is a debugging
command, not something to paste into a ticket or a chat channel.

The image commands answer the other half: what shipped. A root `USER`, development
dependencies that survived into the runtime stage, a missing `CMD`, an
`ENTRYPOINT` you inherited without noticing — all visible in the image config, none
of them visible in the Dockerfile you *meant* to write
([Phase 5 · Measuring](../../phase-5-image-quality/04-measuring.md)).

## What "one command" actually requires

| Requirement | Where it is satisfied |
|---|---|
| No manual database setup | `POSTGRES_*` plus `docker-entrypoint-initdb.d`, and migrations as a gated one-shot service |
| No `.env` hand-editing | interpolation defaults — `${PROXY_PORT:-8080}` — with `${VAR:?message}` for anything that genuinely must be supplied |
| No "wait a bit then run the seed" | `depends_on` conditions plus `--wait` |
| No host tooling | every command is `docker compose …`; `psql` and `redis-cli` come from the images |
| No secret in the repository | `secrets:` with a gitignored file, and a documented way to produce it |

🔴 **`${VAR:?error message}` is the underused one.** It fails at `up` with your own
text instead of an hour later with a stack trace, and it is the difference between
"clone and run" and "clone, run, read the API logs, ask someone".

## Gotchas

**Symptom:** The stack fails on a colleague's machine and works on yours.
**Cause:** Hidden state — a volume seeded long ago, a build-cache layer, an
environment variable set in your shell profile and interpolated into the file.
**Fix:** `down -v`, `builder prune -f`, then `up --build --wait` in a fresh clone.
Anything that only works because of state you already had is not in the file, and
that is the whole test.

**Symptom:** CI reports the stack started, then the next step cannot connect.
**Cause:** `docker compose up -d` returns when containers are *started*. Started is
not ready.
**Fix:** `--wait`, which implies detached mode and returns on healthy — and make
sure the services it waits on actually have healthchecks, since one without a
check counts as ready immediately.

**Symptom:** An override was supposed to change something and `up` behaves as if
it did not.
**Cause:** Passing any `-f` disables the automatic `compose.override.yaml`, or the
key merged instead of replacing — sequences concatenate, mappings merge by key.
**Fix:** `docker compose config` before debugging anything else. It shows the
merged, interpolated result, which is the file that actually ran.

**Symptom:** The API dies when the database is restarted, rather than reconnecting.
**Cause:** No `error` listener on the connection pool. An unhandled pool `error`
event becomes an uncaught exception and takes the process with it.
**Fix:** Add the listener, and do not call `process.exit()` inside it. Then re-run
check 2 — this is the one failure that `depends_on` can never cover.

## Interview questions

**★ Walk me through what happens between `docker compose up` and the first request
being served.**
The database and cache are created and started, then become healthy — the database
once `pg_isready` succeeds over TCP, which on a first run is after `initdb` and the
init scripts, and the cache once `PING` answers, which it will not do while a dump
is loading. The migration job starts on `service_healthy`, applies migrations and
exits 0, which `restart: "no"` makes final. The API starts only after the migration
completed successfully and both data services are healthy, then becomes healthy
itself when `/readyz` reports a working pool. Finally the proxy starts and binds the
single published port. The subtle part is that all of it is startup ordering —
nothing there protects the stack after a restart.

**★ How do you prove the stack really works on a machine that has never run it?**
Remove the state that makes your machine special and start again: `down -v` for the
volumes, `builder prune` for the build cache, then `up --build --wait` so the exit
status reflects health rather than existence. Then restart the database underneath
the running stack and watch the API recover on its own, because that path is not
covered by anything in the compose file. Finally read `compose config` and the
image config rather than the sources, since those show what Compose and the builder
actually produced.

**★ What does `--wait` change, and when does it lie to you?**
It implies detached mode and holds until services report healthy instead of merely
started, so a CI script's exit status means something. It lies when the services it
is waiting on have no healthcheck — those count as ready as soon as they start — or
when a healthcheck always passes, which is why a check that returns success
unconditionally is worse than none at all. `--wait` reports what the file claims,
not what is true.

**Why is `docker compose restart` the right command for check 2 and the wrong one
for applying a change?**
Because it bounces the process without re-reading the file — the documentation says
changes to the compose file *"are not reflected after running this command"*. That
makes it a clean way to simulate a database going away and coming back. To apply a
change you want `up -d`, adding `--build` when the image itself must change; using
`restart` for that is the commonest Compose mistake and it fails silently.

**Why read `docker compose config` before debugging an override?**
Because it prints the merged, interpolated file the engine actually used, and most
override bugs are one of three documented behaviours: passing any `-f` disables the
automatic `compose.override.yaml`, sequences concatenate instead of replacing, and
relative paths resolve against the *base* file's directory. All three are obvious
in the resolved output and invisible in the sources. Just do not paste that output
anywhere — it contains resolved secrets.

**What is `${VAR:?message}` for?**
Failing fast, in your words. Interpolation of an unset variable normally yields an
empty string, so a missing value becomes a confusing runtime error much later. The
`:?` form makes `up` stop immediately with the message you wrote, which turns "the
API returns 500 and the logs mention undefined" into "DATABASE_URL is not set". It
is the cheapest documentation a project has.

---

← Prev: [The proxy](05-the-proxy.md) · Index: [Phase 9](../README.md) · Overview → [The whole stack in one file](README.md)
