---
name: progress-java-p10-t08-nplus1
description: devbible Java Phase 10 Topic 08 · The N+1 problem — Master tier, chunk progress, verified claims and the Hibernate 7.4 pagination fix nobody on the web knows about
metadata:
  type: project
---

# Java P10 · Topic 08 · The N+1 problem

Directory: `docs/java/pages/phase-10-data-access/08-the-n-plus-1-problem/`
Tier: **Master**. Spine: JDK 25 · Boot 4.1.0 · Spring Framework 7.0.8 · Hibernate ORM
7.4.1 (docs read at 7.4.6.Final) · Jakarta Persistence 3.2 · Spring Data JPA 4.1.0 · PG 18.

## Boundary
- **06** owns persistence context, entity states, dirty checking, flush, `@Id` generation.
- **07** owns mappings — owning side, `mappedBy`, cascade, fetch-type *defaults*.
- **08 (me)** owns the query explosion and **every fix**.
Topics 06, 07 and all of phase 10 except **01-jdbc** and **04-spring-transactional** are
not on disk → bold plain text with *(not written yet)*.

## 🔴🔴 THE HEADLINE FINDING — Hibernate 7.4 fixed pagination + collection fetch join

Every blog, every StackOverflow answer, and every older Hibernate doc says pagination with
a collection `join fetch` forces an in-memory limit and logs `HHH000104`. **Both halves are
now wrong.**

1. **The message ID is no longer `HHH000104`.** In 7.4 it is declared in
   `org.hibernate.query.QueryLogging` (`@MessageLogger(projectCode = "HHH")`,
   `@ValidIdRange(min = 90003001, max = 90003500)`):
   `@LogMessage(level = WARN) @Message(value = "firstResult/maxResults specified with
   collection fetch; applying in memory", id = 90003004)
   void firstOrMaxResultsSpecifiedWithCollectionFetch();`
   → the code is **`HHH90003004`**, level **WARN**, and there is **no trailing `!`**.
   Source: raw.githubusercontent.com/hibernate/hibernate-orm/7.4/hibernate-core/src/main/
   java/org/hibernate/query/QueryLogging.java
2. **7.4 removed the in-memory fallback entirely on capable databases.** *What's New in
   7.4* (7.4.6.Final): "It is now perfectly safe to combine a HQL `limit` or pagination
   using `setMaxResults()` with a collection `join fetch`, on any database which supports
   limits and offsets inside subqueries (which includes all the supported databases except
   Sybase ASE). Similarly, it's now safe to use a collection `join fetch` with
   `getResultStream()` or `scroll()`. In Hibernate 6, and in previous versions of Hibernate
   7, the combination of limits/pagination with a many-valued fetch join forced Hibernate
   to fall back to applying the limit *in the JVM*, which usually exhibited terrible
   performance characteristics. This problem is finally solved. To recover the previous
   behavior, using the query hint `org.hibernate.limitInMemory`."
   https://docs.hibernate.org/orm/7.4/whats-new/whats-new.html
   7.4 Migration Guide, *Limits and fetch joins*: "When pagination or a limit is used with
   a query which fetches a collection, the limit is now processed as part of the SQL query.
   To recover the previous behavior, set the query hint `org.hibernate.limitInMemory`."
   https://docs.hibernate.org/orm/7.4/migration-guide/migration-guide.html
3. HQL guide §4.5.1: "Limiting isn't a well-defined relational operation, and must be used
   with care. **Prior to Hibernate 7.4**, limits didn't play well with many-valued fetch
   joins. This problem is now fixed on any database that supports limits and offsets in
   subqueries. But when a limit or pagination is combined with a fetch join to a collection
   on a database which doesn't support this (notably, Sybase ASE), Hibernate must retrieve
   all matching results from the database and apply the limit in memory!"
   https://docs.hibernate.org/orm/7.4/querylanguage/html_single/Hibernate_Query_Language.html
4. `hibernate.query.fail_on_pagination_over_collection_fetch` still exists in
   `org.hibernate.cfg.QuerySettings` (since 5.2), `@settingDefault false`. Its javadoc in
   7.4 is now conditioned: "When pagination is used in combination with a `fetch join`
   applied to a collection or many-valued association, **and the database does not support
   `LIMIT` inside a subquery**, the limit must be applied in-memory instead of on the
   database. This typically has terrible performance characteristics and should be avoided.
   When enabled, this setting specifies that an exception should be thrown for any query
   which would result in the limit being applied in-memory."

## Other verified claims

- **DISTINCT** — HQL guide §4.3.1: "The `distinct` keyword helps remove duplicate results
  from the query result list. **Its only effect is to add `distinct` to the generated
  SQL.** … **As of Hibernate 6, duplicate results arising from the use of `join fetch` are
  automatically removed by Hibernate in memory**, after reading the database results and
  materializing entity instances as Java objects. It's no longer necessary to remove
  duplicate results explicitly, and, in particular, `distinct` should not be used for this
  purpose." ⇒ `hibernate.query.passDistinctThrough` is **gone from `QuerySettings` in
  7.4** (grepped the file; no `distinct` hit at all).
- **`MultipleBagFetchException`** — `org.hibernate.loader.MultipleBagFetchException`,
  extends `HibernateException`. Message built as
  `"cannot simultaneously fetch multiple bags: " + bagRoles`. Javadoc: "Exception used to
  indicate that a query is attempting to simultaneously fetch multiple bags". Exposes
  `getBagRoles()`.
- **The rule of thumb** — Intro §8.4 Association fetching: "explicitly specify all the data
  you're going to need right at the start of a session/transaction, and fetch it
  immediately in one or two queries, and only then start navigating associations between
  persistent entities." And: "Without question, the most common cause of poorly-performing
  data access code in Java programs is the problem of N+1 selects." … "This isn't a bug or
  limitation of Hibernate; this problem even affects typical handwritten JDBC code behind
  DAOs. Only you, the developer, can solve this problem, because only you know ahead of
  time what data you're going to need in a given unit of work."
- **Three strategies** (Intro §8.4): outer join fetching / batch fetching / subselect
  fetching. "Of these, you should almost always use outer join fetching."
- **Batch/subselect are both disabled by default** (Intro §8.5, Table 8.6):
  `hibernate.default_batch_fetch_size` (alternatives `@BatchSize()`,
  `setFetchBatchSize()`); `hibernate.use_subselect_fetch` = true (alternatives
  `@Fetch(SUBSELECT)`, `setSubselectFetchingEnabled()`). Session-level:
  `session.setFetchBatchSize(5)`, `session.setSubselectFetchingEnabled(true)`.
  `org.hibernate.cfg.FetchSettings`: `DEFAULT_BATCH_FETCH_SIZE` javadoc — "By default,
  Hibernate only uses batch fetching for entities and collections explicitly annotated
  `@BatchSize`." `USE_SUBSELECT_FETCH` (@since 6.3) — "By default, Hibernate only uses
  subselect fetching for collections explicitly annotated `@Fetch(SUBSELECT)`."
- 🔴 **Batch fetching does not solve N+1** (Intro §8.5): "While batch fetching might
  mitigate problems involving N+1 selects, it won't solve them. The truly correct solution
  is to fetch associations using joins. Batch fetching (or subselect fetching) can only be
  the best solution in rare cases where outer join fetching would result in a cartesian
  product and a huge result set."
- **On PostgreSQL, batch fetch binds a SQL ARRAY** (Intro §8.5): "The SQL for batch
  fetching looks slightly different depending on the database. Here, on PostgreSQL,
  Hibernate passes a batch of primary key values as a SQL `ARRAY`." (`where … = any (?)`)
- **`@Fetch(SUBSELECT)` vs `@Fetch(SELECT)`** (Intro §8.5): "Note that `@Fetch(SUBSELECT)`
  has the same effect as `@Fetch(SELECT)`, except after execution of a HQL or criteria
  query. But after query execution, `@Fetch(SUBSELECT)` is able to much more efficiently
  fetch associations."
- **The two-tips-that-look-contradictory** (Intro §8.6): "Avoid the use of lazy fetching,
  which is often the source of N+1 selects." + "Most associations should be mapped for lazy
  fetching by default." Resolution: "you must explicitly specify eager fetching for
  associations precisely when and where they are needed."
- **Four ways to ask for eager join fetching** (Intro §8.6): a JPA `EntityGraph`; a named
  fetch profile; `left join fetch` in HQL/JPQL; `From.fetch()` in a criteria query.
  "Typically, a query is the most convenient option."
- **Parallel many-valued fetches** (Intro §8.6): "There's one interesting case where join
  fetching becomes inefficient: when we fetch two many-valued associations in parallel. …
  Joining both collections in a single query would result in a cartesian product of tables,
  and a large SQL result set. Subselect fetching comes to the rescue here."
- **HQL guide §17.8.4 join fetch** (user guide): "This is one of the most important
  features of Hibernate. To achieve acceptable performance with HQL, you'll need to use
  `join fetch` quite often. Without it, you'll quickly run into the dreaded 'n+1 selects'
  problem." Plus the three rules: several to-one in series/parallel is safe; a single
  series of nested fetch joins is fine; **multiple collections in parallel = Cartesian
  product**. And: "it's usually a bad idea to apply a restriction to a `join fetch`ed
  entity, since the elements of the fetched collection would be incomplete."
- **fetch graph vs load graph** (Intro §5.7): "A **fetch graph** specifies exactly the
  associations that should be eagerly loaded. Any association not belonging to the entity
  graph is proxied and loaded lazily only if required. A **load graph** specifies that the
  associations in the entity graph are to be fetched **in addition to** the associations
  mapped `fetch=EAGER`." 🔴 "An `EntityGraph` passed directly to `find()` is **always
  interpreted as a load graph**." Plus the doc's own aside: "You're right, the names make
  no sense. But don't worry, if you take our advice, and map your associations
  `fetch=LAZY`, there's no difference between a 'fetch' graph and a 'load' graph."
- **Hibernate 7 graph API** (Intro §5.7): `entityManager.createEntityGraph(Book.class)`,
  `graph.addSubgraph(Book_.publisher)`, `graph.addPluralSubgraph(Book_.authors)
  .addSubgraph(Author_.person)`, then `entityManager.find(graph, bookId)`. Four nodes ⇒
  "a SQL query with four `left outer join`s."
- **Logging** (User guide §31.2): `log4j.logger.org.hibernate.SQL = debug` for the SQL;
  `log4j.logger.org.hibernate.orm.jdbc.bind = trace` for bind parameters;
  `org.hibernate.orm.jdbc.extract = trace` for extracted values. 🔴 "However, there are some
  other alternatives like using datasource-proxy or p6spy. The advantage of using a JDBC
  Driver or DataSource proxy is that you can go beyond simple SQL logging: statement
  execution time / JDBC batching logging / database connection monitoring. **Another
  advantage of using a DataSource proxy is that you can assert the number of executed
  statements at test time. This way, you can have the integration tests fail when a N+1
  query issue is automatically detected.** While simple statement logging is fine, using
  datasource-proxy or p6spy is even better."
- **Statistics** (Intro §8.17): `hibernate.generate_statistics` = true.
  `sessionFactory.getStatistics()`. Verified present on the 7.4 `org.hibernate.stat.Statistics`
  interface: `getQueryExecutionCount()` ("The global number of executed queries"),
  `getPrepareStatementCount()` ("The number of prepared statements that were acquired"),
  `getEntityFetchCount()` ("The global number of entity fetches"),
  `getCollectionFetchCount()` ("The global number of collections fetched"),
  `getEntityLoadCount()`, `getCollectionLoadCount()`, `isStatisticsEnabled()`, `clear()`,
  `logSummary()`, `getEntityStatistics(String)`, `getCollectionStatistics(String role)`,
  `getQueryStatistics(String)`. Also `DEFAULT_QUERY_STATISTICS_MAX_SIZE = 5000`.
  🔴 The load-vs-fetch pair is the real N+1 detector: *load* counts entities/collections
  materialised, *fetch* counts the ones that needed their own extra select.
  "Hibernate's statistics enable observability. Both Micrometer and SmallRye Metrics are
  capable of exposing these metrics."
- **EAGER is the disease, not the cure** (User guide §31.6.1): "EAGER fetching is almost
  always a bad choice. … Hence, the `@ManyToOne` and the `@OneToOne` associations are now
  EAGER by default. **The EAGER fetching strategy cannot be overwritten on a per query
  basis**, so the association is always going to be retrieved even if you don't need it.
  Moreover, **if you forget to `JOIN FETCH` an EAGER association in a JPQL query, Hibernate
  will initialize it with a secondary statement, which in turn can lead to N+1 query
  issues.** So, EAGER fetching is to be avoided."
- **DTO projections** (User guide §31.6): "Fetching too much data is the number one
  performance issue for the vast majority of Jakarta Persistence applications. … Entity
  queries are useful only if you need to modify the fetched entities, therefore benefiting
  from the automatic dirty checking mechanism. **For read-only transactions, you should
  fetch DTO projections because they allow you to select just as many columns as you need
  to fulfill a certain business use case.**"
- **`@Fetch` javadoc** (7.4 source): when not specified, `FetchMode.SELECT` is used for
  LAZY and `FetchMode.JOIN` for EAGER. "Note that join fetching is incompatible with lazy
  fetching, and so `@Fetch(JOIN)` implies `fetch=EAGER`, overriding any
  explicitly-specified `fetch=LAZY` setting."
- **`FetchMode.SELECT` javadoc**: "This fetching strategy is vulnerable to the 'N+1
  selects' bugbear, though the impact may be alleviated somewhat via: enabling batch
  fetching using `BatchSize`, or ensuring that the associated entity or collection may be
  retrieved from the second-level cache."
- **`@BatchSize` javadoc**: "Instead of a SQL `select` with just one primary key value in
  the `where` clause, the `where` clause contains a list of primary keys inside a SQL `in`
  condition. The primary key values to batch fetch are chosen from among the identifiers of
  unfetched entity proxies or collection roles associated with the session." `size()` is
  "The maximum batch size, a strictly positive integer." Targets TYPE, METHOD, FIELD.
- **Fetch profiles** (Intro §9.16): `@FetchProfile(name = "EagerBook")` on a class or
  package; better to use `@FetchProfileOverride(profile = …, mode = JOIN)` per association.
  The doc itself disparages `@NamedEntityGraph`: "the format of this annotation is even
  worse than `@FetchProfile(fetchOverrides=…)`, so we can't recommend it."
- **Log the SQL** (Intro, avoiding quagmires): "Log the SQL executed by Hibernate. **You
  cannot know that your persistence logic is correct until you've actually inspected the
  SQL that's being executed. Even when everything seems to be 'working', there might be a
  lurking N+1 selects monster.**"

## Files written

**Parts 1 and 2 COMPLETE — 17 files.** Part 1 = the problem and every shape it hides in
(9 files). Part 2 = seeing it: logging, counting, the test assertion, proxies, and
getting from a count to a call site (8 files). Parts 3-5 (the fixes, the non-fixes,
prevention) still to write; live table in `_plan.md` in the topic directory.

| File | Lines | Gotchas | Qs |
|---|---|---|---|
| `01-one-hundred-and-one-queries.md` | 220 | 6 | 5 |
| `01b-the-general-rule.md` | 196 | 5 | 6 |
| `02-why-nobody-sees-it.md` | 247 | 6 | 5 |
| `03-why-production-is-worse.md` | 267 | 7 | 6 |
| `04-the-shapes-it-hides-in.md` | 245 | 6 | 5 |
| `04b-three-more-shapes.md` | 209 | 7 | 5 |
| `04c-serialization-and-logging.md` | 287 | 7 | 7 |
| `04d-the-ones-you-cannot-make-lazy.md` | 246 | 6 | 5 |
| `04e-lazy-columns-and-hashcode.md` | 207 | 7 | 5 |
| `05-turning-the-sql-on.md` | 264 | 7 | 5 |
| `05b-show-sql-is-not-the-answer.md` | 227 | 6 | 4 |
| `06-count-do-not-read.md` | 293 | 7 | 6 |
| `06b-asserting-the-count-in-a-test.md` | 240 | 8 | 6 |
| `06c-making-it-reusable.md` | 214 | 7 | 4 |
| `06d-proxies-and-agents.md` | 280 | 7 | 5 |
| `07-from-a-count-to-a-call-site.md` | 283 | 7 | 6 |
| `README.md` | 13 | 0 | 0 |

## Traps found

- docs.jboss.org/hibernate/orm/… now **301-redirects to docs.hibernate.org/orm/…**.
  WebFetch does not follow cross-host redirects; curl + local grep is the working method.
- WebFetch over-summarises the 3.8 MB single-page user guide and loses exact wording.
  Download with curl, strip tags with a small python filter, grep the `.txt`.

- 🔴 **`hibernate.show_sql` javadoc says "Enables logging of generated SQL to the
  console"** — literally `System.out`, not a logger. Boot maps `spring.jpa.show-sql`
  (a `boolean showSql` on `JpaProperties`) onto it via `HibernateJpaVendorAdapter`:
  `if (isShowSql()) jpaProperties.put(AvailableSettings.SHOW_SQL, "true")`.
  `format_sql` and `highlight_sql` are also documented as console-only; highlight uses
  ANSI escape codes. All three `@settingDefault false`.
- 🔴 **Boot 4.1 `open-in-view` confirmed ON by default** from source:
  `@ConditionalOnBooleanProperty(name = "spring.jpa.open-in-view", matchIfMissing = true)`
  in `org.springframework.boot.jpa.autoconfigure.JpaBaseConfiguration.JpaWebConfiguration`,
  plus the exact warning logged when the property is unset: `"spring.jpa.open-in-view is
  enabled by default. Therefore, database queries may be performed during view rendering.
  Explicitly configure spring.jpa.open-in-view to disable this warning"`.
  ⚠️ Path moved in Boot 4 to `module/spring-boot-jpa/src/main/java/org/springframework/
  boot/jpa/autoconfigure/` (was `spring-boot-project/spring-boot-autoconfigure/.../orm/jpa/`).
- **Bind-parameter logging categories changed in Hibernate 6**: now
  `org.hibernate.orm.jdbc.bind` (TRACE) and `org.hibernate.orm.jdbc.extract`; the old
  `org.hibernate.type` appears commented out in the 7.4 guide's own snippet. Setting the
  old one produces silence, not an error.
- **`hibernate.log_slow_query`** (ms, `@settingDefault 0` = disabled) and
  **`hibernate.session_factory.statement_inspector`** both live in
  `org.hibernate.cfg.JdbcSettings`. The inspector takes an instance, a `Class` or a class
  name, and is the no-dependency per-thread counting hook — the basis of the "statement
  budget that throws" localisation trick in chunk 07.
- **Load vs fetch is the real N+1 measurement.** `getEntityLoadCount()` /
  `getCollectionLoadCount()` count materialisation; `getEntityFetchCount()` /
  `getCollectionFetchCount()` count the ones that needed their own secondary statement.
  So `collectionFetchCount == 0` is what a correct fetch plan looks like. Also:
  `getQueryExecutionCount()` counts only HQL/JPQL/criteria executions, so a textbook
  N+1 can report 1 — `getPrepareStatementCount()` is the statement count.
- **Spring Data JPA is at 4.1.1.** `@EntityGraph(value = "…", type = EntityGraphType.LOAD)`
  for a named graph; `@EntityGraph(attributePaths = {"members"})` for an ad-hoc one.
  Projections page confirms interface projections (closed vs open), the `@Value` SpEL
  form, recursive projections, and that a *closed* projection lets Spring Data optimize
  query execution. ⚠️ `…/jpa/entity-graph.html` is a **404** — entity graphs are
  documented inside `…/jpa/query-methods.html`.
- ⚠️ **Do not use a `re.sub` with `(?:\|.*\n)+.*?(...)` and `flags=re.S`** to rewrite a
  markdown table — catastrophic backtracking, hung for the full 2-minute tool timeout and
  killed the git commit that followed it. Rewrite tables line-by-line instead.
