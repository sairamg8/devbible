---
title: "A multi-document transaction in MongoDB is a deployment feature before it is a Java feature, and the standalone `mongod` on your laptop cannot give you one"
sidebar_label: "04 · Transactions in MongoDB"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the MongoDB Manual *Transactions*
> ([mongodb.com/docs/manual/core/transactions/](https://www.mongodb.com/docs/manual/core/transactions/)),
> the Spring Data MongoDB 5.1 reference *MongoDB Sessions and Transactions*
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/client-session-transactions.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/client-session-transactions.html))
> and the Testcontainers MongoDB module documentation
> ([java.testcontainers.org/modules/databases/mongodb/](https://java.testcontainers.org/modules/databases/mongodb/)).
> JDK 25, Spring Boot 4.1.0, Spring Data MongoDB 5.1.0, MongoDB 8.

**In Phase 10 so far, `@Transactional` has always worked. You annotated a method, a
transaction manager was there, and the only questions were about propagation and
rollback. MongoDB breaks that assumption at a level below Java: whether a transaction is
available at all is a property of how the server is deployed. A standalone `mongod` — the
one in your `docker run mongo` command, the one your `brew services` started — is not a
deployment that supports multi-document transactions. The Java code is identical either
way, which is why this is discovered in a staging environment rather than in review.**

## What the Manual actually says

> *"Transactions are supported on replica sets and sharded clusters where: the primary uses
> the WiredTiger storage engine, and the secondary members use either the WiredTiger storage
> engine or the in-memory storage engines."*

Note what that sentence does and does not do. It **lists** replica sets and sharded
clusters as supported. It does not contain the words "standalone deployments are not
supported" — the Manual settles the question by omission, and this page will not invent a
quote it does not have. Testcontainers, documenting why its MongoDB module does what it
does, states the practical consequence in one line:

> *"MongoDB starting from version 4 supports multi-document transactions only for a replica
> set."*

There is a feature compatibility version floor as well:

| Deployment | Minimum FCV |
|---|---|
| Replica set | `4.0` |
| Sharded cluster | `4.2` |

An upgraded-but-not-`setFeatureCompatibilityVersion`-ed cluster is a real way to have a
modern server that still refuses to start a transaction.

## What a standalone dev instance can and cannot do

**Can:** everything else in this topic. Every single-document write is atomic on a
standalone — `updateFirst`, `findAndModify`, `$inc`, `$push`, an entire document replaced
by `save`. That is not a lesser form of atomicity; it is the atomicity most MongoDB code is
actually built on, and it is the reason
[03b · Partial updates and find-and-modify](03b-partial-updates.md) can build a work queue
with no locking at all.

**Cannot:** span two documents or two collections in one atomic unit. A
`@Transactional` service method that writes an `Order` and a `Payment` will, on a
standalone, either fail when the session tries to start a transaction or — worse — never
have had a transaction manager at all and write both documents non-atomically with no error
anywhere.

The fix for local development is not a code change:

- **A one-node replica set is still a replica set.** Start `mongod` with `--replSet` and
  run the initiation command once; the deployment type changes, the connection string gains
  `replicaSet=…`, and transactions become available. Testcontainers' `MongoDBContainer`
  exists to automate precisely this — *"Run a MongoDB container of version 4 and up
  specifying `--replSet` command [and] Initialize a single replica set via executing a
  proper command."*
- The Spring Data reference adds the client-side half in one sentence:
  **"Make sure to add `replicaSet` to the MongoDB URI."** Without it the driver does not go
  into replica-set discovery mode and cannot route a transaction's commands to the primary
  reliably.

This makes the choice of local MongoDB a design decision rather than a convenience. If your
service uses transactions, a plain container is a dev environment that cannot run your code
paths, and the first place that difference shows up is the first environment that is not
your laptop.

## The Manual's own advice: model your way out

The transactions page does not sell transactions. It argues against needing them:

> *"In most cases, a distributed transaction incurs a greater performance cost over single
> document writes, and the availability of distributed transactions should not be a
> replacement for effective schema design. For many scenarios, the denormalized data model
> (embedded documents and arrays) will continue to be optimal for your data and use cases.
> That is, for many scenarios, modeling your data appropriately will minimize the need for
> distributed transactions."*

That is the whole argument for document modelling, stated by the database's own
documentation. In a relational schema, "order and its lines must change together" is a
transaction because the rows live in two tables and there is no other option. In MongoDB
the lines can live *inside* the order document, at which point the update is a single
document write and the transaction was never needed.

**A codebase that reaches for `@Transactional` on every MongoDB service method has usually
imported a relational schema into a document store.** The transaction is then a patch over
a modelling decision, and it is paying a cost that the equivalent relational design would
not have paid, because in Postgres the transaction was free and here it is not.

## The operations you cannot perform inside one

The most expensive restriction in practice is Spring Data's, and it is stated in bold on
the reference page:

> *"MongoDB does **not** support collection operations, such as collection creation, within
> a transaction. This also affects the on the fly collection creation that happens on first
> usage. Therefore, make sure to have all required structures in place."*

MongoDB creates a collection implicitly on first write. Inside a transaction it cannot, so
**the first write to a collection that does not exist yet fails** — which means the failure
happens on a fresh database and not on a populated one. Every integration test that starts
from an empty database and every newly provisioned environment hits this; the long-running
staging database never does. Create collections and indexes at deployment time, not by
writing to them.

The Manual adds its own list:

> *"You cannot write to capped collections."*

> *"You cannot read/write to collections in the `config`, `admin`, or `local` databases."*

> *"You cannot write to `system.*` collections."*

> *"You cannot create new collections in cross-shard write transactions. For example, if you
> write to an existing collection in one shard and implicitly create a collection in a
> different shard, MongoDB cannot perform both operations in the same transaction."*

How the transaction is wired into Spring — the manager, the session, and the surprising
things `@Transactional` does once one is present — is
[04b · Wiring a MongoDB transaction](04b-wiring-a-mongo-transaction.md).

## Gotchas

**★ A standalone `mongod` cannot run a multi-document transaction, and your laptop is
running a standalone.** The Manual lists replica sets and sharded clusters; a plain
`docker run mongo` is neither. Nothing in the Java code hints at the difference.

**★ The failure appears in staging, not in review.** Transaction support is a deployment
property, so the same source compiles, passes review, and behaves differently per
environment. This is the single most environment-dependent behaviour in the whole topic.

**★ Forgetting `replicaSet` in the connection URI breaks transactions on a deployment that
supports them.** The reference tells you to add it. Without it, the driver is not in
replica-set discovery mode, and the diagnosis wastes a day because the server is
demonstrably a replica set.

**★ Implicit collection creation does not happen inside a transaction.** The first write to
a new collection fails — on empty databases only. Every fresh test database and every new
environment; never the one you were developing against.

**★ Index creation inside a transaction is a collection operation too.** An application
that creates indexes on startup and then opens a transaction in the same code path has
ordered those two things wrongly.

**★ `spring.data.mongodb.auto-index-creation` is `false` by default in Boot.** Combined
with the previous two, the structures the reference tells you to "have in place" are not
being put in place for you. Something at deployment time has to create them.

**★ An upgraded server with an old feature compatibility version still refuses.** FCV 4.0
for a replica set, 4.2 for a sharded cluster. `setFeatureCompatibilityVersion` is a
deliberate step in an upgrade and it gets forgotten.

**★ A transaction is not free the way a Postgres transaction is free.** The Manual says a
distributed transaction incurs a greater performance cost over single-document writes and
tells you to model instead. Wrapping every service method in `@Transactional` out of habit
imports a cost the relational version did not have.

**★ Capped collections and the `admin`/`config`/`local` databases are off-limits inside a
transaction.** A service that writes an audit record to a capped collection at the end of
its unit of work has made that unit of work untransactable.

**★ "It works in production" is not evidence that transactions work.** A service deployed
against a replica set but *never configured with a transaction manager* runs every method
non-atomically and reports nothing. That is the subject of the next chunk, and it is a
worse failure than an exception.

## Interview questions

**★ Why does your MongoDB transaction fail on a developer machine and work in staging?**
Because transaction support is a property of the deployment. The Manual lists replica sets
and sharded clusters as supported; a standalone `mongod` — the default local container — is
neither. Staging runs a replica set, so the same code behaves differently.

**★ What is the minimum change to get transactions locally?**
Turn the standalone into a single-node replica set: start with `--replSet`, initiate it
once, and put `replicaSet=` in the connection URI. Testcontainers' `MongoDBContainer`
automates exactly those steps, which is why tests that need transactions use it.

**★ Which writes are atomic without any transaction at all?**
Every single-document write. `updateFirst` by `_id`, `findAndModify`, `$inc`, `$push`, a
whole-document replace — all atomic on a standalone. Multi-document atomicity is the only
thing a transaction adds.

**★ What does the MongoDB Manual recommend instead of transactions?**
Modelling. It says a distributed transaction costs more than single-document writes, that
transaction availability is not a replacement for effective schema design, and that a
denormalised model — embedded documents and arrays — will continue to be optimal for many
use cases. Embedding the things that must change together makes the transaction unnecessary.

**★ Your integration test fails on an empty database and passes on a seeded one. What is
the mechanism?**
Implicit collection creation is a collection operation, and MongoDB does not support
collection operations inside a transaction. The first write to a not-yet-existing
collection inside a transaction fails; once the collection exists, it succeeds.

**★ Why is a `@Transactional` MongoDB service method a design smell more often than a
relational one?**
Because in Postgres the transaction was already there and free, and here it is a
deployment requirement with a runtime cost. A method that needs multi-document atomicity is
usually describing a relational schema that was copied into a document store instead of
being remodelled.

**★ A team upgraded MongoDB to a supported version and transactions still fail. What
would you check?**
The feature compatibility version, which does not advance automatically with a binary
upgrade — FCV 4.0 on a replica set, 4.2 on a sharded cluster — and then the connection URI
for `replicaSet`.

{/* FOOTER */}
