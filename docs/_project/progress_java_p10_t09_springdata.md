---
name: progress-java-p10-t09-springdata
description: Java Phase 10 · Topic 09 · Spring Data JPA — fork progress
metadata:
  type: progress
---

# Java Phase 10 · Topic 09 · Spring Data JPA — fork progress

**Started:** 2026-08-26. **Fork session:** java-p10-t09.
**Directory (mine alone):** `docs/java/pages/phase-10-data-access/09-spring-data-jpa/`
**Tier:** Understand. `sidebar_position` starts at 1, +1 per file in reading order.

## Boundary

- **09 OWNS** the repository abstraction: interfaces + hierarchy, derived queries,
  `@Query` (JPQL + native), `Pageable`/`Sort`/`Page`/`Slice`, `Specification`,
  Query by Example, `@Modifying`, projections *as a Spring Data feature*,
  `@Transactional` defaults on repositories, custom fragment implementations,
  auditing.
- **06** owns persistence context / entity states / merge / dirty checking / flush.
- **07** owns mappings and fetch types.
- **08** owns N+1 and EVERY fix for it — `@EntityGraph` on a repository method
  (`09g`), projections *as an N+1 fix* (`12c`, `12c2`), fetch joins, batch size.
  🔴 09 LINKS, never re-argues.
- **05** owns `JdbcTemplate`/`JdbcClient` — contrast only.
- **04** owns the `@Transactional` proxy, rollback rules, propagation.
- Topics **10–14 do not exist yet** → bold plain text + *(not written yet)*.

## RESUME HERE

> **Next file: `05c-sort-is-not-free.md`** (position 28) — sorting by an alias is
> valid; `Sort.by("LENGTH(firstname)")` **throws**; `JpaSort.unsafe(...)` is the
> escape and has **two modes** (appended for derived/string queries, parsed into
> the `CriteriaQuery` for QBE/Specifications); `JpaSort.JpaOrder.withUnsafe(…)`;
> **no subquery expressions, TREAT or CAST**; sorting needs an index or it is a
> sort of the whole result; the tiebreaker requirement; `TypedSort`'s CGlib/native
> image caveat (already banked).
>
> Then `06-projections`, `07-specifications-and-criteria`, `07b-query-by-example`,
> `08-custom-implementations`, `09-transactions-on-repositories`,
> `10-auditing-and-lifecycle`, `11-what-spring-data-hides`, `12-the-checklist`.

🔴 **BUILD-BREAKING CORRECTION from the coordinator, 2026-08-26:** the page
terminator is **`{/* FOOTER */}`**, NOT `<!--FOOTER-->`. A bare HTML comment is
invalid MDX (`Unexpected character '!' (U+0021) before name`) and had been failing
every GitHub Pages deploy since 2026-08-23. All five existing files were
`sed`-retrofitted. **Never put a bare `<!-- … -->` in prose anywhere** — inside a
fenced code block it is fine, outside one it is a build failure.

## Per-file table

| File | Lines | Gotchas | Questions | Status |
|---|---|---|---|---|
| `01-what-a-repository-is.md` | 261 | 8 | 8 | done |
| `01b-the-repository-hierarchy.md` | 271 | 8 | 8 | done |
| `01c-what-jparepository-adds.md` | 280 | 10 | 8 | done |
| `01d-shaping-the-interface.md` | 267 | 8 | 8 | done |
| `01e-return-types.md` | 278 | 10 | 9 | done |
| `02-derived-queries.md` | 265 | 9 | 9 | done |
| `02b-the-predicate-keywords.md` | 261 | 9 | 9 | done |
| `02c-like-ignorecase-and-grouping.md` | 231 | 10 | 9 | done |
| `02d-property-paths-and-ambiguity.md` | 276 | 10 | 10 | done |
| `02e-limiting-and-static-ordering.md` | 269 | 11 | 10 | done |
| `02f-where-derived-queries-stop.md` | 256 | 11 | 10 | done |

⚠️ The plan's 18 rows are already becoming ~30 files. Topic 01 alone split 4 ways
(the first draft came in at 339 lines and was split on concept boundaries per
rule 1, then rebalanced by moving "what is NOT in the hierarchy" from 01c → 01b
and `@RepositoryDefinition` from 01b → 01d).

## Load-bearing claims and their sources

**Repository proxy / bootstrap**
- *"Repository instances are created as regular Spring beans… singleton scoped and
  eagerly initialized. During startup, they interact with the JPA `EntityManager`
  for verification and metadata analysis purposes."*
  https://docs.spring.io/spring-data/jpa/reference/repositories/create-instances.html
- BootstrapMode DEFAULT / LAZY / DEFERRED wording — same page. DEFERRED triggers on
  `ContextRefreshedEvent`. "If you're not using asynchronous JPA bootstrap stick with
  the default bootstrap mode."
- Fragment priority: *"Custom implementations have a higher priority than the base
  implementation and repository aspects."* + *"imported in the order of their
  declaration"* —
  https://docs.spring.io/spring-data/jpa/reference/repositories/custom-implementations.html
- `Impl` postfix rule + `repositoryImplementationPostfix` — same page.
- `repositoryBaseClass` on `@EnableJpaRepositories` — same page.

**Hierarchy**
- `CrudRepository` and `PagingAndSortingRepository` printed signatures; *"ListCrudRepository
  offers equivalent methods, but they return `List` where the `CrudRepository` methods
  return an `Iterable`."* —
  https://docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html
  🔴 `PagingAndSortingRepository<T,ID> extends Repository<T,ID>` — NOT CrudRepository.
- 🔴 **3.0 break**: *"as of version 3.0, these no longer extend CRUD repositories, so you
  must extend both if you need both functionalities"* —
  https://docs.spring.io/spring-data/jpa/reference/repositories/definition.html
- `JpaRepository extends ListCrudRepository, ListPagingAndSortingRepository,
  QueryByExampleExecutor` —
  https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/JpaRepository.html
- `@NoRepositoryBean`: *"Make sure you add that annotation to all repository interfaces
  for which Spring Data should not create instances at runtime."* — definition.html
- `@RepositoryDefinition(domainClass=, idClass=)` — definition.html
- Multiple-module disambiguation (module-specific type OR module-specific domain
  annotation; basePackages) — definition.html

**JpaRepository's own methods (javadoc, 4.1.0)**
- `flush`, `saveAndFlush`, `saveAllAndFlush`(2.5), `deleteAllInBatch()`,
  `deleteAllInBatch(Iterable)`(2.5), `deleteAllByIdInBatch`(2.5),
  `getReferenceById`(2.7).
- 🔴 batch-delete javadoc verbatim: *"leaves JPAs first level cache and the database out
  of sync. Consider flushing the EntityManager before calling this method. It will also
  NOT honor cascade semantics of JPA, nor will it emit JPA lifecycle events."*
- 🔴 `getReferenceById` javadoc verbatim: *"very likely to always return an instance and
  throw an EntityNotFoundException on first access. Some of them will reject invalid
  identifiers immediately."*
- 🔴 **VERIFIED TWICE** (javadoc + deprecated-list, both 4.1.0): `getOne(ID)` and
  `getById(ID)` are **deprecated, NOT removed**, replacement `getReferenceById(ID)`;
  `deleteInBatch(Iterable)` deprecated → `deleteAllInBatch(Iterable)`.
  https://docs.spring.io/spring-data/jpa/docs/current/api/deprecated-list.html
- Also deprecated on 4.1.0: `SimpleJpaRepository.getCountQuery(Specification)` →
  two-arg form; `readPage(TypedQuery, Pageable, Specification)` → four-arg form;
  `@org.springframework.data.jpa.repository.Temporal` since 4.0 → use `java.time`.

**Derived queries / @Query (gathered, not yet used)**
- Keyword table, `Distinct` caveat, LIKE-wildcard escaping and `escapeCharacter` on
  `@EnableJpaRepositories`, `@NativeQuery` as composed annotation for
  `@Query(nativeQuery=true)`, `countQuery`, JSqlParser requirement for complex native
  count derivation, `QueryRewriter`, `#{#entityName}` SpEL, `escape([0])`,
  `?${property:default}` —
  https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html
- ⛔ **WRONG — CORRECTED 2026-08-26.** This line used to read *"`@Modifying`
  defaults: `clearAutomatically = false`, `flushAutomatically = true`"*. The
  annotation source declares **BOTH as `default false`**
  (`boolean flushAutomatically() default false;` /
  `boolean clearAutomatically() default false;`). Nothing was written from the
  wrong value — it was caught before `04b`. Source:
  https://raw.githubusercontent.com/spring-projects/spring-data-jpa/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/Modifying.java
  `@Modifying` only applies with `@Query`. Derived `deleteByX` loads entities one by one
  and fires lifecycle callbacks; a `@Modifying` bulk delete does not. — same page.
- Query lookup strategies CREATE / USE_DECLARED_QUERY / CREATE_IF_NOT_FOUND(default);
  Top/First — *"If the number is omitted from `Top` or `First`, a result size of 1 is
  assumed"*; dedicated `Limit` parameter, must NOT be mixed with Top/First;
  `Pageable`+`Sort` and `Pageable`+`Limit` are invalid combinations;
  `Sort.unsorted()`/`Pageable.unpaged()`/`Limit.unlimited()`; underscore disambiguation
  rules —
  https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html
- Sorting by an alias is valid; `Sort.by("LENGTH(firstname)")` throws;
  `JpaSort.unsafe(...)` is the escape; unsafe does NOT support subqueries, TREAT, CAST.
  — query-methods.html

**Pagination**
- `Page` requires a COUNT query, `Slice` does not; `Window`/`ScrollPosition` keyset and
  offset scrolling; keyset properties must be non-nullable —
  query-methods.html + query-methods-details.html
- PostgreSQL 18: *"The rows skipped by an OFFSET clause still have to be computed inside
  the server; therefore a large OFFSET might be inefficient."* and the ORDER BY
  requirement — https://www.postgresql.org/docs/18/queries-limit.html

**Return types**
- Full table incl. `T` → null if none, `IncorrectResultSizeDataAccessException` if >1;
  `Optional<T>` same but `Optional.empty()` —
  https://docs.spring.io/spring-data/jpa/reference/repositories/query-return-types-reference.html

**Projections**
- closed vs open, `@Value` demotes; nested projections *"select the entire nested
  property causing the full join to materialize"*; DTO/record rules; `@PersistenceCreator`
  for multiple constructors; dynamic `Class<T>` projections; Tuple queries; *"types
  residing outside the entity's type hierarchy"*; DTO constructor-expression rewriting
  and the back-off when the query already uses one —
  https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html

**Specifications (4.0 changed this a lot)**
- 🔴 4.0 adds `PredicateSpecification<T>` (`toPredicate(From<?,T>, CriteriaBuilder)`),
  `UpdateSpecification<T>`, `DeleteSpecification<T>`; `Specification` keeps
  `toPredicate(Root, CriteriaQuery, CriteriaBuilder)`.
- `Specification.unrestricted()` **since 4.0** — *"null-like, and is elided in all
  operations"*. `where` since 2.0, `allOf`/`anyOf` since 3.0. **No @Deprecated on
  Specification in 4.1.0.**
- Fluent `findBy(spec, queryFunction)` with `as()`, `project()`, `sortBy()`, `limit()`,
  terminal `first/one/all/page/slice/scroll/stream/count/exists` —
  https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html
  https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/domain/Specification.html

**Query by Example**
- probe / ExampleMatcher / Example / FetchableFluentQuery; limitations verbatim (no
  nested-or-grouped constraints, no collections or maps, store-specific string matching,
  **exact matching for other property types**); StringMatcher table; matching() vs
  matchingAny(); *"Regex-matching is not supported by JPA"* —
  https://docs.spring.io/spring-data/jpa/reference/repositories/query-by-example.html

**Transactions on repositories**
- `SimpleJpaRepository`: read methods `readOnly = true`, others plain `@Transactional`.
- Re-declaring a method with `@Transactional(timeout = 10)` runs it *"without the
  readOnly flag"*.
- 🔴 *"The transaction configuration at the repositories is then neglected, as the outer
  transaction configuration determines the actual one used."*
- readOnly is **not** a check; propagated as a hint to the JDBC driver; **with Hibernate
  it sets flush mode to MANUAL, so dirty checks are skipped** —
  https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html

**save() / isNew**
- persist vs merge decision; default = version-property then id-property inspection;
  *"JPA considers 0 as the first inserted version, so a primitive version property cannot
  be used to determine if an entity is new"*; `Persistable.isNew()`; the
  `@Transient boolean isNew` + `@PostPersist`/`@PostLoad` pattern —
  https://docs.spring.io/spring-data/jpa/reference/jpa/entity-persistence.html

**Auditing**
- `@CreatedBy`/`@LastModifiedBy`/`@CreatedDate`/`@LastModifiedDate`; `AuditorAware<T>`
  returning `Optional<T>`; `@EnableJpaAuditing`; `AuditingEntityListener` must be
  registered via `@EntityListeners` or `orm.xml`; date types = JDK 8 date/time,
  `long`/`Long`, legacy `Date`/`Calendar`; `spring-aspects.jar` on the classpath —
  https://docs.spring.io/spring-data/jpa/reference/auditing.html
  ⚠️ `.../jpa/auditing.html` 404s; the live path is `.../reference/auditing.html`.
  ⚠️ Still to verify when writing topic 10: `@EnableJpaAuditing` attributes
  (`auditorAwareRef`, `setDates`, `modifyOnCreate`, `dateTimeProviderRef`).

## Traps found

- ⚠️ `https://docs.spring.io/spring-data/jpa/reference/jpa/auditing.html` and
  `.../jpa/query-by-example.html` both 404. Correct paths are under
  `/reference/auditing.html` and `/reference/repositories/query-by-example.html`.
- ⚠️ Spring Data JPA **4.0 reworked `Specification`** — `PredicateSpecification`,
  `UpdateSpecification`, `DeleteSpecification` are new types. Almost every blog on
  specifications predates this. Write topic 07 from the 4.1 reference only.
- ⚠️ The `@Modifying` defaults are the reverse of what folklore says: **flush is on by
  default, clear is off**.
- ⚠️ `Iterable` vs `List` return: `PagingAndSortingRepository.findAll(Sort)` returns
  `Iterable`, not `List`. Only the `List…` variants return `List`.

## Session 2 (resumed fork) — what was written and verified

**`02-derived-queries.md`** (pos 6, 265 lines, 9 gotchas, 9 questions).
Argues the method name is compiled source in a second language. Covers: the split
at the first `By` into subject + predicate; the full **subject keyword table**
verbatim from `query-keywords-reference.html`; the six select verbs are synonyms;
`delete…By`/`remove…By` select-then-delete-one-by-one so `@PreRemove` fires
(verbatim quote); descriptive tokens between verb and `By` are discarded
(`findActiveUsersByLastname` filters on lastname only); parsing happens at
bootstrap → `PropertyReferenceException`; the rename-is-a-breaking-change cost;
what derived queries are genuinely good at.
⚠️ First draft came in at **314 lines** → split per rule 1: the **reserved-method
`findById` section** (+ its gotcha and question) was moved out to
`02c-property-paths-and-ambiguity.md`, which is its natural home (it is a
property-*resolution* exception). 02 keeps a forward pointer to it.

**Newly fetched this session (not in the session-1 notes):**
- Full **subject keyword table** and **predicate keyword/modifier tables** —
  https://docs.spring.io/spring-data/jpa/reference/repositories/query-keywords-reference.html
- Query lookup strategies verbatim; **reserved methods** section verbatim
  (`findById`/`existsById`/`deleteById` target the identifier property whatever
  its name; a descriptive token as in `findUserById` breaks the match) —
  query-methods-details.html
- Underscore/traversal rules verbatim: `_` is reserved; `_name` → preserve, nested
  split with `__`; ALL-CAPS fields usable as-is, nested split with `_`; `qCode` →
  start with two capitals `QCode`; **"since a direct match on a property is
  considered first, any potential nested paths will not be considered"**.
- `Top`/`First` interchangeable, **"may not be mixed with a `Limit` parameter"**,
  omitted number = 1; limiting supports `Distinct` and `Optional`; **"If pagination
  or slicing is applied to a limiting query … it is applied within the limited
  result."**
- The JPA **keyword → JPQL snippet table** (Distinct/Between/Like/Containing/
  IgnoreCase → `UPPER(x.firstname) = UPPER(?1)` etc.) — jpa/query-methods.html
- 🔴 **Predicate sanitization**: `StartingWith`/`EndingWith`/`Containing` (and the
  `Not`/`Is` spellings) **escape LIKE wildcards in the argument**; escape char is
  `escapeCharacter` on `@EnableJpaRepositories`.
- 🔴 **`@Query` named params**: *"As of version 4, Spring fully supports Java 8's
  parameter name discovery based on the `-parameters` compiler flag… you can omit
  the `@Param` annotation for named parameters."*
- `@Modifying` verbatim rationale for `clearAutomatically` defaulting false
  (clearing *"effectively drops all non-flushed changes still pending"*).
- `@NativeQuery` is *"mostly a composed annotation for `@Query(nativeQuery=true)`"*
  plus `sqlResultSetMapping`; native Map/`List<Map<String,Object>>` returns;
  *"Spring Data can rewrite simple queries for pagination and sorting. More complex
  queries require either JSqlParser to be on the class path or a `countQuery`."*
- `QueryRewriter` (class or the repository itself implementing it); `@Meta(comment)`
  + `hibernate.use_sql_comments`; `@QueryHints(forCounting = false)`;
  `JpaSort.unsafe` two modes and the no-subquery/TREAT/CAST limitation.
- Named queries resolved as `SimpleDomainClassName.methodName`.

**`02b-the-predicate-keywords.md`** (pos 7, 261 lines) + **`02c-like-ignorecase-and-grouping.md`**
(pos 8, 231 lines). Written as one 366-line draft and split on a concept boundary:
02b = the two tables and how arguments bind; 02c = the four keywords that carry
hidden behaviour. 02b covers the store-neutral keyword table verbatim, the JPA
keyword→JPQL table verbatim, the `null`-argument rewrite (`= ?1` becomes `IS NULL`)
and that it does **not** happen for `@Query`, argument counts per keyword, and the
`After`/`Between` inclusivity traps. 02c covers the `Containing`/`StartingWith`
sanitization quote, `Like` being unsanitised, `UPPER(x.f) = UPPER(?1)` and
expression indexes, the `Or`-then-`And` grouping (flagged as NOT spelled out in the
reference), and `IsEmpty` as an anti-join.

⚠️ **Stated as uncertain on purpose** (rule 8): `Containing` against a *collection*
association behaving as a membership test — the JPA table documents only the string
case, so both pages tell the reader to check the generated SQL.

🔴 **Numbering after the split:** 02(6) 02b(7) 02c(8) 02d(9, property paths +
reserved methods) 02e(10, limiting + static OrderBy) 02f(11, where they stop), then
`03-at-query-jpql` at **12**. Forward links in 02/02b were sed-repointed to the new
letters.

**`02d-property-paths-and-ambiguity.md`** (pos 9, 276 lines, 10 gotchas, 10 Q).
The camel-case resolution algorithm (longest head first), the verbatim
direct-match-wins sentence and its consequence (adding a denormalised scalar field
silently re-points an existing traversal), the underscore traversal point, the three
documented escapes for `_name` / ALL-CAPS / `qCode`, the full reserved-method
`findById` carve-out with the reference's `pk` vs `id` example, and the fact that a
traversal is an **inner** join in JPQL — so null associations drop out, collection
traversals duplicate parents, and the join filters without fetching.
Cross-topic links verified against disk: `06/06-the-identifier.md`,
`08/08c-duplicate-parents-and-distinct.md`, `08/08-join-fetch.md`.

**`02e-limiting-and-static-ordering.md`** (pos 10, 269 lines, 11 gotchas, 10 Q).
`Top`/`First` interchangeable and placeable anywhere in the subject; omitted number
= 1; the reference's seven legal spellings including `findFirstByOrderByLastnameAsc()`
(empty predicate) and `findTop3By(Pageable)`; the `Limit` parameter with
`Limit.of`/`Limit.unlimited` and the two documented prohibitions (not with
`Top`/`First`, not with `Pageable`); "pagination … is applied within the limited
result"; PostgreSQL 18's ORDER BY warning quoted for why a limit without a *unique*
order is nondeterministic, and the primary-key tiebreaker; static `OrderBy…`
chaining.
⚠️ **Stated as not-documented on purpose:** how a static `OrderBy` combines with a
`Sort` parameter — the reference does not say, so the page tells the reader to pick
one form per method rather than guessing.
Forward links left in place to `05-pageable-and-sort.md`, `05b-…`, `05c-…` (all mine,
not yet written — they are same-topic so they will resolve at close).

**`02f-where-derived-queries-stop.md`** (pos 11, 256 lines, 11 gotchas, 10 Q).
Closes chunk 02. Two boundaries: the **soft** one (a legal name that a reader can
no longer decode — the test is "can you state the where clause after reading the
name once", which fails around three predicates) and the **hard** one, given as a
nine-row table of what the grammar cannot express with the escape for each
(grouping, left join, optional predicate, aggregates, subquery, functions,
unmapped joins, window/case/set ops, expression ordering). Then the five-rung
ladder (JPQL → Specification → projection → native → SQL-first) and the
"filtering in the service" tell.
🔴 **Chunk 02 is COMPLETE at six files** (02, 02b, 02c, 02d, 02e, 02f), positions
6–11, 1,558 lines total. Gotcha counts 9–11, question counts 9–10 — varied, per
rule 13.
Forward links to same-topic files not yet written: `03-at-query-jpql.md`,
`03b-native-queries.md`, `06-projections.md`, `07-specifications-and-criteria.md`,
`07b-query-by-example.md`, `05-pageable-and-sort.md`, `05b-…`, `05c-…`,
`04-modifying-queries.md`, `02e`/`02f` (now written). All are inside topic 09 and
will resolve as the run finishes.

## Session 3 (resumed fork, 2026-08-26) — chunk 03 begins

**`03-at-query-jpql.md`** (pos 12, 243 lines, 10 gotchas, 9 questions) +
**`03b-what-jpql-buys-you.md`** (pos 13, 217 lines, 11 gotchas, 10 questions).
Written as one 315-line draft and split on the concept boundary the page already
had: **03 = the annotation wins and what JPQL *is*** (precedence over
`@NamedQuery`/`orm.xml` quoted verbatim, the method name becomes an unchecked
label, identifiers are Java names, alias/identification variable, path navigation
is an inner join, binding an entity, polymorphic queries on a hierarchy root);
**03b = the two lists** — what the language can say that a name cannot (7-row
table) and everything `@Query` does *not* change (managed entities, lazy stays
lazy, Hibernate still owns the SQL), plus the text-block argument.
Gotchas and questions were distributed to the group each is actually about; none
dropped, none reworded.

⚠️ **Planned `03b-native-queries.md` is renamed `03f-native-queries.md`** because
the split took the `03b` letter. Sequence is now 03, 03b, 03c (binding), 03d
(validation), 03e (templated), 03f (native).

### Newly verified this session (not in the earlier notes)

- Precedence verbatim: *"Queries annotated to the query method take precedence
  over queries defined using `@NamedQuery` or named queries declared in
  `orm.xml`."* — jpa/query-methods.html
- 🔴 **SOURCE-READ, not in any reference page** — `SimpleJpaQuery`'s constructor
  calls `validateQuery(...)`, which opens a **throwaway `EntityManager`** from the
  factory and calls `em.createQuery(queryString)`; any `RuntimeException` becomes
  `QueryCreationException.create(method, "Query validation failed for '%s'", e)`.
  **If the method returns a `Page`, the count query is validated too**
  (`if (method.isPageQuery()) validateQuery(getCountQuery(), …)`). The code carries
  a comment explaining the try/catch: *"Needed as there's ambiguities in how an
  invalid query string shall be expressed by the persistence provider"*.
  https://raw.githubusercontent.com/spring-projects/spring-data-jpa/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/query/SimpleJpaQuery.java
- 🔴 **`NativeJpaQuery` has NO validation call at all** — both constructors only
  read `sqlResultSetMapping` and `queryForEntity`; the SQL first reaches the
  database on the first invocation. That is the hard evidence for "JPQL fails at
  startup, native SQL fails in production". Use it in `03d` and `03f`.
  https://raw.githubusercontent.com/spring-projects/spring-data-jpa/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/query/NativeJpaQuery.java
- 🔴 **`-parameters` is on by default under Spring Boot builds**, verified in two
  places: the Gradle plugin's `JavaPluginAction.configureParametersCompilerArg`
  adds `-parameters` to every `JavaCompile` task; `spring-boot-starter-parent`
  sets `<parameters>true</parameters>` (and `<javaParameters>true</javaParameters>`
  for Kotlin). So the 4.x "you can omit `@Param`" rule is live for a normal Boot
  app without any extra configuration.
- Query introspection/rewriting verbatim: *"Our built-in SQL query enhancer
  supports only simple queries for introspection `COUNT` query derivation. A more
  complex query will require either the usage of JSqlParser or that you provide a
  `COUNT` query through `@Query(countQuery=…)`."* Plus
  `QueryEnhancerSelector` on `@EnableJpaRepositories` as the fine-grained control,
  and *"If JSqlParser is on the class path, Spring Data JPA will use it for native
  queries."* — jpa/query-methods.html
- Advanced LIKE in `@Query`: *"the LIKE delimiter character (`%`) is recognized,
  and the query is transformed into a valid JPQL query (removing the `%`). Upon
  running the query, the parameter passed to the method call gets augmented with
  the previously recognized LIKE pattern."* — same page.
- `QueryRewriter` — applies *"to the actual query and, when applicable, to count
  queries"*, and *"Count queries are optimized and therefore, either not necessary
  or a count is obtained through other means, such as derived from a Hibernate
  `SelectionQuery` if there is an enclosing transaction."*
- Native `Map`/`List<Map<String,Object>>` returns are **Hibernate-only**:
  *"String-based Tuple Queries are only supported by Hibernate. Eclipselink
  supports only Criteria-based Tuple Queries."*
- Scrolling: *"Scrolling with String-based query methods is not yet supported"*
  and *"Scrolling is also not supported using stored `@Procedure` query methods"*;
  `ScrollPosition.offset()` vs `ScrollPosition.offset(0L)` — the latter *"skips the
  first element and translate to an offset of 1"*; keyset properties must be
  non-nullable; the keyset mechanism *"amends your sort order by including the
  primary key … to ensure each query result is unique"*. Keep for `05b`.
- `@QueryHints(forCounting = false)` and `@Meta(comment = …)` +
  `hibernate.use_sql_comments` (Boot:
  `spring.jpa.properties.hibernate.use_sql_comments=true`); `@Meta` also applies to
  `count`, `exists` and some `delete` operations, but **not** to
  `entityManager.find()`.
- Derived delete verbatim: *"a derived delete query is a shortcut for running the
  query and then calling `CrudRepository.delete(Iterable<User> users)` on the
  result"*, and the memory warning: *"All resulting objects are loaded into memory
  before being deleted and are held in the session until flushing or completing the
  transaction."* — for `04`.

**`03c-binding-parameters.md`** (pos 14, 236 lines, 10 gotchas, 10 questions) +
**`03d-what-binding-does-not-do.md`** (pos 15, 207 lines, 11 gotchas, 10 questions).
One 301-line draft split on the boundary between *how the link between signature
and query is made* (03c: positional, named, `-parameters`) and *what binding
refuses to do for you* (03d: the `like` `%` move, `null` is not rewritten,
collections, types, entities). Gotchas and questions distributed to the half each
belongs to; several new ones written for each half rather than left uneven.

### More source-reads banked this session

- 🔴 **Positional binding counts BINDABLE parameters only.**
  `QueryParameterSetterFactory.findParameterForBinding(parameters, int)` resolves
  against `parameters.getBindableParameters()`, so `Pageable`, `Sort`, `Limit`,
  `ScrollPosition` and the dynamic-projection `Class<T>` are skipped by the
  numbering. Out-of-range asserts with *"At least %s parameter(s) provided but
  only %s parameter(s) present in query"*. Not stated in the reference.
- 🔴 **`@Param` beats the compiled name.** `Parameter`'s name is
  `annotation == null ? parameter.getParameterName() : annotation.value()`, so a
  stale `@Param` silently survives a parameter rename.
- 🔴 **Exact failure when no name is available** (`Parameter.getRequiredName()`,
  since 3.4): `IllegalStateException` — *"Parameter … is not named. For queries
  with named parameters you need to provide names for method parameters; Use
  @Param for query method parameters, or use the javac flag -parameters."*
- ⚠️ **Stated as not-portable rather than invented:** what a provider renders for
  an EMPTY collection in `in :ids`. JPQL has no `in ()`, and the page says the
  behaviour differs by provider and tells the reader to guard it in the caller
  instead of asserting one outcome.

🔴 **Letters after the two splits:** 03 (12) · 03b (13) · 03c (14) · 03d (15) ·
03e templated (16) · 03f validation (17) · 03g native (18). The `03b` and `03c`
names planned for native queries and modifying queries are GONE — `04` onwards is
unchanged.

**`03e-templated-queries-and-expressions.md`** (pos 16, 199 lines, 10 gotchas,
8 questions) + **`03e2-expressions-escaping-and-cost.md`** (pos 17, 256 lines,
12 gotchas, 11 questions). One 321-line draft split on the boundary between the
*template* half (the two mechanisms, `#{#entityName}`, the generic
`@NoRepositoryBean` parent) and the *values* half (argument expressions,
`principal`, escaping, property placeholders, the two costs). ⚠️ The second file
uses the `03e2` form rather than `03f`, so the already-written link in `03` to
`03g-native-queries.md` stays correct — phase 10 precedent is `08e2`, `12c2`,
`14b2`.

### Verified for these two chunks

- Value expressions page (NEW — the JPA page links to it as
  `jpa/value-expressions.html`; `reference/value-expressions.html` **404s**):
  the five-row expression example set; *"Doing so requires evaluation of the
  expression on each usage and, therefore, value expression evaluation has an
  impact on the performance profile."*; *"Make sure to parse and evaluate only
  expressions from trusted sources such as annotations. Accepting user-provided
  expressions can create an entry path to exploit the application context and
  your system resulting in a potential security vulnerability."*; extensions
  hydrate the context *"with: a root object, named properties, and functions"*;
  *"Consult your module's documentation to determine the actual parameter
  by-name/by-index binding syntax."*
- 🔴 **`principal` is contributed by Spring Security, not Spring Data** —
  `org.springframework.security.data.repository.query.SecurityEvaluationContextExtension`
  in the **`spring-security-data`** module (verified: class exists on
  spring-security `main` and implements `EvaluationContextExtension` with
  `getRootObject()` returning a `SecurityExpressionRoot`; the artifact is on
  Maven Central). The JPA reference uses `principal` in an example without saying
  where it comes from.
- `escape(String)`: *"It prefixes all instances of `_` and `%` in the first
  argument with the single character from the second argument"*, the
  `findContainingEscaped("Peter_")` finds `Peter_Parker` not `Peter Parker`
  example, `escapeCharacter` on `@EnableJpaRepositories`, and the limitation
  *"will only escape the SQL and JPQL standard wildcards `_` and `%`"*.
- `#{#entityName}` resolution (the `@Entity` `name` attribute else the simple
  class name) and ⚠️ *"Customizations in `orm.xml` are not supported for the SpEL
  expressions."*
- Property placeholder: *"The property is being evaluated upon query execution"*
  and *"Typically, property placeholders resolve to String-like values."*

**`03f-what-is-checked-and-when.md`** (pos 18, 251 lines, 11 gotchas,
11 questions). The whole chunk is built on the two source-reads banked above:
the `SimpleJpaQuery.validateQuery` sequence (skip procedures → throwaway
`EntityManager` → `createQuery` → wrap in `QueryCreationException`), count-query
validation for a `Page` but not a `Slice`, `NativeJpaQuery` having no validation
at all, and the three bootstrap modes as the thing that decides when "startup"
happens. Carries a two-column table of what the parse catches vs what it never
catches — the second column is where every real repository defect lives.

**Chunk 03 CLOSED at nine files** (positions 12–21, ~2,050 lines):
`03` (243) · `03b` (217) · `03c` (236) · `03d` (207) · `03e` (199) ·
`03e2` (256) · `03f` (251) · `03g` (264) · `03g2` (228) · `03g3` (234).
Gotcha counts 10–12, question counts 8–11 — varied, per rule 13. The planned
two rows (`03-at-query-jpql`, `03b-native-queries`) became ten files.

**`03g-native-queries.md`** (pos 19) — the decision: `@NativeQuery` as the
preferred spelling (composed annotation quote), a six-row table of what you give
up, what does NOT change (binding, managed entities), the honest "when native is
right" list (window functions, CTEs, `jsonb`/`distinct on`/full text,
`insert … on conflict`, plan-derived SQL) and the honest counter-list.
**`03g2-native-pagination-and-results.md`** (pos 20) — the count query: three
routes (hand-written `countQuery`, JSqlParser on the classpath, `Slice`), the
`.count` suffix for named native queries, `QueryEnhancerSelector`, the four jobs
of query introspection, and the two things simply not on offer (scrolling for
string-based query methods; reliable dynamic `Sort`).
**`03g3-what-a-native-query-returns.md`** (pos 21) — the return type as the
instruction: domain type, interface projection run as a `Tuple` (SOURCE-READ from
`NativeJpaQuery.getTypeToQueryFor` — `returnedType.isInterfaceProjection()` →
`Tuple.class`), `Map`/`List<Map<String,Object>>` raw pairs (Hibernate-only),
`@SqlResultSetMapping` via `@NativeQuery`, and `QueryRewriter` (must be a bean;
may be the repository itself; applies to count queries only *"when applicable"*).

⚠️ **Placeholder left for the coordinator:** `03g` refers to **topic 13 · jOOQ**
as bold plain text *(not written yet)*. Everything else in chunk 03 links to
topics 05, 06, 08 and to same-topic files.

**`04-modifying-queries.md`** (pos 22, 276 lines, 12 gotchas, 11 questions) +
**`04b-flush-clear-and-the-stale-context.md`** (pos 23, 274 lines, 12 gotchas,
11 questions).

### 🔴 The correction this pair produced

**`@Modifying`'s two attributes BOTH default to `false`.** The banked note above
said `flushAutomatically = true` and that is wrong; verified in the annotation
source. Also from that javadoc: *"Queries that require a `@Modifying` annotation
include `INSERT`, `UPDATE`, `DELETE`, and DDL statements"*, and the two timings
verbatim — flush *"before executing the modifying query"*, clear *"after
executing the modifying query"*.

### Jakarta Persistence 3.2 quotes banked (all from the spec HTML)

- §4.11: *"Bulk update and delete operations apply to entities of a single entity
  class (together with its subclasses, if any). Only one entity abstract schema
  type may be specified in the FROM or UPDATE clause."*
- *"A delete operation only applies to entities of the specified class and its
  subclasses. It does not cascade to related entities."*
- 🔴 *"Bulk update maps directly to a database update operation, bypassing
  optimistic locking checks. Portable applications must manually update the value
  of the version column, if desired, and/or manually validate the value of the
  version column."*
- 🔴 *"The persistence context is not synchronized with the result of the bulk
  update or delete."* + the caution paragraph (*"should only be performed within a
  transaction in a new persistence context or before fetching or accessing
  entities whose state might be affected"*).
- §3.10 `FlushModeType` AUTO: *"the persistence provider is responsible for
  ensuring that all updates to the state of all entities in the persistence
  context which could potentially affect the result of the query are visible to
  the processing of the query"*; with COMMIT *"the effect of updates … upon
  queries is unspecified"*.
- `jakarta.persistence.Query` javadoc: `getResultList()` throws
  **`IllegalStateException`** *"if called for a Jakarta Persistence query language
  UPDATE or DELETE statement"* — that is what a missing `@Modifying` produces;
  `executeUpdate()` returns *"the number of entities updated or deleted"* and
  throws `TransactionRequiredException` with no transaction.
  https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/query
  https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html

**`04c-derived-delete-versus-bulk-delete.md`** (pos 24, 257 lines, 12 gotchas,
10 questions). The reference's `deleteByRoleId` / `deleteInBulkByRoleId` contrast
quoted in full, the eight-row comparison table, the third option
(`deleteAllInBatch` and friends) with the `JpaRepository` javadoc warning, and a
three-question decision procedure. Ends by saying plainly that at millions of
rows the right tool is usually none of the three.

🔴 **Chunk 04 CLOSED at three files** (positions 22–24, 807 lines).

**`05-pageable-and-sort.md`** (pos 25, 278 lines, 12 gotchas, 11 questions).
`Pageable`/`PageRequest`, the seven-row "Consuming Large Query Results" table
from the reference, `Page` vs `Slice` vs `List`, the invalid combinations, and
`Top` + `Pageable`.

### New quotes banked from query-methods-details.html

- *"APIs taking `Sort`, `Pageable` and `Limit` expect non-null values… use
  `Sort.unsorted()`, `Pageable.unpaged()` and `Limit.unlimited()`."*
- *"A `Page` knows about the total number of elements and pages available. It does
  so by the infrastructure triggering a count query… you can instead return a
  `Slice`. A `Slice` knows only about whether a next `Slice` is available."*
- `List` + `Pageable`: *"the additional metadata required to build the actual
  `Page` instance is not created (which, in turn, means that the additional count
  query that would have been necessary is not issued). Rather, it restricts the
  query to look up only the given range of entities."*
- 🔴 The **Consuming Large Query Results** table: `Slice` fetches
  `Pageable.getPageSize() + 1`; offset-`Window` fetches `limit + 1`; `Page`
  fetches `getPageSize()` and *"Additionally, `COUNT(…)` query to determine the
  total number of elements **can be required**"* (note: *can be*, not always);
  keyset-`Window` uses `limit + 1` *"using a rewritten WHERE condition"* and
  requires an index, non-null keys, and *"Results must expose all sorting keys in
  their results requiring projections to select potentially more properties than
  required for the actual projection."*
- *"Special parameters may only be used once within a query method."* + the two
  invalid combinations with their stated reasons.
- 🔴 *"The `Top` keyword can be used together with `Pageable`: `Top` defines the
  total maximum number of results, while the `Pageable` parameter may reduce this
  number further."*
- 🔴 **`TypedSort` uses CGlib**: *"`TypedSort.by(…)` makes use of runtime proxies
  by (typically) using CGlib, which may interfere with native image compilation
  when using tools such as GraalVM Native Image."* `QSort` (Querydsl metamodel) is
  the compile-time-safe alternative.
- `Stream<T>` — *"Streams must be closed after usage to avoid resource leaks."*
- Also on that page and NOT yet used: `Streamable<T>` and custom Streamable
  wrapper types (constructor or `of(…)`/`valueOf(…)` factory), Vavr collection
  return types. Candidates for `11-what-spring-data-hides` or `01e` follow-up.

**`05b-offset-pagination-at-depth.md`** (pos 26, 160 lines, 10 gotchas,
8 questions) + **`05b2-keyset-filtering-and-scrolling.md`** (pos 27, 290 lines,
12 gotchas, 12 questions). One 310-line draft split on the boundary between the
*problem* (what `OFFSET` costs, why the page boundaries move) and the *fix*
(keyset filtering, the Scroll API, the four constraints, the `@Query`
limitation and the hand-written predicate). 05b is deliberately the shorter of
the two — the mechanism is one sentence from the PG docs and the rest is
consequence.

🔴 **The design-deciding fact, worth repeating anywhere pagination comes up:**
*"Scrolling with String-based query methods is not yet supported"* — so a cursor
API cannot be backed by a `@Query`, and the keyset predicate is hand-written
(`sortCol < :last or (sortCol = :last and id < :lastId)`, every comparison in the
sort's direction). PostgreSQL's row comparison `(a, b) < (?, ?)` is the tidy form
and **JPQL has no row-constructor syntax**, so it is native-only — stated on the
page rather than glossed.

