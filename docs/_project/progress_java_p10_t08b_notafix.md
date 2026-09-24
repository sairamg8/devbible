---
name: progress-java-p10-t08b-notafix
description: Java Phase 10 · Topic 08 · fork 08b — fetch profiles, choosing a fix, what is NOT a fix, prevention
metadata:
  type: progress
---

# Java Phase 10 · Topic 08 · fork 08b — fetch profiles, choosing a fix, what is NOT a fix, prevention

Fork id: **java-p10-t08b**. Started 2026-08-26.

## Scope — ABSOLUTE, by filename

Directory: `docs/java/pages/phase-10-data-access/08-the-n-plus-1-problem/`
Tier: 🔴 **Master** on every chunk.

I own **chunks 13 through 19 and every split of them** and nothing else:

| Planned file | Subject |
|---|---|
| `13-fetch-profiles-and-enhancement.md` (+ 13b, 13c…) | fetch profiles; bytecode enhancement; lazy basic attrs; `@LazyGroup` |
| `14-choosing-a-fix.md` (+ 14c…) | the decision procedure, keyed on evidence |
| `14b-three-services-worked-through.md` | three services, three different fixes |
| `15-open-in-view.md` (+ 15b…) | OSIV: what it hides, why it is not a fix |
| `16-eager-is-not-a-fix.md` (+ 16b…) | EAGER makes N+1 unconditional |
| `17-initialize-loops-and-caches.md` (+ 17b…) | `Hibernate.initialize` loops; 2LC as a "fix" |
| `18-fetching-belongs-to-the-call-site.md` (+ 18b…) | prevention argument |
| `19-the-checklist.md` (+ 19b…) | review checklist |

⛔ **NOT mine:** `08e2` and `09`–`12c` (fork 08a is writing them RIGHT NOW).
⛔ **NOT mine:** `01`–`08e` (finished), `README.md`, `_category_.json`, `_plan.md`, any board.

`sidebar_position` starts at **50**, +1 per file. Coordinator renormalises.

## Rules in force
- 300-line file cap = file size, never content budget. Split at 301 on a concept boundary.
- Footer costs 4 lines → write to ≤296 body lines. End each file with bare `<!--FOOTER-->`.
- Gotchas/Q&A exhaustive, **varying counts per file** — uniform counts are the tell.
- 🔴 NO console blocks. No fabricated `Hibernate: select …`, no timings, no query counts.
- Forward refs to fork 08a's chunks (`09`–`12c`, `08e2`) = **bold plain text** *(not written yet)*.
- Do not commit in devbible. Commit only in this store.

## Per-file table

| File | Lines | Gotchas | Qs | Status |
|---|---|---|---|---|
| `13-fetch-profiles.md` | 272 | 6 | 8 | ✅ |
| `13b-enabling-and-the-default-profile.md` | 294 | 7 | 6 | ✅ |
| `13c-bytecode-enhancement.md` | 276 | 6 | 7 | ✅ |
| `13d-lazy-groups.md` | 260 | 7 | 7 | ✅ |
| `14-choosing-a-fix.md` | 289 | 7 | 7 | ✅ |
| `14b-the-list-page.md` | 294 | 7 | 6 | ✅ |
| `14c-the-report.md` | 289 | 8 | 6 | ✅ |
| `14d-the-detail-view.md` | 258 | 6 | 8 | ✅ |
| `15-open-in-view.md` | 257 | 7 | 9 | ✅ |
| `15b-what-open-in-view-costs.md` | 254 | 8 | 9 | ✅ |
| `15c-turning-it-off.md` | 255 | 7 | 8 | ✅ |
| `16-eager-is-not-a-fix.md` | 254 | 7 | 8 | ✅ |
| `17-initialize-loops.md` | 274 | 8 | 8 | ✅ |
| `17b-the-second-level-cache.md` | 257 | 9 | 8 | ✅ |
| `18-fetching-belongs-to-the-call-site.md` | 264 | 7 | 8 | ✅ |
| `19-the-checklist.md` | 242 | 8 | 9 | ✅ |
| `19b-the-standing-configuration.md` | 250 | 7 | 7 | ✅ |

**17 files · 4,439 lines · 122 gotchas · 131 interview questions. 0 over the 296 budget,
0 broken links, 0 console blocks, 0 MDX hazards.** sidebar_position 50–66.

⚠️ First pass came back with interview-question counts clustered at 6 across 15 of 17 files —
the rule-13 template tell. A second pass added 25 genuinely new questions (GraphQL resolvers,
`@Cache(include="non-lazy")`, `isPropertyInitialized` vs `isInitialized`, filter/interceptor
difference, static analysis limits, CQRS, verifying enhancement ran, …) and the spread is now
6–9. Watch for this on any future run.

🔴 **RENAMES from the plan** (reported to coordinator):
- planned `13-fetch-profiles-and-enhancement.md` → `13`, `13b`, `13c`, `13d`
- planned `14b-three-services-worked-through.md` → **one file per service**:
  `14b-the-list-page.md`, `14c-the-report.md`, `14d-the-detail-view.md`

### Worked-example domain (keep consistent across 14b/14c/14d)
`Order` (id, status, placedAt, total) → `@ManyToOne(LAZY) Customer customer`,
`@OneToMany(mappedBy="order") List<OrderLine> lines`, `@OneToMany List<Payment> payments`.
`OrderLine` → `@ManyToOne(LAZY) Product product`.
- **14b list page** lands on a **projection** (caller serialises, never mutates).
- **14c report** lands on **`@BatchSize`** (unbounded parents, two collections, no editable call site).
- **14d detail view** lands on **entity graph / fetch join** (N is 1).
⚠️ Same association (`Order.lines`) gets a different fix in each — that is the punchline.

⚠️ Numbers in worked examples are stated as **arithmetic of the described shape**
("a page of 10 should cost about 21 statements"), never as a measurement taken. Do not
let a worked example drift into sounding like a run.

## Load-bearing claims and their sources

Docs fetched to scratchpad and grepped locally (curl -A Mozilla), NOT from memory:
- Hibernate 7.4 user guide — https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html (build **7.4.6.Final**, doc stamp 2026-08-23)
- Hibernate 7.4 introduction — https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html
- `org.hibernate.Session` javadoc — https://docs.jboss.org/hibernate/orm/7.4/javadocs/org/hibernate/Session.html
- Boot 4.1 properties appendix — https://docs.spring.io/spring-boot/appendix/application-properties/index.html (page says 4.1.1)
- Boot `JpaBaseConfiguration` source, branch `4.1.x` — https://raw.githubusercontent.com/spring-projects/spring-boot/4.1.x/module/spring-boot-jpa/src/main/java/org/springframework/boot/jpa/autoconfigure/JpaBaseConfiguration.java
- Spring Framework `OpenEntityManagerInViewInterceptor` / `...Filter` source, `main` — spring-orm/src/main/java/org/springframework/orm/jpa/support/

### §12.9–12.12 correction
Hibernate 7.4 UG §12.9 is **"The `@Fetch` annotation mapping"**, 12.10 `FetchMode.SELECT`,
12.11 `FetchMode.SUBSELECT`, 12.12 `FetchMode.JOIN`. There is **no** "§12.9 Subselect
fetching" — I cited it wrongly once and fixed it. §12.8 is Batch fetching.
`@BatchSize` doc wording is only *"allows us to load multiple Employee entities in a single
database round trip"* — do NOT claim "size − 1 others"; the docs do not say that.

### Fetch profiles (13 / 13b)
- Profile is **not rooted** at an entity — intro §9.16: *"a fetch profile—unlike an entity graph—isn't 'rooted' at any particular entity."*
- `fetchOverrides` form: intro calls it *"so messy that we're embarrassed to show it to you here."* UG §12.7 has the `@FetchProfile.FetchOverride(entity=, association=, mode=)` example.
- `@FetchProfileOverride(profile=Book_.PROFILE_EAGER_BOOK, mode=JOIN)` on the association is the recommended form; `Book_.PROFILE_EAGER_BOOK` generated by Hibernate Processor.
- **Only unique advantage** = selective SUBSELECT: *"The one and only advantage unique to fetch profiles is that they let us very selectively request subselect fetching. We can't do that with entity graphs, and we can't do it with HQL."*
- Three enable spellings: `session.enableFetchProfile(name)`; `Book_._EagerBook.enable(session)`; **`entityManager.find(Book.class, id, Book_._EagerBook)`** as a `FindOption` (JPA 3.2 `find(Class,Object,FindOption…)`).
- `@Find(namedFetchProfiles = Book_.FETCH_WITH_AUTHORS)` — Hibernate Processor repositories only, NOT Spring Data.
- **Mutual exclusivity** — UG §12.1: *"fetch profile and entity graph are mutually exclusive. When both are present, entity graph would take effect and fetch profile would be ignored."*
- Built-in **`org.hibernate.defaultProfile`** = `@FetchProfileOverride(mode=JOIN)` on every eager `@ManyToOne`/`@OneToOne`; enabling it adds outer joins to every HQL/criteria query.
- Intro's own verdict: *"Well, it's really hard to say… Hibernate offers alternatives that we think are more compelling most of the time."*
- FetchMode values UG §12.1: SELECT / JOIN / BATCH / SUBSELECT; SELECT is *"the strategy generally termed N+1"*.

### 🔴 TRAP CORRECTED MID-WRITE
`Session.enableFetchProfile(String)` **throws `UnknownProfileException`** when the name is
unknown — so do **not** write "a typo silently does nothing". Same for
`disableFetchProfile` and `isFetchProfileEnabled`. Enabling an already-enabled profile is a
documented **no-op** (so profiles have no reference count — nested enable/disable is a trap).
Chunk 13 was written with the wrong claim and fixed before it shipped.

### Bytecode enhancement (13c / 13d)
- Enables: attribute-level lazy fetching for `@Basic(fetch=LAZY)` + lazy **non-polymorphic** associations; interception- instead of snapshot-based dirty detection; adds a default constructor where missing.
- 🔴 **Without the enhancer `@Basic(fetch=LAZY)` is IGNORED and the column is fetched eagerly** — no exception, no warning (intro §9.15).
- 🔴 Gradle trap, quoted verbatim from intro §9.15: `hibernate { enhancement }` (no braces) *"will result in bytecode enhancement NOT happening (unfortunately silently)"* — must be `enhancement {}`.
- Gradle `EnhancementSpec`: `enableLazyInitialization` **true**, `enableDirtyTracking` **true**, `enableAssociationManagement` **false**. All "deprecated for removal".
- Maven: `org.hibernate.orm:hibernate-maven-plugin:7.4.6.Final`, goal `enhance`, `classesDirectory` defaults to `{project.build.directory}/classes`. Same defaults + `enableExtendedEnhancement` false.
- **Deprecation means the OFF SWITCH goes, not the feature**: *"After this removal, lazy loading will always be enabled."*
- Runtime enhancement (UG §29.1.1) is scoped to Jakarta EE containers via `jakarta.persistence.spi.ClassTransformer`; the 3 `hibernate.enhancer.*` settings *"all default to false"*. ⚠️ Could NOT confirm they work in a plain Boot jar — written as uncertain.
- `@LazyGroup` (UG §6.2.1): by default **all singular lazy attributes are ONE group**; lazy **plural** attributes are each their own group.
- Extended enhancement **deprecated**; bidirectional association management **deprecated** ("Users should instead manage both sides of such associations directly").
- Bidirectional `@OneToOne` parent side: UG mapping chapter says lazy cannot be honoured, recommends unidirectional + `@MapsId`, else *"you need to enable lazy state initialization bytecode enhancement."*

### Connection handling (for chunk 15)
- UG §8.10.1: **RESOURCE_LOCAL default = `DELAYED_ACQUISITION_AND_RELEASE_AFTER_TRANSACTION`**; JTA default = `..._AFTER_STATEMENT`. Appendix A.3.15 confirms the global default.
- `hibernate.connection.provider_disables_autocommit=true` is what actually delays acquisition when the pool already disables autocommit.
- ⚠️ The docs do **not** state a release point for statements issued **outside** any transaction — write that as uncertain, do not repeat the "OSIV holds the connection for the whole request" folklore as fact.

### OSIV (chunk 15)
- Property `spring.jpa.open-in-view`, appendix description *"Register OpenEntityManagerInViewInterceptor. Binds a JPA EntityManager to the thread for the entire processing of the request."*, **default `true`**.
- Warning text, read from Boot `4.1.x` `JpaBaseConfiguration.JpaWebConfiguration#openEntityManagerInViewInterceptor()`:
  `"spring.jpa.open-in-view is enabled by default. Therefore, database queries may be performed during view rendering. Explicitly configure spring.jpa.open-in-view to disable this warning"`
  🔴 It is logged **only when the property is null (unset)** — setting it explicitly to `true` silences the warning and keeps OSIV on.
- Registration is gated on `@ConditionalOnWebApplication(type = Type.SERVLET)`, `@ConditionalOnClass(WebMvcConfigurer.class)`, `@ConditionalOnMissingBean({OpenEntityManagerInViewInterceptor, OpenEntityManagerInViewFilter})`, `@ConditionalOnBooleanProperty(name="spring.jpa.open-in-view", matchIfMissing=true)`. So **WebFlux and non-web apps never get it**.
- Spring javadoc: *"binds a JPA EntityManager to the thread for the entire processing of the request… to allow for lazy loading in web views despite the original transactions already being completed."*

### 🔴 GOLD — `org.hibernate.Hibernate` javadoc (7.4), used in chunk 17
https://docs.jboss.org/hibernate/orm/7.4/javadocs/org/hibernate/Hibernate.html
- `initialize(Object)`: *"In the case of a many-valued association, **only the collection itself
  is initialized. It is not guaranteed that the associated entities held within the collection
  will be initialized.**"* Throws `HibernateException` if the Session was closed.
- 🔴 **`Hibernate.size(Collection)`** (since 6.1.1) — size *"without fetching its state from the
  database"*. Also **`isEmpty`** (7.0), **`contains`** (6.1.1), **`get(Map,K)`** and
  **`get(List,int)`** (6.1.1), all "without fetching". This is the real answer to
  `getLines().size()` materialising everything.
- `isInitialized(Object)` ≡ `PersistenceUtil.isLoaded`. `isPropertyInitialized(entity, attribute)`
  for enhancement-era per-field laziness.
- ⚠️ `Hibernate.getClass(proxy)` *"will initialize a proxy by side effect"*; so does `isInstance`.
  `getClassLazy` (6.3) avoids it when the type has no subclasses.
- ⚠️ **UG §12.8's batch-fetching example IS a loop over parents touching the collection** — so an
  initialize loop is only an N+1 when the association is not batched. Do not review it as a bug
  without reading the mapping.
- UG §31.6.1 recommends `Hibernate#initialize` for *multiple collections on ONE parent*, to avoid
  a cartesian product — not for looping over parents.

### EAGER (chunk 16)
- UG §31.6.1, verbatim: *"EAGER fetching strategy cannot be overwritten on a per query basis, so the association is always going to be retrieved even if you don't need it. Moreover, if you forget to JOIN FETCH an EAGER association in a JPQL query, Hibernate will initialize it with a secondary statement, which in turn can lead to N+1 query issues. So, EAGER fetching is to be avoided."*

### Hibernate.initialize / caches (chunk 17)
- UG §31.6.1 recommends `Hibernate#initialize(Object proxy)` as a way to trigger secondary queries when avoiding a cartesian product — i.e. it is a legitimate tool, just not a loop fix.
- UG §14.5 **Collection cache**: `@Cache` must go on the collection property; for `@OneToMany`/`@ManyToMany` *"the collection cache entry will store the entity identifiers only."* Read-through, **not** write-through — any modification invalidates the entry.
- UG §31.7: 2LC stores *"normalized dehydrated entity entries"*; four strategies READ_ONLY / NONSTRICT_READ_WRITE / READ_WRITE / TRANSACTIONAL; READ_WRITE is the recommended default; NONSTRICT_READ_WRITE allows stale updates. The guide lists DB tuning / JDBC batching / replication as things to try *before* a 2LC.
- UG §14.6 query cache off by default (`hibernate.cache.use_query_cache`), per-query opt-in via hint `org.hibernate.cacheable`.
- 🔴 **Query cache LAYOUT** (UG §14.6 area): `FULL` vs `SHALLOW` (identifier / collection owner key only); default `AUTO` picks **SHALLOW** for cacheable entities/collections. *"Whenever a shallow cached entity/collection can not be found in the second level cache, Hibernate ORM will load the data from the database by identifier or collection owner key respectively, which can lead to a lot of additional queries"* — **the query cache can MANUFACTURE an N+1.** Also `SHALLOW_WITH_DISCRIMINATOR`.
- UG §14.2: default `jakarta.persistence.sharedCache.mode` = **`ENABLE_SELECTIVE`** ("Default and recommended value"); *"By default, entities are not part of the second level cache and **we recommend you to stick to this setting**."*
- Strategy wording §14.2: read-only / read-write ("consistent access to single entity, but not a serializable transaction isolation level") / nonstrict-read-write ("occasional stale reads") / transactional ("serializable transaction isolation level").
- `hibernate.cache.auto_evict_collection_cache` **disabled by default** — without it, changing only the owning side of a bidirectional association leaves the cached inverse collection **stale**.
- Concurrency strategy is fixed at the **root** entity of an inheritance hierarchy (`@Cacheable` overridable per subclass since 5.3, strategy not).
- `@Cache` attributes: `usage`, `region`, `include` (default `all`; `non-lazy` excludes lazy properties).

## Traps hit

(none yet)

## 🔴 RESUME HERE

✅ **FORK 08b IS COMPLETE — all 17 files written, QC'd, nothing queued.**

Nothing to resume. If this fork is re-run, the work is done; the remaining topic-08 work
belongs to fork 08a (`08e2`–`12c` range).

### 🔴 Handover notes for the coordinator
1. **Repoint these placeholders once 08a lands** — I wrote them as bold plain text
   *(not written yet)*: `@EntityGraph`, `@BatchSize`, subselect fetching, projections /
   DTO queries, Spring Data projections. 21 occurrences across 8 files.
   ⚠️ As of my last `git status`, **`09-entity-graph.md`…`09h` and `10-batch-size.md`/`10b`
   NOW EXIST on disk** (08a renamed/expanded as it split, plus `08e3`, `08e4`). Subselect
   (11) and projections (12) still do not.
2. **⚠️ POSSIBLE DUPLICATION TO CHECK**: topic 06 (`06-jpa-hibernate-model/`) has an
   untracked **`18c-open-in-view.md`** and **`19-the-checklist.md`**. My `15`/`15b`/`15c`
   cover OSIV as *not a fix for N+1*; topic 06's presumably covers it as persistence-context
   lifetime. Also two files named `19-the-checklist.md` now exist in two topics. Worth a
   read-through for overlap before wiring.
3. Positions 50–66 are contiguous and in reading order; renormalise as planned.
4. Every file ends with a bare `<!--FOOTER-->`. I wrote no footers and touched no board,
   `README.md`, `_category_.json` or `_plan.md`. I committed nothing in devbible.

⚠️ Outbound links already written that MUST exist by the end (I own all of them):
- `18-fetching-belongs-to-the-call-site.md` ← linked from `14d`
- `16-eager-is-not-a-fix.md` ← linked from `13b`, `14`, `15c`
- `17-initialize-loops.md` ← linked from `15c`
(`15`, `15b`, `15c` all exist now.)

### OSIV chunk-15 arguments (all sourced)
- 15  = what it is, the Boot default + the warning-only-when-null trap, servlet-only conditions.
- 15b = the COSTS: queries outside the transaction → response assembled from 2+ points in time
  (correctness, not perf); writes during rendering are lost UNLESS a later txn joins the same
  context and flushes them; connection demand extends into response writing (⚠️ do NOT claim
  "holds the connection for the whole request" — undocumented, stated as uncertain); persistence
  context holds every entity until the response is written; traces blame the serialiser.
- 15c = the 7 breakages: serialisation LIE; **repository call with NO `@Transactional`** (the
  deep one — OSIV was providing the ambient session); controller navigation; templates;
  exception handlers/audit; `@PostAuthorize`; async/streaming (`AsyncWebRequestInterceptor`).
  Not-fixes: `@Transactional` on the controller (message converter runs AFTER the handler
  returns, so it does not even fix serialisation), `Hibernate.initialize` loops, EAGER,
  blanket `@JsonIgnore`.
