---
title: "Choose a store by the access patterns you can name today and the ones you cannot, which is why the relational default wins arguments it appears to lose on paper"
sidebar_label: "08 · Choosing a store"
sidebar_position: 24
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the MongoDB Manual *Transactions*, for the modelling advice
> quoted below
> ([mongodb.com/docs/manual/core/transactions/](https://www.mongodb.com/docs/manual/core/transactions/)),
> and the Redis documentation *Redis data types*
> ([redis.io/docs/latest/develop/data-types/](https://redis.io/docs/latest/develop/data-types/)).
> Everything else on this page is argument built on the chunks it links, not a documented
> claim. JDK 25, Spring Boot 4.1.0, Spring Data MongoDB 5.1.0, Spring Data Redis 4.1.0,
> MongoDB 8, Redis 8.

**Store selection is usually argued about data shape — "our data is hierarchical", "our
schema changes often", "we need speed" — and data shape is close to irrelevant. The
question that decides it is: how much do you know about how this data will be read, and how
confident are you that the list is complete? A relational database is the store that does
not require you to know. Every other choice on this page trades that away for something
specific, and is a good trade exactly when the something specific is what your feature is
made of.**

## The real question

Write down the access patterns. Not the entities — the *reads*, with their filters, their
ordering and their cardinality. Then ask two things about the list:

1. **How was it derived?** From a product spec written last month, or from three years of a
   running system?
2. **What is the cost of adding a pattern that is not on it?**

That second question separates the stores more cleanly than anything else in this topic:

| Store | Adding an unforeseen access pattern costs |
|---|---|
| PostgreSQL | a query, and possibly an index. The planner finds a way regardless. |
| MongoDB | a query, an index, and possibly **a change to the document model**, because the data you need to filter on may be embedded in the wrong document. |
| Redis | **a new data structure, maintained on every write**, backfilled for existing data. A query with no structure behind it is not slow — it is impossible. |

The further down that table you go, the more of your design is committed up front. That is
not an argument against the lower rows; it is a statement of what you are buying.

## Where each one genuinely wins

### PostgreSQL is the default, and the default is not a cop-out

It is the only store in this phase where you can be wrong about physical design and still
get a correct, often fast, answer — because a declarative query and a planner stand between
your code and the data. Add to that: constraints that make invalid states unrepresentable,
transactions that are free and always available rather than a deployment property, versioned
migrations from [11 · Flyway](../11-flyway-migrations/01-why-schema-is-code.md), and `jsonb`
for the genuinely schemaless corner of an otherwise relational model.

**Choose something else when you can articulate what Postgres cannot do for this particular
workload.** "Cannot scale" is not an articulation; "we need to shard writes across twenty
nodes and our access is always by a single partition key" is.

### MongoDB wins when the aggregate is the unit of work

The Manual makes the argument better than any advocate:

> *"In most cases, a distributed transaction incurs a greater performance cost over single
> document writes, and the availability of distributed transactions should not be a
> replacement for effective schema design. For many scenarios, the denormalized data model
> (embedded documents and arrays) will continue to be optimal for your data and use cases."*

Read that as a fit test. MongoDB is at its best when:

- the thing you read and the thing you write is **one document**, whole;
- that document is genuinely a tree — an order with its lines, a form with its answers, a
  product with its variant-specific attributes;
- the shape **actually varies per record**, rather than varying per release (a variation per
  release is a migration problem, and Postgres has better tools for it);
- you need horizontal sharding, and you have a shard key that your access patterns respect;
- and single-document atomicity is enough, so
  [04 · Transactions in MongoDB](04-transactions-in-mongo.md) stays a chapter you read
  rather than a dependency you have.

### Redis wins when the data structure is the feature

> *"Redis is a data structure server."*

Choose it when the answer to "what is this?" is a structure rather than a record: a sorted
set for a leaderboard, an atomic counter for a rate limit, a stream for an event log with
consumer groups, a set for presence, a HyperLogLog for approximate uniques, a plain string
with a TTL for a cache. In every one of those cases the structure's operations *are* the
feature, and they are atomic, single-round-trip and O(1) or O(log N).

The corollary from [05e](05e-a-data-structure-server-behind-a-repository.md): if the reason
you want Redis is "it is fast", you are choosing on the wrong axis. It is fast because it is
in memory and its commands are primitive — properties you keep only if you use the
primitives.

## The cost of each additional store

Every store after the first is charged on five separate accounts, and only the first one
ever appears in the design document:

1. **Operations.** Backups that are tested, high availability, upgrades, monitoring,
   capacity planning, and a runbook for each. A MongoDB replica set is three machines and a
   failover story, not a container.
2. **Consistency.** There is no transaction across two stores — established from the MongoDB
   side in [04b](04b-wiring-a-mongo-transaction.md) and from the Redis side in
   [06c](06c-redis-transactions.md). Anything spanning both needs an outbox, an idempotent
   consumer or a compensating action, and those are real components with their own failure
   modes.
3. **Cognitive load.** Each store has its own transaction semantics, its own null and
   ordering rules, its own operational failure modes. The whole of
   [07 · What does not carry across](07-what-does-not-carry-across.md) is the tax on a team
   that knows JPA and now also owns MongoDB.
4. **Testing.** A container per store in every build, and no honest in-memory substitute for
   either of the two in this topic.
5. **On call.** The person paged at 3am now needs a mental model of two data stores and of
   the consistency mechanism between them.

**Two stores is more than twice the work of one.** The interface between them is the part
nobody budgets for and the part that fails.

## The two anti-patterns, stated plainly

**A relational schema in MongoDB.** Multiple collections, references between them, `$lookup`
in half the pipelines, `@Transactional` on every service method. Every symptom is visible in
the code: transactions you cannot run locally, joins you had to write, integrity you enforce
by hand. You have chosen a store whose entire value is the aggregate, and then not used
aggregates — so you are paying MongoDB's costs for PostgreSQL's model, and getting neither
the planner nor the constraints.

**Redis as a system of record.** It starts as a cache and accretes state until something in
it exists nowhere else: a counter that is the source of truth, a queue whose items are not
in a database, a session that carries business data. Redis has persistence options, but the
question is not whether it *can* persist — it is whether your recovery plan survives losing
the whole instance. If the honest answer is no, that data belongs somewhere else, and the
repository abstraction from [05](05-redis-repositories.md) is what makes this drift feel
respectable while it happens.

## A short checklist you can actually use

Before adding a store to a system that already has one:

- Can I name the access patterns, and how confident am I that the list is complete?
- What does an unlisted pattern cost in this store?
- Is the unit of work a whole aggregate, a structure, or a set of rows joined on demand?
- Does anything need to be atomic across this store and an existing one? If yes, what is
  the outbox or compensation design — concretely?
- Who operates it, backs it up, upgrades it and gets paged for it?
- If I am wrong, what does leaving look like? Migrating *out* of a schemaless store means
  reconstructing a schema from data that has none, which is strictly harder than the
  migration in.
- Could a table with a `jsonb` column, or a cache in front of a query, have solved this?

**The last question is the one to ask twice**, because "we need a document store" and "we
need one denormalised column" look identical for the first six months.

## Gotchas

**★ Choosing on data shape rather than access patterns is the root error.** Hierarchical
data is not a reason for a document store; *always reading and writing that hierarchy whole*
is.

**★ "It scales" is not a comparison anyone has made.** It is a claim about a workload
nobody has specified. Sharding helps when access respects the shard key and hurts when it
does not.

**★ A schemaless store does not remove the schema, it moves it into every reader.** Old
documents keep their old shape forever, so the accommodation lives in your mapping code
permanently — see
[07b · Queries, schema and exceptions](07b-queries-schema-and-exceptions.md).

**★ Polyglot persistence is priced per interface, not per store.** The consistency mechanism
between two stores is a component you build, operate and debug, and it is never in the
estimate.

**★ Choosing MongoDB to avoid migrations replaces one migration problem with a worse one.**
Instead of a scripted, versioned change applied once, you get a permanent branch in the
reader for every shape you have ever written.

**★ Development-machine convenience is not a property of the store.** A standalone MongoDB
runs your code and cannot run your transactions; a local Redis behaves nothing like one with
memory pressure and eviction.

**★ The exit cost is asymmetric.** Moving into a schemaless store is a mapping change;
moving out requires reconstructing a schema from data that never had one, and reconciling
every historical variant.

**★ "We already have Redis for caching" is how Redis becomes a database.** The instance is
there, the client is configured, and the next feature stores something in it that nothing
else has a copy of.

**★ A store chosen for one feature ends up holding everything adjacent to that feature.**
Nobody adds a fourth store for the next thing; they put it in the third one. Choose as if
the boundary will erode, because it will.

**★ The team's existing knowledge is a legitimate input and is usually left out of the
decision.** A store nobody has operated before is a reliability risk, and that belongs in
the comparison next to the throughput numbers.

## Interview questions

**★ How do you choose between PostgreSQL and MongoDB for a new service?**
By how well the access patterns are known and how the unit of work is shaped. If reads and
writes are whole aggregates and the list of queries is short and stable, MongoDB fits. If
new query shapes will keep arriving, the planner and the constraints of a relational
database are worth more than the document model, because unforeseen patterns are cheap
there and can be model changes elsewhere.

**★ What does the MongoDB Manual itself say about transactions, and why does that matter to
the choice?**
That a distributed transaction costs more than single-document writes and is not a
replacement for effective schema design, and that a denormalised model remains optimal for
many scenarios. It matters because a design needing multi-document transactions everywhere
is a design MongoDB's own documentation is arguing against.

**★ When is Redis the right primary store for something?**
When the structure is the feature and the data is reconstructible or genuinely ephemeral —
rate limits, leaderboards, presence, queues, caches, approximate counts. The moment
something in Redis exists nowhere else and cannot be rebuilt, the choice needs revisiting.

**★ What is the true cost of adding a second store?**
Operations, cross-store consistency, cognitive load, testing and on-call — with the
consistency mechanism being the one that is always underestimated, because there is no
transaction spanning two stores and whatever replaces it is a component you own.

**★ What does a relational schema implemented in MongoDB look like, and why is it bad?**
Many collections, references, `$lookup` in the pipelines, `@Transactional` everywhere. It
pays MongoDB's costs — no planner, no constraints, transactions that are a deployment
requirement — for a model that a relational database would have executed better.

**★ Someone says "we should use MongoDB because our schema changes often." What is your
answer?**
That a schema changing per release is a migration problem, and versioned migrations solve it
with a record of what was applied where. A schemaless store does not remove the change; it
removes the record of it and puts a permanent compatibility branch in every reader.

**★ How reversible is the decision?**
Not very, and asymmetrically. Moving to a document store is a mapping exercise; moving back
means inferring a schema from documents that were never constrained, and reconciling every
shape the application has ever written. Assume the decision is close to permanent and price
it accordingly.

**★ If you had to give one rule?**
Default to the relational database, and require a specific, named capability to justify
anything else — the aggregate as the unit of work, or a data structure that *is* the
feature. "Faster", "scales" and "flexible" are not capabilities; they are adjectives.

{/* FOOTER */}
