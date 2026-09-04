---
title: "The whole discipline of running jOOQ next to JPA is one rule — every table has exactly one library that writes it — and the reason it is hard is that nothing in either library enforces it for you"
sidebar_label: "08c · One owner per table"
sidebar_position: 28
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Code generation configuration*
> ([code-generation/codegen-configuration](http://www.jooq.org/doc/latest/manual/code-generation/codegen-configuration/))
> and *Different use cases for jOOQ*
> ([getting-started/use-cases](https://www.jooq.org/doc/latest/manual/getting-started/use-cases/)) —
> and the Hibernate ORM 7 `@Immutable` javadoc
> ([docs.hibernate.org/orm/7.0/javadocs/…/annotations/Immutable.html](https://docs.hibernate.org/orm/7.0/javadocs/org/hibernate/annotations/Immutable.html)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, PostgreSQL 18.

**The wiring in [08b](08b-using-both.md) is free. The modelling is not. Once both libraries are on
the classpath you have two independently-derived models of one schema, and the only thing standing
between that and a data-corruption incident is a rule nobody's compiler checks: every table has
exactly one library that writes it. This chunk is how to state that rule, the three shapes that
satisfy it, the two mechanisms that can actually enforce it, and the honest list of what the second
model costs you even when the rule holds.**

## The rule

🔴 **Every table has exactly one library that writes it — and, wherever you can manage it, exactly
one library that has a mapping for it at all.**

The second half is stronger than the first and worth the extra effort. A table with an entity *and*
a generated jOOQ class is a table where someone can write the wrong kind of statement without
leaving the codebase's normal idioms. A table with only one of the two is a table where the wrong
statement does not compile.

## Three shapes that satisfy it

**1 · Disjoint by direction — jOOQ never writes.** JPA owns every `INSERT`, `UPDATE` and `DELETE`;
jOOQ only ever issues `SELECT`. The rule is satisfied trivially because there is only ever one
writer. This is the shape to start with, and the one to keep if the reason you adopted jOOQ was
reporting.

**2 · Disjoint by table.** The transactional aggregates — order, customer, invoice — are JPA's,
with no generated jOOQ classes. The append-only, bulk-loaded and reporting tables — events, ledger
lines, imported feeds, materialised summaries — are jOOQ's, with no entities. This is the shape
that scales, because the boundary is visible in the package structure rather than in a convention.

**3 · Disjoint by transaction.** jOOQ does a bulk write — a nightly reprice, an import, a backfill
— in its own transaction, entirely before or entirely after any JPA unit of work that touches those
rows. The persistence context that would have gone stale does not exist yet, or no longer exists.

⚠️ **The fourth shape is the one nobody designs and many codebases end up with:** an entity mapped
to a table that a jOOQ `UPDATE` also writes, inside one transaction. Everything else in this
combination fails loudly. That one does not — [08d](08d-the-stale-persistence-context.md).

## Two mechanisms that actually enforce it

Conventions decay. These two do not, because they turn the rule into a compile error.

### `<excludes>` in the generator

The code generator's `<database>` block takes `<includes>` and `<excludes>` regular expressions —
[02b · Configuring the generator](02b-configuring-the-generator.md) — and the manual is explicit
about their interaction:

> *"Excludes match before includes, i.e. excludes have a higher priority"*

```xml
<database>
  <inputSchema>public</inputSchema>
  <!-- JPA owns the aggregates: do not generate jOOQ classes for them -->
  <excludes>ORDER | ORDER_LINE | CUSTOMER | INVOICE | flyway_schema_history</excludes>
</database>
```

🔴 **Now a jOOQ query against `ORDER` does not compile, because there is no `ORDER` class.** The
boundary stops being a review comment and becomes a build failure. This is the single highest-value
thing on this page, and it costs one line of generator configuration.

⚠️ **It cuts both ways.** The day you legitimately need a jOOQ statement against an excluded table
— a bulk backfill, say — you must change the generator configuration, which is exactly the visible,
reviewable moment the rule is designed to create.

### `@Immutable` on the entities jOOQ owns

The reverse direction is harder, because you sometimes genuinely want to *read* a jOOQ-owned table
through JPA — a `@ManyToOne` to a reference table jOOQ bulk-loads, for instance. Hibernate's
`@Immutable` is the tool:

> *"Changes made in memory to the state of an immutable entity are never synchronized to the
> database. The changes are ignored, with no exception thrown."*

and, on the same javadoc:

> *"An immutable entity need not be dirty-checked, and so Hibernate does not need to maintain a
> snapshot of its state."*

**No snapshot means no dirty checking means nothing to write back** — which is precisely the
failure mode [08d](08d-the-stale-persistence-context.md) is about, removed at the mapping.

🔴 **But read the first quote again: *"with no exception thrown"*.** `@Immutable` protects the
database and lies to the developer. Someone will write `order.setStatus(...)` on an immutable
entity, see no error, and spend an afternoon on it. Prefer *no entity at all* where you can, and
treat `@Immutable` as the compromise it is.

## What the second model costs even when the rule holds

- **Two derivations of one schema.** The entity classes are a hand-written model of the schema;
  the generated classes are a mechanical one. They drift — and only one of them fails the build
  when a column disappears.
- **Two naming regimes.** `Order.placedAt` and `ORDER.PLACED_AT` are the same column under two
  conventions, and every review that spans both halves has to translate.
- **Two places a conversion lives.** An `AttributeConverter` on the entity and a forced type in the
  generator — [02c · Shaping the generated API](02c-shaping-the-generated-api.md) — do the same job
  for the same column, and nothing makes them agree. A currency stored as minor units, an enum
  stored as a code: define it twice, get it wrong once.
- **Two DTO ecosystems.** Entity-to-DTO mapping on one side; `fetchInto`, `Records.mapping` and
  ad-hoc converters on the other — [04c](04c-record-mappers-and-converters.md).
- **Two answers to "how do I query this?"** in every pull request, decided by whoever wrote it
  rather than by a rule you can point at.
- **Two migration audiences.** A migration must satisfy the entity mappings *and* be
  regeneratable. Adding a `NOT NULL` column without a default breaks both, differently, at
  different times — [Topic 11 · Why schema is code](../11-flyway-migrations/01-why-schema-is-code.md).
- **Two test setups.** A service using both is covered by neither the `@DataJpaTest` slice nor the
  `@JooqTest` slice alone. Check what your Boot version's slices import rather than inheriting the
  assumption from a 3.x example.
- **Two caches, one of which is not a cache.** Hibernate's first- and second-level caches serve the
  JPA half and are invisible to the jOOQ half — every jOOQ read misses them and every jOOQ write
  fails to invalidate them ([Topic 12 · Caching is a decision](../12-caching/01-caching-is-a-decision.md)).
- **Two upgrade cadences.** Hibernate and jOOQ release independently, and a JDK bump has to clear
  both floors — jOOQ's Open Source Edition requires **Java 21 and newer**
  ([01b · The licence question](01b-the-licence-question.md)).
- **Two onboarding curves.** Every new engineer learns both, plus the local rule about which to use
  where. That is the cost that never amortises.

**None of these is fatal and all of them are permanent.** The way to keep them small is to keep the
overlap small: the fewer tables both libraries know about, the less of this list you pay.

## When not to do it at all

- **When one query is the whole justification.** One awkward report is a native query, not a second
  data-access stack plus a code generator plus a build step. The break-even is a *family* of
  queries the ORM cannot express.
- **When nobody will own the boundary.** If the rule is not written down and enforced in review —
  or better, in the generator configuration — it degrades to "use whichever you like", and then
  every table has two owners.
- **When the team is at capacity.** The arrangement is two mental models, permanently, for everyone
  who touches the data layer.
- **When the real problem is the JPA mapping.** A great many "the ORM cannot do this" queries are
  an `EAGER` association, a missing index or a projection that was never written —
  [Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md) is a cheaper first
  investigation than adopting a second library.

## The review checklist

1. Which library owns this table? Is that written down anywhere other than this pull request?
2. Does the generator exclude the tables JPA owns, and does the entity model omit the tables jOOQ
   owns?
3. Does any transaction in this change touch the same table through both libraries?
4. If a jOOQ statement writes a table that has an entity, is there an `em.refresh` / `em.clear`
   after it, or a documented reason none is needed?
5. Is any conversion for this column defined twice — once as an `AttributeConverter`, once as a
   forced type?
6. Does the change add a mapping on the *other* side of a table that already had one owner?

## Gotchas

**★ "jOOQ is read-only here" is a rule that erodes, and usually for a good reason.** The first jOOQ
write is a bulk update that replaces a hundred entity flushes, and it is usually correct. Write the
policy as *one owner per table*, not as *jOOQ never writes*, so that the first justified write does
not silently repeal it.

**★ A convention that lives only in a wiki is not a boundary.** `<excludes>` in the generator turns
it into a compile error for a one-line cost. Nothing else on this page is as effective.

**★ `@Immutable` silently discards writes.** The javadoc says so — *"The changes are ignored, with
no exception thrown"*. It protects the data and misleads the developer, so it is a second choice
after not mapping the entity at all.

**★ Excluding a table from generation does not stop plain SQL templating.** `DSL.table(name("order"))`
and `dsl.fetch("select …")` still reach it, unchecked. The boundary is strong against ordinary
idioms and porous against deliberate ones — which is the right shape, but do not mistake it for a
lock.

**★ The generated tree and the entity classes drift in opposite directions.** Regeneration is driven
by the build; entity mappings are driven by whoever remembers. A dropped column fails the jOOQ
build immediately and passes the JPA one until that code path runs in production.

**★ A conversion defined twice will disagree exactly once, and in the worst place.** An enum
persisted as an ordinal by JPA and read as a string by jOOQ is a data bug that no test with a
single writer will find. Prefer a forced type and no `AttributeConverter`, or the reverse —
never both for one column.

**★ Adding jOOQ removes no JPA cost.** The persistence context, the mappings, the flush and the
caches still run on every JPA path. The bill is additive; only the specific class of query that
motivated the addition gets better.

**★ Second-level caching now covers half your reads.** If a cache hit rate was part of the
performance argument for a table, moving its reads to jOOQ removes it without any code saying so.

**★ Two owners on one table is not always visible in one file.** The entity is in one package, the
jOOQ query in another, and the transaction that contains both is a third. Grep for the table name,
not for the class.

**★ A read-model table that later needs a write is the moment the boundary is decided.** Whichever
library writes it first becomes its owner by accident. Decide deliberately, and change the
generator configuration or the entity model to match.

**★ The rule applies per *transaction*, not per service.** Two owners in the same codebase but never
in the same transaction is a workable arrangement — shape 3 above. Two owners in the same
transaction is the one that corrupts data.

**★ Views are a legitimate third option and are often forgotten.** A database view owned by
migrations, generated by jOOQ and never mapped as an entity, gives the read side its own schema
object with no ambiguity about who writes what — because nobody writes a view.

## Interview questions

**★ What is the single rule for running jOOQ alongside JPA?** Every table has exactly one library
that writes it, and ideally exactly one library with a mapping for it at all. Every failure mode of
the combination begins with two owners.

**★ Name three arrangements that satisfy it.** Disjoint by direction — jOOQ only selects; disjoint
by table — reporting and append-only tables have no entity, aggregates have no generated class;
disjoint by transaction — jOOQ's bulk work runs entirely outside the JPA unit of work.

**★ How do you enforce the rule mechanically rather than by convention?** Put the JPA-owned tables
in the generator's `<excludes>`, so a jOOQ query against them does not compile; and do not map
entities for the jOOQ-owned tables. The manual notes that *"excludes match before includes"*, so an
exclusion cannot be accidentally overridden by a broad include.

**★ What does `@Immutable` do, and why is it only a second choice?** It tells Hibernate the entity's
in-memory changes are *"never synchronized to the database"* and *"ignored, with no exception
thrown"* — which removes the dirty-checking hazard but also removes the feedback. Not mapping the
entity at all is better where it is possible.

**★ Does excluding a table from code generation make it unreachable from jOOQ?** No. Plain SQL
templating and `DSL.table(name("…"))` still reach it, without type checking. The exclusion stops
the ordinary idiom, which is what you want; it is not a security boundary.

**★ What does the second model cost when everything is done right?** Two derivations of one schema
that drift, two naming regimes, two places conversions live, two DTO ecosystems, two migration
audiences, two test setups, two caches — one of which serves only half the reads — two upgrade
cadences and a permanent onboarding cost.

**★ When would you refuse to add jOOQ to a JPA codebase?** When one query is the whole
justification; when nobody will own and enforce the boundary; when the team cannot absorb a second
data-access model; and when the underlying problem is an unfixed mapping or a missing index rather
than a limit of JPQL.

**★ Why is defining a conversion twice worse than defining it in the wrong place?** Because two
definitions can disagree, and the disagreement only surfaces when one library writes what the other
reads. An enum written as an ordinal and read as a name is a silent data bug that a single-writer
test cannot find.

**★ Where does a database view fit into this?** It is the cleanest read-model boundary available:
owned by migrations, generated by jOOQ, never mapped as an entity, and impossible to write. When
the read shape is stable, a view removes the ownership question rather than answering it.

**★ Does the rule apply per service or per transaction?** Per transaction. Two owners that never
meet in one transaction is shape 3 and is workable. Two owners inside one transaction is the case
where the persistence context goes stale and a write is silently reverted.

**★ Your team wants jOOQ for one reporting endpoint. What do you recommend?** A native query first.
If the endpoint turns out to be the first of a family — several reports, a dynamic search, a
PostgreSQL feature JPQL cannot reach — then adopt jOOQ deliberately, with the generator excluding
the JPA-owned tables from day one, before any habit forms.

{/* FOOTER */}
