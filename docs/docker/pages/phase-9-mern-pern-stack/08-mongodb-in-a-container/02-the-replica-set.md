---
title: "The replica set"
sidebar_label: "02 · The replica set"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/),
> [change streams](https://www.mongodb.com/docs/manual/changeStreams/),
> [`rs.initiate()`](https://www.mongodb.com/docs/manual/reference/method/rs.initiate/) and
> [deploy a replica set with keyfile access control](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set-with-keyfile-access-control/).
> **No sandbox** — no console output on this page.

**Everything on the previous page works on a plain standalone `mongod`. This page
is the one feature class that does not — and it does not announce itself until the
day somebody writes a transaction.**

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
[topic 07](../07-the-whole-stack/04-the-stateful-services.md), for the same reasons:
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

## Gotchas

**Symptom:** A transaction fails, or a change stream never yields, on a database
that is otherwise working perfectly.
**Cause:** The container is running a standalone `mongod`. Both features are
documented as available on replica sets and sharded clusters; neither page
describes standalone support.
**Fix:** Run `mongod --replSet rs0` and initiate a single-member set from a
one-shot service. Then connect with `?replicaSet=rs0` so the driver knows.

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

**Symptom:** The one-shot initiator runs on every `up` and the stack never settles.
**Cause:** It inherited a restart policy, so a job that exits 0 is started again —
and `rs.initiate()` on an already-initiated set is an error, which makes the loop
look like a real failure.
**Fix:** `restart: "no"` on the job, quoted, and guard the call so re-running is
harmless — check `rs.status()` first, which is what the example above does.

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

**★ How do you run a replica set for development without three machines?**
A single-member set. It is a legitimate replica set with one voting member, which
is all that transactions and change streams require — start `mongod --replSet rs0`
and run `rs.initiate()` once from a one-shot service gated on the server being
healthy, with `restart: "no"` so a completed initiation is final. The detail that
matters is passing the member configuration explicitly with the Compose service
name as the host, because the no-argument form registers the container's own
hostname, which clients cannot resolve.

**★ Why is adding authentication to a replica set harder than adding it to a
standalone?**
Because the members have to authenticate to each other as well as to clients. The
documentation says that running `mongod` with `--keyFile` enforces both internal
membership authentication and role-based access control, so the keyfile is not
optional once access control is on. In a container the keyfile is the awkward part:
it must be base64 characters, 6–1024 long, with no group or world permissions and
owned by the user running `mongod` — which a bind mount cannot guarantee, so it is
delivered as a secret with an explicit mode and uid.

**What are the documented requirements for change streams specifically?**
They are *"available for replica sets and sharded clusters"*, which must use the
**WiredTiger** storage engine and replica set protocol version **`pv1`**. Notably
the majority read concern may be either enabled or disabled — the documentation
says change streams work regardless, which is worth knowing because it is a common
assumed prerequisite that is not one.

**What is `featureCompatibilityVersion` and why does it appear here?**
It is the setting that gates which behaviours a deployment will accept, independent
of the binary's version. Transactions require it to be at least `4.0` on a replica
set and `4.2` on a sharded cluster, so an instance upgraded in place from an older
release can be running new binaries and still refuse transactions. On a fresh
container it is not something you normally touch; on an upgraded deployment it is
the first thing to check when a supported feature is rejected.

**Why does the connection string need `?replicaSet=rs0`?**
Because it tells the driver to treat the deployment as a replica set — to discover
members, track which one is primary, and follow an election rather than failing.
Without it the driver may talk to the single node directly, which is fine until the
topology matters. It is also the reason the member host in the configuration must
be a name every client can resolve: the driver takes the host list from the set's
own configuration, not from your connection string.

---

← Prev: [Running one](01-running-one.md) · Index: [Phase 9](../README.md) · Overview → [MongoDB in a container](README.md)
