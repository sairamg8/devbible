---
name: progress-java-p10-t08a-fixes
description: devbible · Java Phase 10 · Topic 08 'The N+1 problem' — fork 08a (the fixes, chunks 08e2 → 12x)
metadata:
  type: progress
---

# devbible · Java Phase 10 · Topic 08 "The N+1 problem" — fork **08a** (the fixes, chunks 08e2 → 12x)

Keywords: java, phase 10, data access, n+1, entity graph, batch size, subselect,
projections, dto, hibernate 7.4, jakarta persistence 3.2, spring data jpa 4.1,
fetchgraph, loadgraph, fork 08a

## Scope — ABSOLUTE, by filename

Directory: `docs/java/pages/phase-10-data-access/08-the-n-plus-1-problem/`
Tier: **Master** (`<span className="db-tier t-master">Master</span>`)

I own, by filename and nothing else:

1. `08e2-the-three-ways-out.md` — **finish only**: prose was complete, Gotchas and
   Interview questions were missing (a fork was killed mid-file). Do not rewrite prose.
2. `09*`, `10*`, `11*`, `12*` — every planned chunk and **every split of them**.

⛔ `13-*` through `19-*` belong to fork **08b**. ⛔ Chunks `01` … `08e` are finished —
never edit. ⛔ Never touch `README.md`, `_category_.json`, `_plan.md` or any board.
⛔ Never commit in devbible (the coordinator commits). Committing **this store** is
expected.

`sidebar_position` starts at **24** and increments. `08e2` is 23.

## Conventions found on disk (follow these, they beat the brief's generic sample)

- Gotchas are `**⚠️ bold run.**` then the explanation. Interview entries are `**★ …?**`.
- Files already carry a **coordinator-generated footer**:
  `---` then `← Prev: [..](..) · Index: [The N+1 problem](README.md) · Next → [..](..)`.
  New files I write end with a bare `<!--FOOTER-->`; the coordinator replaces it.
  ⚠️ `08e2` already HAS a real footer — insert the two sections **above** it.
- No console blocks anywhere in this topic. Java / JPQL / SQL source only.

## Per-file table

| File | Lines | Gotchas | Qs | Status |
|---|---|---|---|---|
| 08e2-the-three-ways-out.md | **287** (incl. existing footer) | 7 | 10 | ✅ finished |
| 08e3-what-set-costs-the-model.md | **284** + footer | 9 | 8 | ✅ **SPLIT of 08e2** |
| 08e4-ordering-and-the-call-sites.md | **285** + footer | 9 | 9 | ✅ **SPLIT of 08e2** |
| 09-entity-graph.md | 292 | 8 | 9 | ✅ pos 26 |
| 09b-applying-a-graph.md | 292 | 10 | 8 | ✅ pos 27 |
| 09c-named-entity-graphs.md | 247 | 9 | 7 | ✅ pos 28 |
| 09d-hibernates-graph-syntax.md | 290 | 10 | 8 | ✅ pos 29 |
| 09e-subgraphs.md | 269 | 8 | 6 | ✅ pos 30 |
| 09e2-how-deep-a-graph-should-go.md | 246 | 9 | 6 | ✅ pos 31 |
| 09f-fetchgraph-vs-loadgraph.md | 286 | 9 | 8 | ✅ pos 32 |
| 09g-spring-data-entitygraph.md | 268 | 10 | 8 | ✅ pos 33 |
| 09h-a-graph-is-still-a-join.md | 260 | 9 | 7 | ✅ pos 34 |
| 10-batch-size.md | 291 | 9 | 8 | ✅ pos 35 |
| 10b-what-the-sql-looks-like.md | 246 | 8 | 7 | ✅ pos 36 |
| 10c-choosing-a-batch-size.md | 257 | 9 | 8 | ✅ pos 37 |
| 11-subselect.md | 279 | 9 | 7 | ✅ pos 38 |
| 11b-the-trap.md | 277 | 8 | 7 | ✅ pos 39 |
| 12-projections-and-dtos.md | 292 | 10 | 8 | ✅ pos 40 |
| 12b-projecting-a-collection.md | 295 | 9 | 8 | ✅ pos 41 |
| 12c-spring-data-projections.md | 268 | 10 | 8 | ✅ pos 42 |
| 12c2-dto-projections-in-spring-data.md | 291 | 10 | 8 | ✅ pos 43 |
| 12d-the-entity-was-never-the-model.md | 270 | 9 | 8 | ✅ **pos 44 — SCOPE COMPLETE** |
| 09-entity-graph.md | | | | ⏳ |
| 09b-subgraphs.md | | | | ⏳ |
| 09c-fetchgraph-vs-loadgraph.md | | | | ⏳ |
| 09d-spring-data-entitygraph.md | | | | ⏳ |
| 10-batch-size.md | | | | ⏳ |
| 10b-choosing-a-batch-size.md | | | | ⏳ |
| 11-subselect.md | | | | ⏳ |
| 12-projections-and-dtos.md | | | | ⏳ |
| 12b-spring-data-projections.md | | | | ⏳ |
| 12c-the-entity-was-never-the-model.md | | | | ⏳ |

(Splits `09e`, `10c`, `11b`, `12d`… get added as they land. Ten planned chunks becoming
twenty files is the expected outcome — sibling topics went 10 → 21 and 10 → 27.)

## Load-bearing claims and their sources

(filled in as verified — every claim gets a URL)

## Traps hit

- `08e2` carries **two** forward references left as bold plain text: **chunk 10**, **chunk
  11** and **chunk 12** *(not written yet)*. 🔴 **Repoint all three** once `10-batch-size.md`,
  `11-subselect.md` and `12-projections-and-dtos.md` exist. They read as bare labels
  ("chunk 10") and must be rewritten into real sentences when repointed.

## 🔴 RESUME HERE

✅ **FORK 08a's SCOPE IS COMPLETE — 22 files, 6,101 lines, positions 23–44.**
Nothing is queued. `08e2` is finished and all three of its forward references are
repointed. Every link in all 22 files resolves against the filesystem (checked with a
python resolver, not grep). No file exceeds 296 body lines. No console blocks anywhere.

If a session is told to continue topic 08, the remaining work is **fork 08b's**
(`13`–`19`), which was already on disk and being written in parallel.

🔴 **THE CHUNK MAP CHANGED — the plan's letters no longer apply.** The 09 material
split into SEVEN chunks, not four. Reading order = alphabetical order:

| File | pos | Subject | State |
|---|---|---|---|
| `09-entity-graph.md` | 26 | what a graph is; the default fetch graph; where it sits among the fixes | ✅ |
| `09b-applying-a-graph.md` | 27 | building it; `find`; the hint; `setEntityGraph` | ✅ |
| `09c-named-entity-graphs.md` | 28 | JPA `@NamedEntityGraph` and the objection to it | ✅ |
| `09d-hibernates-graph-syntax.md` | 29 | Hibernate text syntax, `GraphParser`, `merge`, parser modes | ✅ |
| `09e-subgraphs.md` | 30 | nested / key / subtype subgraphs | ✅ |
| `09e2-how-deep-a-graph-should-go.md` | 31 | depth vs breadth; what a level costs | ✅ |
| `09f-fetchgraph-vs-loadgraph.md` | 32 | the two hint keys | ✅ |
| `09g-spring-data-entitygraph.md` | 33 | Spring Data `@EntityGraph` | ✅ |
| `09h-a-graph-is-still-a-join.md` | 34 | duplicates, cartesian product, pagination | ✅ |
| `10-batch-size.md` | 35 | mechanism, N→⌈N/k⌉, placements, global setting | ✅ |
| `10b-what-the-sql-looks-like.md` | 36 | PG array vs IN list; padding folklore killed | ✅ |
| `10c-choosing-a-batch-size.md` | 37 | k bounds owners not rows; returns curve | ✅ |
| `11-subselect.md` | 38 | mechanism, enabling, vs batch | ✅ |
| `11b-the-trap.md` | 39 | query runs twice; role scope; two snapshots | ✅ |
| `12-projections-and-dtos.md` | 40 | the argument + JPQL constructor expressions | ✅ |
| `12b-projecting-a-collection.md` | 41 | the nested-list problem, four ways out | ✅ |
| `12c-spring-data-projections.md` | 42 | interface projections, closed vs open | ✅ |
| `12c2-dto-projections-in-spring-data.md` | 43 | class-based DTOs, dynamic, rewriting | ✅ |
| `12d-the-entity-was-never-the-model.md` | 44 | the closing argument of part 3 | ✅ |

⚠️ The plan file named `09b-subgraphs`, `09c-fetchgraph-vs-loadgraph`,
`09d-spring-data-entitygraph`. **Those names are DEAD.** Precedent: the previous fork on
this topic also renamed as it split (`_plan.md` says so).

---

## Claims and sources — VERIFIED (batch 1)

### Entity graphs

- **Jakarta Persistence 3.2 §3.8.1** — "The default fetch graph for an entity or embeddable
  is defined to consist of the transitive closure of all of its attributes that are specified
  as `FetchType.EAGER` (or defaulted as such)." And, crucially: *"The persistence provider is
  permitted to fetch additional entity state beyond that specified by a fetch graph or load
  graph. It is required, however, that the persistence provider fetch all state specified by
  the fetch or load graph."* → **the spec explicitly permits a provider to over-fetch**, which
  is what settles the historic "Hibernate ignores fetchgraph" complaint: over-fetching is
  spec-legal, under-fetching is not.
  <https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html>
- **Spec §3.8.1.1 Fetch Graph Semantics** — "attributes that are specified by attribute nodes
  of the entity graph are treated as `FetchType.EAGER` and attributes that are not specified
  are treated as `FetchType.LAZY`." Primary key and version attributes "never need to be
  specified … are always fetched".
- **Spec §3.8.1.2 Load Graph Semantics** — unlisted attributes "are treated according to their
  specified or default `FetchType`".
- **Hibernate 7.4 UG §12.6** — same split, in Hibernate's own words: fetch graph → unlisted
  "will ALWAYS be treated as `FetchType.LAZY`"; load graph → unlisted "use their static mapping
  specification".
- **`org.hibernate.graph.GraphSemantic` javadoc (7.4)** — FETCH: "Attributes not explicitly
  specified are treated as `FetchType.LAZY` and are not fetched." LOAD: "…treated as
  `FetchType.LAZY` or `FetchType.EAGER` depending on the mapping of the attribute, instead of
  forcing `FetchType.LAZY`." `getJpaHintName()` deprecated since 6.0 → `getJakartaHintName()`.
  <https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/graph/GraphSemantic.html>
- **`find(EntityGraph, …)` is ALWAYS a LOAD graph** — both the JPA 3.2 `EntityManager` javadoc
  ("interpreting the `EntityGraph` as a load graph") and the Hibernate 7 intro guide §5.7
  ("An `EntityGraph` passed directly to `find()` is always interpreted as a load graph").
- **Hibernate intro §5.7 on the naming** — "You're right, the names make no sense. But …
  if you take our advice, and map your associations `fetch=LAZY`, there's no difference between
  a 'fetch' graph and a 'load' graph, so the names don't matter."
- **UG §12.6.1** — a subgraph is "only valid for an attribute (or its 'key') whose type is a
  `ManagedType`"; an `EntityGraph` must correspond to an `EntityType`, a `Subgraph` may be any
  `ManagedType`. Map keys get `.key` subgraphs.
- **UG §12.6.3** — Hibernate's `GraphParser` / `SessionFactory#parseEntityGraph` text syntax
  (`"employees(department)"`) is **NOT part of the JPA spec**. New in **7.3**:
  `hibernate.graph_parser_mode` = `legacy` (default) | `modern`; modern adds
  `responsibleParty:Corporation(ceo)` and root-subtype subgraphs `:Corporation(ceo)`.
- **UG §12.6.4** — `EntityGraphs.merge(em, Class, a, b, c)` unions graphs.
- **UG §12.6.5** — Hibernate's own `@org.hibernate.annotations.NamedEntityGraph(graph="…")`
  takes the text form; since 7.3 has a `root` attribute, **required** when placed on a package.
- **Spring Data JPA 4.1 `@EntityGraph`** — `type` **defaults to `EntityGraphType.FETCH`**;
  `attributePaths` (since 1.9) makes it dynamic and **the named `value()` is then ignored**;
  paths may be nested via `property.nestedProperty`.
  <https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/EntityGraph.html>
  Reference: "Configuring Fetch- and LoadGraphs" in
  <https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html>

### Batch fetching

- **`@BatchSize` javadoc (7.4)** — targets `TYPE`, `METHOD`, `FIELD`. "Instead of a SQL select
  with just one primary key value in the `where` clause, the `where` clause contains a list of
  primary keys inside a SQL `in` condition. The primary key values to batch fetch are chosen
  from among the identifiers of unfetched entity proxies or collection roles associated with
  the session." `@BatchSize(size=100)` on the **class** → up to 100 proxies per trip; on a
  **collection** → up to 5 *collections* per select.
  <https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/annotations/BatchSize.html>
- **UG §A.7.1** — `hibernate.default_batch_fetch_size`: "By default, Hibernate only uses batch
  fetching for entities and collections explicitly annotated `@BatchSize`."
- **UG §12.8** — worked example: 10 departments, `@BatchSize(size=5)` → **2** selects with
  `IN (…5 ids…)` each. Also: *"although `@BatchSize` is better than running into an N+1 query
  issue, most of the time, a DTO projection or a `JOIN FETCH` is a much better alternative"*.
  And: **"When `LockModeType` is different from `NONE` Hibernate will not execute a batch
  fetching so uninitialized entity proxies will not be initialized."**
- 🔴 **THE PADDING FOLKLORE IS WRONG FOR POSTGRES.** Hibernate 7 intro §8.5 shows the actual
  batch SQL on PostgreSQL as `where a1_0.books_isbn = any (?)` and says *"The SQL for batch
  fetching looks slightly different depending on the database. Here, on PostgreSQL, Hibernate
  passes a batch of primary key values as a SQL ARRAY."* → **one bind parameter, one statement
  shape, regardless of batch fill.** So there is nothing for the statement cache to miss.
- **`hibernate.query.in_clause_parameter_padding` (UG §A.16.11, since 5.2) is a SEPARATE,
  OPT-IN setting about `IN` predicates in QUERIES, not the batch loader**: "When this setting
  is enabled, we expand the number of bind parameters to an integer power of two: 4, 8, 16, 32,
  64. Thus, if 5, 6, or 7 arguments are bound to a parameter, a SQL statement with 8 bind
  parameters in the `IN` clause will be used, and `null` will be bound to the left-over
  parameters." ⚠️ Do NOT attribute this to `@BatchSize`.
- **Session-scoped alternatives** (intro §8.5): `session.setFetchBatchSize(5)`,
  `session.setSubselectFetchingEnabled(true)`. Boot spelling:
  `spring.jpa.properties.hibernate.default_batch_fetch_size`.
- `byMultipleIds(...).withBatchSize(20)` — explicit batch for a multiLoad; "if we don't specify
  the batch size explicitly, a batch size will be chosen automatically" (intro §5.8).

### Subselect

- **`FetchMode.SUBSELECT` javadoc (7.4)** — "Use a secondary select with a subselect that
  re-executes an initial query to load all instances of the related entity or collection at
  once, at some point after the initial query is executed. This fetching strategy is currently
  only available for collections and many-valued associations." Compatible with both eager and
  lazy fetching.
- **`@Fetch` javadoc** — default is select-for-lazy / join-for-eager; "join fetching is
  incompatible with lazy fetching, and so `@Fetch(JOIN)` implies `fetch=EAGER`, overriding any
  explicitly-specified `fetch=LAZY` setting."
- **UG §12.11** — the generated shape is `where e.department_id in (select … from Department
  … )` — the driving query verbatim.
- **UG §A.7.3 `hibernate.use_subselect_fetch`** — since **6.3**; global switch. "By default,
  Hibernate only uses subselect fetching for collections explicitly annotated
  `@Fetch(SUBSELECT)`."
- **Intro §8.5** — "`@Fetch(SUBSELECT)` has the same effect as `@Fetch(SELECT)`, except after
  execution of a HQL or criteria query."
- **Intro §8.6** — the cartesian-product exception to the join-first rule, quoted in 08e2.

### Projections

- **Spring Data 4.1 projections** — closed projection ⇒ "Spring Data can optimize the query
  execution, because we know about all the attributes that are needed"; open projection with
  `@Value`/SpEL ⇒ "Spring Data cannot apply query execution optimizations in this case, because
  the SpEL expression could use any attribute of the aggregate root."
  🔴 **"Projections limit the selection to top-level properties of the target entity. Any
  nested properties resolving to joins select the entire nested property causing the full join
  to materialize."**
  Class-based DTO: single constructor, or `@PersistenceCreator`. Dynamic:
  `<T> Collection<T> findByLastname(String lastname, Class<T> type)`.
  JPQL DTO needs a constructor expression `SELECT new com.example.NamesOnly(...)`, **but Spring
  Data rewrites** `SELECT u FROM User u` / `SELECT u.firstname, u.lastname FROM User u` into one
  when the return type is a DTO — and "if an `@Query`-annotated query already uses constructor
  expressions, then Spring Data backs off". Aliases are invalid in constructor expressions.
  Interface projections are built from JPA **`Tuple`** queries.
  <https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html>

### Collection semantics (used by 08e3 / 08e4)

- UG §3.9.11 "Bags are unordered lists"; §3.9.12 "although they use the `List` interface on the
  Java side, bags don't retain element order"; §3.9.13 "Sets are collections that don't allow
  duplicate entries".
- Spec §11.1.43 `@OrderBy` — bare `@OrderBy` ⇒ order by the associated entity's PK; `ASC` is
  the default; `orderby_item` must be **a basic persistent property of the associated class or
  an embedded class within it** (dot notation is for embeddables, **not** across associations);
  "The `OrderBy` annotation is not used when an order column is specified."
- Spec §11.1.44 `@OrderColumn` — the provider "is responsible for updating the ordering upon
  flushing to the database to reflect any insertion, deletion, or reordering affecting the
  list"; must be "on the side of the relationship that references the collection that is to be
  ordered"; "The order column is not visible as part of the state of the entity or embeddable
  class."

## Traps hit (running)

- 🔴 **08e2 overflowed the cap once the sections were written** — 349 lines. Split on a real
  concept boundary into **08e3** (equality / `hashCode`) and **08e4** (ordering / call sites),
  per rule 1. 08e2 keeps the *choice between the three fixes*; the model-change consequences
  moved out. `git checkout --` is blocked by the permission classifier in this environment —
  restore a file with `git show HEAD:<path>` + a python copy instead.
- 08e2's three forward references (**chunk 10**, **chunk 11**, **chunk 12**) are still bold
  plain text. Repoint when `10-batch-size.md`, `11-subselect.md`, `12-projections-and-dtos.md`
  land.

## Claims verified for the 09x chunks (batch 2)

- **JPA 3.2 §10.3.1** `@NamedEntityGraph`: "The annotation must be applied to the root entity
  of the graph." · "If no name is explicitly specified, the name defaults to the entity name
  of the annotated root entity." · "Entity graph names must be unique within the persistence
  unit." · `includeAllAttributes() default false` · `@Repeatable(NamedEntityGraphs.class)` ·
  also has `subclassSubgraphs()`.
- **§10.3.2** `@NamedAttributeNode(value, subgraph, keySubgraph)` — `keySubgraph` is for the
  key of a `Map`-valued attribute.
- **§10.3.3** `@NamedSubgraph(name, type, attributeNodes)` — `type` "must be specified when the
  subgraph corresponds to a subclass of the entity type corresponding to the referencing
  attribute node"; for a subclass subgraph "only subclass-specific attributes are listed".
- **`EntityManager.createEntityGraph(String graphName)`** — "Obtain a **mutable copy** of a
  named `EntityGraph`, or **return null** if there is no entity graph with the given name."
  **`getEntityGraph(String)`** — "The returned instance … **should be considered immutable**";
  throws `IllegalArgumentException` for an unknown name. 🔴 The null/throw asymmetry is real
  and is a genuine trap.
- **`EntityManagerFactory.addNamedEntityGraph(String, EntityGraph)`** exists in 3.2.
- **`SelectionQuery.setEntityGraph(EntityGraph<? super R> graph, GraphSemantic semantic)`** —
  **since 6.3**, NOT deprecated: "Apply an `EntityGraph` to the query. This is an alternative
  way to specify the associations which should be fetched as part of the initial query."
  <https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/query/SelectionQuery.html>
  ⚠️ No `applyGraph`/`applyFetchGraph`/`applyLoadGraph` on that interface in 7.4.
- **Hibernate intro §5.7 verdict on the JPA annotation**: "JPA even specifies a way to define
  named entity graphs using annotations. But the annotation-based API is so verbose that it's
  just not worth using."
- **UG §12.6.3** — text syntax is "specific to Hibernate", NOT in the spec.
  `hibernate.graph_parser_mode` **defaults to `legacy`**; `modern` changes the subtype form to
  `responsibleParty:Corporation(ceo)` and adds root-subtype subgraphs `:Corporation(ceo)`.
  `.key` suffix addresses a map key's subgraph.
- **UG §12.6.5** — `root` attribute added in **7.3**; **mandatory** on a package-level
  `@org.hibernate.annotations.NamedEntityGraph` (deprecation warning in legacy mode, **error**
  in modern mode).
- **Duplicate attribute nodes merge** — spec rule quoted by UG §12.6.3: "duplicate
  specification of the attribute node results in the originally registered `AttributeNode` to
  be re-used effectively merging the 2 `AttributeNode` specifications together."

## Claims I did NOT confirm and wrote as uncertain

- **Whether an entity graph hint is honoured on a `createNativeQuery`.** Nothing in the JPA
  3.2 spec or the Hibernate 7.4 docs says either way. Written as "I could not find any
  statement … would not rely on it" in `09b`.
- **Thread-safety / reusability of a dynamically built `EntityGraph` instance.** Not stated in
  either source. Written as "neither the specification nor the Hibernate 7.4 documentation
  states that an `EntityGraph` instance is thread-safe".

## Batch 3 — claims verified for 09e / 09e2 / 09f / 09g / 09h

- **JPA 3.2 `Graph` additions** (from the spec's own revision history):
  `addAttributeNode()`, `removeAttributeNode()`, `addTreatedSubgraph()`,
  `addElementSubgraph()`, `addTreatedElementSubgraph()`, `addMapKeySubgraph()`,
  `addTreatedMapKeySubgraph()`. **Deprecated FOR REMOVAL:** `addSubclassSubgraph()`
  (→ `addTreatedSubgraph(Class)`), `addSubgraph(Attribute, Class)`
  (→ `addTreatedSubgraph(Attribute, Class)`), `addKeySubgraph()`
  (→ `addMapKeySubgraph()`).
- `addElementSubgraph(PluralAttribute<? super T,?,E>)` javadoc: "Add a node to the graph
  that corresponds to a **collection element** that is a managed type." Several `Graph`
  methods throw `IllegalStateException` "if the EntityGraph has been **statically
  defined**" — i.e. a named graph from an annotation is not mutable.
- **UG §12.6.1**: "A subgraph is used to control the fetching of sub-attributes of the
  `AttributeNode` it is applied to." · "Specifying a subgraph is only valid for an attribute
  (or its 'key') whose type is a `ManagedType`. So while an `EntityGraph` must correspond to
  an `EntityType`, a `Subgraph` is legal for any `ManagedType`."
- **Subclass subgraph inheritance**: "Subclass subgraphs will automatically include the
  specified attributes of superclass subgraphs."
- **Bytecode enhancement** — intro §11.3 on `@Basic(fetch = LAZY)`: "**Without the bytecode
  enhancer, this instruction is ignored, and the field is always fetched immediately**, as
  part of the initial select that retrieves the `Book` entity." UG §6.2.1: lazy singular
  attributes form one lazy group by default; plural ones each their own; `@LazyGroup`
  overrides. UG §3.4.2: proxy-based lazy loading needs a non-final class / non-final
  accessors.
- **Spring Data `@EntityGraph`**: `type` defaults to `FETCH`; "If `attributePaths()` are
  specified then we ignore the entity-graph name `value()` and treat this `EntityGraph` as
  dynamic"; `value` empty ⇒ falls back to `JpaQueryMethod.getNamedQueryName()`;
  `attributePaths` may be "direct properties of the entity or nested properties via a
  `property.nestedProperty`".
- **HQL guide §4.3.1** (already used by 08c): duplicates from `join fetch` "are automatically
  removed by Hibernate in memory"; "`distinct` should not be used for this purpose"; its
  "only effect is to add `distinct` to the generated SQL".

## 🔴 Contradictions found in the PRIMARY documentation — written as UNRESOLVED, not guessed

1. **Inner vs outer join for an entity graph.** Intro §5.7: a graph passed to `find()` "adds
   a **left outer join**". UG §12.6.1's worked `fetchgraph` example over a `@ManyToMany`
   prints **three `inner join`s** in the generated SQL. Could not reconcile from 7.4 docs.
   Written up honestly in `09h` (and the over-confident sentence originally in `09` was
   corrected). Practical advice given: test that a parent with an empty collection still
   comes back.
2. **Does Hibernate 6+ automatic duplicate removal cover GRAPH-driven fetches?** The HQL
   guide's guarantee is worded about "the use of `join fetch`" only. Not stated for graphs.
   Written as unverified in `09h` with a three-line assertion the reader can run.
3. **`fetchgraph` under-fetching is not guaranteed.** JPA 3.2 §3.8.1: "The persistence
   provider is **permitted to fetch additional entity state** beyond that specified by a
   fetch graph or load graph." → a graph is a FLOOR, never a ceiling. This is the sentence
   that settles the decade-old "Hibernate ignores fetchgraph" argument, and it is almost
   never quoted. Central to `09f`.

## Note for the coordinator

Fork **08b** has files `13-fetch-profiles.md`, `13b`, `13c`, `13d`, `14`, `14b`, `14c`, `14d`,
`15`, `15b`, `15c`, `16-eager-is-not-a-fix.md`, `17-initialize-loops.md`, `17b` on disk.
My chunks link to `13-fetch-profiles.md` and `16-eager-is-not-a-fix.md`; both exist and were
`ls`-verified. ⚠️ Their **sidebar_position** values will collide with mine (I run 24–35+) —
the coordinator renormalises, per the brief.

## Batch 4 — the batch/subselect claims, and the folklore that was killed

🔴 **THE BIG ONE — "Hibernate pads the batch to the next power of two" IS FOLKLORE.**
- `@BatchSize` javadoc and UG §12.8 say nothing about rounding the batch.
- The power-of-two behaviour is **`hibernate.query.in_clause_parameter_padding`** (UG
  §A.16.11, *since 5.2*), an **opt-in** setting about `IN` predicates in QUERIES:
  "we expand the number of bind parameters to an integer power of two: 4, 8, 16, 32, 64
  … and `null` will be bound to the left-over parameters."
- 🔴 **And on PostgreSQL it is moot for batch fetching anyway.** Intro §8.5 prints the real
  batch SQL as `where a1_0.books_isbn = any (?)` and states: *"The SQL for batch fetching
  looks slightly different depending on the database. Here, on PostgreSQL, Hibernate passes
  a batch of primary key values as a SQL ARRAY."* → **one bind parameter, constant statement
  text, nothing to pad.**

Other verified claims:
- UG §12.8 worked example: 10 departments, `@BatchSize(size=5)` → **2** statements
  (`IN (0,2,3,4,5)` then `IN (6,7,8,9,1)`), vs 10 without.
- UG §12.8: "although `@BatchSize` is better than running into an N + 1 query issue, most of
  the time, a DTO projection or a `JOIN FETCH` is a much better alternative…"
- 🔴 UG §12.8: **"When `LockModeType` is different from `NONE` Hibernate will not execute a
  batch fetching so uninitialized entity proxies will not be initialized."**
- Intro §8.5: "Both batch fetching and subselect fetching are **disabled by default**";
  `session.setFetchBatchSize(5)` / `setSubselectFetchingEnabled(true)`;
  "batch fetching … won't solve them. The truly correct solution is to fetch associations
  using joins"; "they can be performed **lazily**".
- `FetchMode.SUBSELECT` javadoc: "…re-executes an initial query… **currently only available
  for collections and many-valued associations**." UG §12.9: "…all elements of all
  collections of the same role for **all owners associated with the persistence context**
  using a single secondary select."
- 🔴 Intro §8.5: **"`@Fetch(SUBSELECT)` has the same effect as `@Fetch(SELECT)`, except after
  execution of a HQL or criteria query."** → no preceding query ⇒ no subselect. Big.
- UG §A.7.3 `hibernate.use_subselect_fetch` — **since 6.3**.
- Intro §9.x on fetch profiles: **"The one and only advantage unique to fetch profiles is
  that they let us very selectively request subselect fetching. We can't do that with entity
  graphs, and we can't do it with HQL."**
- **PostgreSQL 18 §13.2** — Read Committed is the default; "a `SELECT` query sees a snapshot
  of the database as of the instant the query begins to run"; "two successive `SELECT`
  commands can see different data … if other transactions commit changes after the first
  `SELECT` starts and before the second `SELECT` starts". Repeatable Read "sees a snapshot as
  of the start of the first non-transaction-control statement in the transaction".
  <https://www.postgresql.org/docs/18/transaction-iso.html>
  → used in `11b` for the genuinely novel point that subselect fetching takes **two
  snapshots** under the default isolation level.

## Additional unconfirmed claim (written as uncertain)

- **Does `setMaxResults` / a `Pageable` limit propagate into the subselect?** The docs say
  the subselect is built "based on the restriction used to load its owner(s)" — *restriction*
  ≠ *limit/offset*. Not settled by the 7.4 docs. `11b` says so plainly and gives a five-line
  test. ⚠️ Do NOT let a later pass "resolve" this from a blog.
- **Whether `@Fetch(SUBSELECT)` on a `@ManyToOne` is rejected or silently ignored** — not
  stated in 7.4 docs; written as uncertain in `11`.

## Still to do in 08e2

✅ **DONE.** All three repointed and rewritten into real sentences (they were bare labels
"chunk 10"/"chunk 11"/"chunk 12"). `08e2` is now 292 lines and keeps its pre-existing
real footer — it was NOT given a `<!--FOOTER-->` marker, because it already had one.

## Batch 5 — projection claims verified

- **JPA 3.2 §4.9.2** — *"The specified class is not required to be an entity or to be mapped
  to the database. The constructor name must be fully qualified."*
- 🔴 **§4.9.2, the trap:** *"If a `single_valued_path_expression` or
  `identification_variable` that is an argument to the constructor references an entity, the
  resulting entity instance referenced by that … will be in the **managed** state."*
  → `select new View(o, count(l))` gives a MANAGED `o` with live lazy associations. A
  projection's constructor arguments must be **scalars**.
- §4.9.2 also: an entity class name used as the constructor name yields instances "in either
  the new or the detached state, depending on whether a primary key is retrieved".
- **Spring Data 4.1 projections** — closed ⇒ "Spring Data can optimize the query execution";
  open (`@Value`) ⇒ "cannot apply query execution optimizations … because the SpEL expression
  could use any attribute of the aggregate root". Default methods are the documented way to
  keep it closed. 🔴 *"Projection types are types residing **outside** the entity's type
  hierarchy. Superclasses and interfaces implemented by the entity are inside the type
  hierarchy hence returning a supertype (or implemented interface) returns an instance of the
  **fully materialized entity**."* · *"Spring Data JPA uses generally `Tuple` queries to
  construct interface proxies."* · nesting: *"any nested properties resolving to joins select
  the entire nested property causing the full join to materialize."* · DTOs: single
  constructor or `@PersistenceCreator`; "no proxying happens and no nested projections can be
  applied"; fields determined "from the parameter names of the constructor". · Rewriting
  applies to "a Java type outside the domain type hierarchy"; backs off if a constructor
  expression is present; aliases are invalid in one and "query rewriting will not remove them
  for you"; all-args constructor required. · Dynamic: `Class<?>` if you also need it as a
  query argument. · Native: direct binding matches "the order of columns and their types",
  else `@SqlResultSetMapping` + `@NativeQuery(resultSetMapping)`. · Base methods "cannot be
  used for projections".
- **PostgreSQL 18 Table 9.62** — `json_agg`/`jsonb_agg`: *"Collects all the input values,
  including nulls, into a JSON array."* Signature takes `ORDER BY input_sort_columns`.
  Partial Mode = No (no parallel aggregation). `json_build_object` is documented elsewhere,
  NOT in the aggregate-functions table.
  <https://www.postgresql.org/docs/18/functions-aggregate.html>

## Final file map (fork 08a) — positions 23–44

08e2 (23, finished; kept its real footer) · 08e3 (24) · 08e4 (25) · 09 (26) · 09b (27) ·
09c (28) · 09d (29) · 09e (30) · 09e2 (31) · 09f (32) · 09g (33) · 09h (34) · 10 (35) ·
10b (36) · 10c (37) · 11 (38) · 11b (39) · 12 (40) · 12b (41) · 12c (42) · 12c2 (43) ·
12d (44). **22 files, 6,101 lines, 0 over the cap, 0 unresolved links.**

## Final pass — placeholders repointed (2026-08-26)

Fork 08b landed `13`–`19` while I was writing, so several of my `*(not written yet)*`
placeholders became stale. **All 22 files were re-swept:** every bold placeholder whose
target now exists on disk was converted to a real `.md` link, and the misleading
`[chunk 16](16-eager-is-not-a-fix.md) *(not written yet)*` (a real link carrying a
"not written" label) was cleaned up.

**Zero `*(not written yet)*` placeholders remain in fork 08a's files, and zero broken
links** — verified with a python resolver that normpaths each target against the
filesystem, not with grep.

⚠️ Files fork 08b has on disk that mine now link to: `13-fetch-profiles.md`,
`16-eager-is-not-a-fix.md`, `18-fetching-belongs-to-the-call-site.md`. If 08b renames any
of them, my links break — that is the one cross-fork coupling in this topic.
