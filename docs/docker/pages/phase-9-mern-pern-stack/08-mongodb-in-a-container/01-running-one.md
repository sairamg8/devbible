---
title: "Running one"
sidebar_label: "01 · Running one"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the official `mongo` image documentation](https://hub.docker.com/_/mongo),
> [the `mongo` image Dockerfile](https://github.com/docker-library/mongo) and
> [the `ping` command](https://www.mongodb.com/docs/manual/reference/command/ping/).
> **No sandbox** — no console output on this page.

**A `mongod` in a container is four lines, and every one of the traps in those four
lines is about *when* things happen — once, on an empty volume, and never again.**

## The service

```yaml
  mongo:
    image: mongo:8
    environment:
      MONGO_INITDB_ROOT_USERNAME_FILE: /run/secrets/mongo_user
      MONGO_INITDB_ROOT_PASSWORD_FILE: /run/secrets/mongo_password
      MONGO_INITDB_DATABASE: acme
    secrets:
      - mongo_user
      - mongo_password
    volumes:
      - mongo-data:/data/db
      - ./mongo/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' | grep -q 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
      start_interval: 2s
    networks: [backend]
    restart: unless-stopped
```

The image's Dockerfile declares **`VOLUME /data/db /data/configdb`**, with
`ENTRYPOINT ["docker-entrypoint.sh"]`, `CMD ["mongod"]` and `EXPOSE 27017`, creates
a `mongodb` user at **uid 999** whose home directory is `/data/db`, and sets no
`USER` instruction. `/data/configdb` only matters for a config server
(`--configsvr`); for an application database, `/data/db` is the mount that matters.

## The initialisation variables run once

`MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` *"used in
conjunction, create a new user and set that user's password"*, and 🔴 **"Both
variables are required for a user to be created. If both are present then MongoDB
will start with authentication enabled (`mongod --auth`)."**

Two consequences that are easy to miss:

- **Setting only one does nothing.** No user, and no authentication either — you
  get an open database that looks configured.
- **Authentication is a side effect of creating the user**, not a separate switch.
  There is no "create the user but stay open" combination.

⚠️ 🔴 **And none of it applies to an existing volume:** *"none of the variables
below will have any effect if you start the container with a data directory that
already contains a database"*. Exactly the PostgreSQL rule from
[topic 03](../03-postgres-in-a-container/README.md) — changing the password in the
compose file changes nothing, and the only way to re-run initialisation is to
start from an empty volume.

**`_FILE` works here too**, with narrower coverage than PostgreSQL's: *"Currently,
this is only supported for `MONGO_INITDB_ROOT_USERNAME` and
`MONGO_INITDB_ROOT_PASSWORD`."* Enough for [topic 06](../06-secrets-dev-vs-prod.md)'s
pattern — the credentials never appear in the environment.

## Init scripts

*"When a container is started for the first time it will execute files with
extensions `.sh` and `.js` that are found in `/docker-entrypoint-initdb.d`. Files
will be executed in alphabetical order."* The `.js` files run through **`mongosh`**
(*"`mongo` on versions below 6"*) against the database named by
`MONGO_INITDB_DATABASE`, *"or `test` otherwise"*.

⚠️ **`MONGO_INITDB_DATABASE` does not create a database.** The documentation says
so plainly: *"MongoDB is fundamentally designed for 'create on first use', so if
you do not insert data with your JavaScript files, then no database is created."*
It selects the database the scripts run *against*. If you want indexes and
collections to exist, the script has to create them.

That is the useful thing to put there — indexes and validators, not seed rows:

```js
// mongo/init/01-indexes.js
db.orders.createIndex({ customerId: 1, createdAt: -1 })
db.users.createIndex({ email: 1 }, { unique: true })
```

Seed *data* belongs with migrations ([topic 10](../10-migrations-and-seeds.md)),
because init scripts can only ever run against a brand-new volume and the seed you
need next month will have to run against an existing one.

## The healthcheck, and the trap in it

```yaml
      test: ["CMD-SHELL", "mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' | grep -q 1"]
```

🔴 **`mongosh` exits 0 when the shell ran, not when the command succeeded.** So a
naive `mongosh --eval "…"` reports healthy for a server that answered nothing at
all. Piping the result through `grep -q 1` moves the verdict to the *value* the
command returned, which is what you meant to test
([Phase 8 · Healthchecks](../../phase-8-compose/06-healthchecks/02-checks-that-are-true.md)).

`ping` is the right command to send — the manual describes it as *"a no-op used to
test whether a server is responding to commands"* that *"will return immediately
even if the server is write-locked"*.

⚠️ **One honest gap:** the `ping` reference does **not** state whether the command
requires authentication or a privilege. If the check starts failing the moment
`MONGO_INITDB_ROOT_*` is set, that is the reason — pass credentials to `mongosh`.
This page does not claim `ping` is exempt from access control, because the
documentation does not say so.

⚠️ **Do not shell out to the legacy `mongo` binary.** The image documentation notes
`mongosh` replaced it from version 6, and this track could not confirm from primary
documentation which release removed the old binary — so check the tag you actually
run rather than trusting a remembered version number.

## Podman

Nothing here diverges: the image, the entrypoint, the volume and the replica-set
requirements are MongoDB's, not the engine's. The one thing to remember is
[phase 6](../../phase-6-storage/05-uid-mismatch/README.md)'s rootless UID mapping — a
named volume is fine, but a **bind mount** for `/data/db` under rootless Podman
lands with a mapped owner the in-container `mongodb` user (uid 999) may not be
able to write.

## Gotchas

**Symptom:** The root user was never created and the database is wide open.
**Cause:** Only one of `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`
was set. Both are required, and authentication is enabled *as a consequence* of
creating the user.
**Fix:** Set both — or both `_FILE` variants — and check on a **fresh volume**,
since neither has any effect on a data directory that already contains a database.

**Symptom:** Changing `MONGO_INITDB_ROOT_PASSWORD` in the compose file has no
effect.
**Cause:** *"none of the variables below will have any effect if you start the
container with a data directory that already contains a database"* — the credential
was baked into the volume on its first boot.
**Fix:** In development, `down -v` and start again. In anything with real data,
change the password *in MongoDB* with `db.changeUserPassword`, because the
environment variable is a bootstrap and not a source of truth.

**Symptom:** The healthcheck reports healthy for a server that is answering nothing.
**Cause:** `mongosh` exits 0 when the **shell** ran, not when the command inside it
succeeded.
**Fix:** Turn the result into an exit status — pipe through `grep -q 1` — so the
verdict comes from the value the command returned.

**Symptom:** A bind-mounted `/data/db` is unwritable under rootless Podman.
**Cause:** Rootless UID mapping. The image runs as `mongodb` (uid 999), and the
mapped owner of a host directory is not that user.
**Fix:** Use a named volume, which the engine creates with the right ownership.
Reach for `--userns=keep-id` or an explicit `user:` only if a bind mount is genuinely
required.

## Interview questions

**★ What do `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` actually
do, and when?**
Together they create a root user, and if both are present the server starts with
authentication enabled — the documentation's words are that both are required and
that MongoDB then starts with `mongod --auth`. Setting only one silently does
nothing at all. And like every other `MONGO_INITDB_*` variable, they have no effect
if the data directory already contains a database, so changing the password in the
compose file after the first run changes nothing. The only way to re-run
initialisation is an empty volume.

**★ What is wrong with `test: ["CMD-SHELL", "mongosh --eval 'db.adminCommand(...)'"]`
as a healthcheck?**
`mongosh` exits 0 when the shell itself ran, not when the command inside it
succeeded — so the check reports healthy for a server that answered nothing. The
result has to be turned into an exit status, which is what piping through
`grep -q 1` does. It is the same class of mistake as a healthcheck that always
passes: the container reports a state that `condition: service_healthy` then acts
on.

**★ What belongs in `/docker-entrypoint-initdb.d` and what does not?**
Structure belongs there — indexes, unique constraints, validators — because those
are cheap to declare and the scripts run in alphabetical order against a brand-new
volume. Seed data does not, because init scripts can only ever run once against an
empty data directory, and the seed you need next month has to run against a
database that already exists. That is a migration.

**Does `MONGO_INITDB_DATABASE` create a database?**
No. It names the database that the `.js` files in `/docker-entrypoint-initdb.d`
run against, defaulting to `test`. The documentation is explicit that MongoDB
creates on first use, so if the scripts insert nothing, no database appears. It is
a script target, not a `CREATE DATABASE`.

**Which volume actually holds the data?**
`/data/db`. The image declares `VOLUME /data/db /data/configdb`, and the second one
only matters for a config server started with `--configsvr` — mounting it for an
application database achieves nothing. The image also creates the `mongodb` user at
uid 999 with `/data/db` as its home and sets no `USER` instruction, which is what
makes ownership the thing to watch on a bind mount.

**How far does the `_FILE` convention go on this image?**
Less far than on `postgres`. The documentation says it is *"only supported for
`MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD`"* — which is enough
for the credentials that matter, but means anything else has to arrive as a plain
environment variable or be read by your own code.

---

← Overview: [MongoDB in a container](README.md) · Index: [Phase 9](../README.md) · Next → [The replica set](02-the-replica-set.md)
