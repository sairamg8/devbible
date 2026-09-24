---
name: progress-java-p10-t07-relationships
description: devbible Java Phase 10 Topic 07 · Relationships and fetch types — authoring fork progress, chunk plan, verified claims
metadata:
  type: project
---

# Java P10 · Topic 07 · Relationships and fetch types

Directory: `docs/java/pages/phase-10-data-access/07-relationships-fetch/`
Tier: **Understand**. Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8,
Hibernate ORM 7.4.1, Jakarta Persistence 3.2, Spring Data JPA 4.1.0, PostgreSQL 18.

## Boundary (absolute)

- **06 owns** persistence context, entity states, dirty checking, flush, L1 cache,
  `@Id` generation, single-entity mapping. Assume it, do not re-teach.
- **07 (mine) owns** the mappings: `@ManyToOne`, `@OneToMany`, `@OneToOne`,
  `@ManyToMany`, owning side, `mappedBy`, `@JoinColumn`, `@JoinTable`, cascade,
  orphan removal, collection types, fetch-type defaults.
- **08 owns N+1 and every fix** — fetch joins, `@EntityGraph`, `@BatchSize`,
  projections. I name the `EAGER` danger and hand off. I never solve N+1.
- **10 owns** `LazyInitializationException` and open-session-in-view. I name the proxy;
  10 owns what happens when the session is gone.

## Chunk plan

(see `_plan.md` in the topic directory — kept in sync)

## Files written

| File | Lines | Gotchas | Questions |
|---|---|---|---|
| `01-two-models-one-foreign-key.md` | 249 | 5 | 5 |
| `02-the-owning-side.md` | 236 | 5 | 6 |
| `02b-mappedby-and-the-silent-nothing.md` | 248 | 6 | 5 |
| `02c-keeping-both-sides-in-step.md` | 262 | 6 | 6 |
| `03-many-to-one.md` | 256 | 6 | 5 |
| `04-one-to-many-unidirectional.md` | 209 | 6 | 5 |
| `04b-mapping-it-to-a-real-foreign-key.md` | 201 | 6 | 4 |
| `05-one-to-many-bidirectional.md` | 263 | 7 | 7 |
| `06-one-to-one.md` | 235 | 6 | 5 |
| `06b-why-lazy-one-to-one-fails.md` | 233 | 6 | 6 |
| `06c-the-three-real-options.md` | 266 | 6 | 5 |
| `07-many-to-many.md` | 255 | 7 | 6 |
| `07b-model-the-join-table.md` | 275 | 6 | 5 |
| `08-cascade.md` | 230 | 7 | 6 |
| `08b-cascade-remove-and-the-hibernate-extras.md` | 243 | 7 | 6 |
| `09-orphan-removal.md` | 214 | 8 | 6 |
| `10-collection-types.md` | 236 | 7 | 6 |
| `10b-what-a-list-costs.md` | 234 | 7 | 6 |
| `10c-orderby-versus-ordercolumn.md` | 207 | 7 | 5 |
| `11-element-collection.md` | 285 | 8 | 6 |
| `12-fetch-type-defaults.md` | 248 | 7 | 7 |
| `13-eager-on-a-collection.md` | 229 | 7 | 6 |
| `13b-how-it-multiplies.md` | 218 | 7 | 5 |
| `14-what-a-lazy-association-is.md` | 242 | 8 | 6 |
| `14b-inspecting-initialization.md` | 210 | 7 | 5 |

## Verified claims

Live doc URLs (docs.jboss.org/hibernate/orm/7.4/... 301-redirects to these):

- Hibernate ORM 7.4 **Introduction**: https://docs.hibernate.org/orm/7.4/introduction/html_single/
- Hibernate ORM 7.4 **User Guide**: https://docs.hibernate.org/orm/7.4/userguide/html_single/
- Hibernate 7.4 javadocs: https://docs.hibernate.org/orm/7.4/javadocs/
- Jakarta Persistence 3.2 javadocs: https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/<lowercase-annotation>

**Fetch defaults (JPA 3.2 javadocs, quoted):**
- `@ManyToOne.fetch` — "If not specified, defaults to `EAGER`."
- `@OneToOne.fetch` — Default: `EAGER`
- `@OneToMany.fetch` — Default: `LAZY`
- `@ManyToMany.fetch` — "If not specified, defaults to `LAZY`."
- `FetchType.EAGER` — "a requirement on the persistence provider runtime that data must be eagerly fetched."
- `FetchType.LAZY` — "a hint ... The implementation is permitted to eagerly fetch data for which the `LAZY` strategy hint has been specified."
- `@ManyToOne.optional` / `@OneToOne.optional` default `true`.
- `mappedBy` javadoc: "The field that owns the relationship."
- Hibernate Intro §3.17: "A very unfortunate misfeature of JPA is that @ManyToOne associations are fetched eagerly by default. This is almost never what we want."
- Hibernate Intro §3.17: "Changes made to the unowned side of an association are never synchronized to the database."
- Hibernate Intro table 3.5 default for `mappedBy`: "By default, the association is assumed unidirectional".

**Unidirectional `@OneToMany` (UG §3.8.2 + Intro §3.21):**
- "When using a unidirectional @OneToMany association, Hibernate resorts to using a link table."
- Intro §3.21: "By default, a unidirectional one-to-many association maps to a separate association join table." Only recommended for the many-parent-types `Comment` case.
- UG: on removal, "Hibernate deletes all database rows from the link table ... and reinserts the ones that are still found in the @OneToMany collection."
- `@JoinTable` may also be used with a unidirectional `@OneToMany`.

**`@OneToOne` (UG §3.8.3 + Intro §3.18/3.19):**
- Bidirectional lazy parent side: "Hibernate cannot honor this request since it cannot know whether the association is null or not." Needs a secondary query → N+1 → prefer `@MapsId`, or enable **lazy state initialization bytecode enhancement**.
- Intro: `optional=false` on the mappedBy side removes the null question and lazy works.
- UG: more than one child row for the same parent → `org.hibernate.HibernateException: More than one row with the given identifier was found: 1` (quoted from the guide's comment).
- UG §31.4 best practices: "The parent-side @OneToOne association requires bytecode enhancement so that the association can be loaded lazily."

**`@ManyToMany`:** Intro §3.20 — "never write @ManyToMany(fetch=EAGER) unless you're deliberately looking for trouble."; "There's little downside to representing every ... logical many-to-many association using an intermediate entity." UG §31.4: "@ManyToMany ... is rarely a good choice because it treats both sides as unidirectional associations."

**Cascade (UG §6.15):** JPA `CascadeType` = ALL, PERSIST, MERGE, REMOVE, REFRESH, DETACH. JPA javadoc: `cascade=ALL` equivalent to `{PERSIST, MERGE, REMOVE, REFRESH, DETACH}`. Hibernate adds `org.hibernate.annotations.CascadeType` SAVE_UPDATE, REPLICATE, LOCK — and "CascadeType.ALL will propagate any Hibernate-specific operation".

**Collections (UG §3.9):** default classification — array→ARRAY, List→LIST, SortedSet→SORTED_SET, Set→SET, SortedMap→SORTED_MAP, Map→MAP, else Collection→BAG. `hibernate.mapping.default_list_semantics` **Default Value: CollectionClassification.BAG**, since 6.0. "Contrary to natural expectations, the ordering of a list is by default not maintained." `@OrderColumn` default column name = attribute name + `_ORDER`. `@OrderColumn` on `@ManyToMany(mappedBy=…)` is **illegal**. Unidirectional bag: "Hibernate deletes all link table rows associated with the parent entity and re-adds the remaining ones."
- `@OrderColumn`/`@MapKeyColumn` → `@ElementCollection`, owned `@ManyToMany`, owned `@OneToMany`. `@OrderBy`/`@MapKey` → unowned side. `@MapKey` names an attribute, not a column.
- `@OrderBy` with no property → orders by the child's primary key.
- `org.hibernate.loader.MultipleBagFetchException` exists in 7.4: "Exception used to indicate that a query is attempting to simultaneously fetch multiple bags".

**Proxies (Intro §5.6):** "A proxy is an object that masquerades as a real entity or collection, but doesn't actually hold any state". Gotchas listed: LazyInitializationException after session ends; `instanceof`/typecasts do not work correctly on a polymorphic proxy (`@ConcreteProxy` fixes it at the cost of extra joins); N+1. Allowed without initialising: reading the id, and `getReference` to create an association. `PersistenceUnitUtil.isLoaded` / `.load()`; `Hibernate.isInitialized` / `Hibernate.initialize` / `Hibernate.contains`.

**`org.hibernate.Hibernate` javadoc (7.4):** class desc "Various utility functions for working with proxies and lazy collection references." `isInitialized`, `initialize`, `unproxy(Object)`, `unproxy(T,Class)`, `isPropertyInitialized(Object,String)` + `(E,Attribute)`, `getClass(T)` "Get the true, underlying class of a proxied entity", and the NO-FETCH set: `contains(Collection,T)`, `size(Collection)`, `get(Map,K)`, `get(List,int)` — each javadoc'd "without fetching its state from the database". ⚠️ No `isDetached` in the 7.4 listing.

**`PersistenceUnitUtil` (JPA 3.2):** `isLoaded(Object)`, `isLoaded(Object,String)`, `getIdentifier`, `getVersion`, `load(Object)`, `load(Object,String)`. "A generated id is not guaranteed to be available until after the database insert has occurred."

**`@ConcreteProxy` (UG §3.4.9):** proxies for a hierarchy are built from the ROOT class with no subtype info → `instanceof`/casts misbehave. `@ConcreteProxy` on the hierarchy root resolves the concrete subtype; Intro says it costs extra joins and "its use is not generally recommended, except in very special circumstances."

**equals/hashCode (Intro §3.26):** do not include a mutable field; "we advise against including any database-generated field in the hashcode"; prefer a natural key; "use instanceof, not getClass() to check the type of the argument" because the argument may be a proxy.

**`@ElementCollection` (Intro §3.24):** default table = `Owner_attr` with FK + value (+ `_ORDER` for a List). Without `@Column(nullable=false)` Hibernate cannot add a primary key. Intro: "@ElementCollection is one of our least-favorite features of JPA."

**UG §31.6.1 Fetching associations (key quotes for chunks 12/13):**
- "Prior to Jakarta Persistence, Hibernate used to have all associations as LAZY by default. However, when Java Persistence 1.0 specification emerged, it was thought that not all providers would use Proxies. Hence, the @ManyToOne and the @OneToOne associations are now EAGER by default."
- "The EAGER fetching strategy cannot be overwritten on a per query basis, so the association is always going to be retrieved even if you don't need it."
- "if you forget to JOIN FETCH an EAGER association in a JPQL query, Hibernate will initialize it with a secondary statement, which in turn can lead to N+1 query issues."
- "EAGER fetching is almost always a bad choice." / "it's better if all associations are marked as LAZY by default."
- JOIN FETCH is good for at most one collection; multiple collections → cartesian product. (⚠️ hand-off to Topic 08, do not solve.)

**Link entity (UG §3.8.4 Example 3.223 + §31.4):** "it's much better to map the link table"; "Each FOREIGN KEY column will be mapped as a @ManyToOne association. On each parent-side, a bidirectional @OneToMany association is going to map to the aforementioned @ManyToOne relationship in the link entity." The guide's own link entity uses `@Id @ManyToOne` twice and implements Serializable + equals/hashCode.

**UG §6.2 bytecode enhancement** features: lazy attribute loading, in-line dirty tracking, **bidirectional association management**, internal performance optimizations.

## Owed / unconfirmed

- 🔴 **`@OneToMany` + `@JoinColumn` extra UPDATE.** The ownership split (column on the
  child table, owned by the parent's collection) IS documented — JPA 3.2 `@JoinColumn`
  javadoc + Hibernate 7.4 Envers §25 ("Hibernate doesn't generate a join table"). The
  exact generated statement sequence (insert with null FK, then update) is NOT in the
  7.4 docs. Flagged in-page in `04b` with the required "I could not confirm this against
  a primary source" wording.
- 🔴 **`@MapsId` making a `mappedBy` side lazy.** Documented: `@MapsId` shares the PK, so
  the child's id is known without a query, and the UG best-practice chapter says the
  parent-side association "becomes redundant since the child-entity can be easily fetched
  using the parent entity identifier". NOT documented: that a `mappedBy` side is
  initialised lazily purely because of `@MapsId`. Flagged in-page in `06c`.
- 🔴 **"`orphanRemoval = true` implies `CascadeType.REMOVE`."** Widely repeated; NOT
  confirmable against the JPA 3.2 javadocs or the Hibernate 7.4 docs. Flagged in-page in
  `09` with the required wording, plus the practical instruction to write both.
- Confirmed edge case (UG §6.12.1): "the semantics of orphanRemoval do not apply if the
  entity being orphaned is a new entity."
- The 7.4 docs contain no `MultipleBagFetchException` prose; only the javadoc exists
  (quoted). Will cite the javadoc, not narrative.

## Traps found while authoring

- **`docs.jboss.org/hibernate/orm/7.4/...` 301-redirects to `docs.hibernate.org/orm/7.4/...`.**
  Use `curl -L`. Plain WebFetch returns the redirect rather than following it.
- The 7.4 docs' SQL blocks are *documentation examples of generated SQL*, not runs.
  Per brief §3 I quote schema DDL as SQL source and describe statement sequences in
  prose — never as a query log.
- `04` first came in at **299 lines** (over the 296 body cap). Split on the concept
  boundary into `04` (join-table default + the Comment case) and
  `04b` (`@JoinColumn` FK strategy + the read-only hybrid). Do not merge them back.
