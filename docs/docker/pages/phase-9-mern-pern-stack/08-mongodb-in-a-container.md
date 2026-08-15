---
title: "MongoDB in a container"
sidebar_label: "08 · MongoDB in a container"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the official `mongo` image documentation](https://hub.docker.com/_/mongo),
> [the `mongo` image Dockerfile](https://github.com/docker-library/mongo),
> [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/),
> [change streams](https://www.mongodb.com/docs/manual/changeStreams/),
> [`rs.initiate()`](https://www.mongodb.com/docs/manual/reference/method/rs.initiate/),
> [deploy a replica set with keyfile access control](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set-with-keyfile-access-control/) and
> [the `ping` command](https://www.mongodb.com/docs/manual/reference/command/ping/).
> **No sandbox** — no console output on this page.

**A single `mongod` in a container is four lines and works immediately — and then
one day you write a transaction and it fails.** The easy part is genuinely easy;
what bites is a deployment requirement, not a container one.

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
[topic 03](03-postgres-in-a-container/README.md) — changing the password in the
compose file changes nothing, and the only way to re-run initialisation is to
start from an empty volume.

**`_FILE` works here too**, with narrower coverage than PostgreSQL's: *"Currently,
this is only supported for `MONGO_INITDB_ROOT_USERNAME` and
`MONGO_INITDB_ROOT_PASSWORD`."* Enough for [topic 06](06-secrets-dev-vs-prod.md)'s
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

Seed *data* belongs with migrations ([topic 10](10-migrations-and-seeds.md)),
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
([Phase 8 · Healthchecks](../phase-8-compose/06-healthchecks/02-checks-that-are-true.md)).

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

## The part that bites: transactions and change streams

🔴 **Both require a replica set.** Not a container thing, a MongoDB deployment
thing — and it does not surface until the feature is used.

| Feature | Documented availability |
|---|---|
| **Multi-document transactions** | *"MongoDB supports distributed transactions, including transactions on replica sets and sharded clusters"* — with `featureCompatibilityVersion` at least **4.0** on a replica set, **4.2** on a sharded cluster |
| **Change streams** | *"Change streams are available for replica sets and sharded clusters"*, requiring the **WiredTiger** storage engine and replica set protocol **`pv1`** |

Neither page describes support on a standalone `mongod`. So a default
`image: mongo:8` in a compose file — which is a standalone — is a deployment your
application cannot use those features on, and everything else about it works
perfectly.

**The development answer is a single-member replica set.** It is a legitimate
replica set with one voting member, and it is enough to turn both features on:

```yaml
  mongo:
    image: mongo:8
    command: ["mongod", "--replSet", "rs0", "--bind_ip_all"]
    volumes:
      - mongo-data:/data/db
    networks: [backend]

  mongo-init:
    image: mongo:8
    depends_on:
      mongo:
        condition: service_healthy
    command: >
      mongosh --host mongo --quiet --eval
      "try { rs.status() } catch (e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]}) }"
    networks: [backend]
    restart: "no"
```

Same one-shot shape as the migration job in
[topic 07](07-the-whole-stack/03-the-stateful-services.md), for the same reasons:
`restart: "no"` so a completed initiation is final, and `service_healthy` so it
does not race the server.

🔴 **Pass the member host explicitly.** `rs.initiate()` with no argument *"uses a
default replica set configuration"*, which names the member by the machine's own
hostname — inside a container that is a name your other containers may not
resolve. The manual's own advice is to *"use DNS hostnames instead of IP
addresses"*, and on a Compose network the service name is that hostname. Clients
then connect with the replica set named:

```
mongodb://mongo:27017/acme?replicaSet=rs0
```

⚠️ **A replica set plus authentication is a bigger step than it looks.** Enforcing
access control on a replica set also requires *internal* authentication between
members, and the documentation is explicit that running `mongod` with `--keyFile`
*"enforces both Self-Managed Internal/Membership Authentication and Role-Based
Access Control"*. The keyfile itself has requirements that collide with containers:
*"A key's length must be between 6 and 1024 characters and may only contain
characters in the base64 set"*, and *"on UNIX systems, the keyfile must not have
group or world permissions"* — `chmod 400`, owned by the user running `mongod`. A
bind-mounted keyfile arrives with the host's ownership and mode, and `mongod`
refuses to start. Delivering it as a Compose secret with an explicit `mode:` and
`uid:` is the container-shaped answer.

For development, the pragmatic combination is a single-member replica set **with no
authentication** on an internal network, and access control configured properly in
the environment that needs it.

## Podman

Nothing here diverges: the image, the entrypoint, the volume and the replica-set
requirements are MongoDB's, not the engine's. The one thing to remember is
[phase 6](../phase-6-storage/05-uid-mismatch/README.md)'s rootless UID mapping — a
named volume is fine, but a **bind mount** for `/data/db` under rootless Podman
lands with a mapped owner the in-container `mongodb` user (uid 999) may not be
able to write.

## Gotchas

**Symptom:** A transaction fails, or a change stream never yields, on a database
that is otherwise working perfectly.
**Cause:** The container is running a standalone `mongod`. Both features are
documented as available on replica sets and sharded clusters; neither page
describes standalone support.
**Fix:** Run `mongod --replSet rs0` and initiate a single-member set from a
one-shot service. Then connect with `?replicaSet=rs0` so the driver knows.

**Symptom:** The root user was never created and the database is wide open.
**Cause:** Only one of `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`
was set. Both are required, and authentication is enabled *as a consequence* of
creating the user.
**Fix:** Set both — or both `_FILE` variants — and check on a **fresh volume**,
since neither has any effect on a data directory that already contains a database.

**Symptom:** The replica set initiates, and the application cannot connect to it.
**Cause:** `rs.initiate()` was called with no argument, so the member is
registered under the container's own hostname, which is not what the client
resolves.
**Fix:** Pass the configuration explicitly with `host: 'mongo:27017'` — the
service name, which is the name every container on that network resolves.

**Symptom:** `mongod` exits immediately after adding `--keyFile`.
**Cause:** The keyfile has group or world permissions, or is not owned by the user
running `mongod` — a bind-mounted file carries the host's ownership and mode.
**Fix:** Deliver it as a Compose secret with an explicit `mode:` and `uid:`, and
remember that `--keyFile` also switches on client access control, so every
connection now needs credentials.

## Interview questions

**★ Why does a MongoDB transaction fail in a development container and work in
production?**
Because the container is almost certainly a standalone `mongod` and production is a
replica set. The documentation describes multi-document transactions as supported
on replica sets and sharded clusters, and says nothing about standalone support;
the same is true of change streams. Nothing in the container is wrong — it is a
deployment-topology requirement that only surfaces when the feature is used. The
fix in development is a single-member replica set: `mongod --replSet rs0` plus a
one-shot `rs.initiate()` with the member host set to the Compose service name.

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

**What belongs in `/docker-entrypoint-initdb.d` and what does not?**
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

**Why is adding authentication to a replica set harder than adding it to a
standalone?**
Because the members have to authenticate to each other as well as to clients. The
documentation says that running `mongod` with `--keyFile` enforces both internal
membership authentication and role-based access control, so the keyfile is not
optional once access control is on. In a container the keyfile is the awkward part:
it must be base64 characters, 6–1024 long, with no group or world permissions and
owned by the user running `mongod` — which a bind mount cannot guarantee, so it is
delivered as a secret with an explicit mode and uid.

---

← Prev: [The whole stack in one file](07-the-whole-stack/README.md) · Index: [Phase 9](README.md) · Next → **Redis in a container** *(not written yet)*
