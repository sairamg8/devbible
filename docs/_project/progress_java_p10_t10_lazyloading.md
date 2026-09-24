---
name: progress-java-p10-t10-lazyloading
description: Java Phase 10 · Topic 10 · Lazy-loading pitfalls — fork progress
metadata:
  type: progress
---

# Java Phase 10 · Topic 10 · Lazy-loading pitfalls — fork progress

**Status:** research done 2026-08-26, writing started. Fork owns
`docs/java/pages/phase-10-data-access/10-lazy-loading/` **alone**. Tier **Understand**.

## Scope and boundary
- **10 owns the CORRECTNESS failure**: `LazyInitializationException`. Proxy internals, when
  the session closes, the serializer walking the graph, why it never fires in dev, the
  detached entity, the DTO boundary, the fixes-that-are-not-fixes.
- 🔴 **08 (COMPLETE, 61 chunks) owns N+1 and every PERFORMANCE fix** and already has
  `15-open-in-view.md`, `15b-what-open-in-view-costs.md`, `15c-turning-it-off.md`,
  `16-eager-is-not-a-fix.md`, `17-initialize-loops.md`, `12-projections-and-dtos.md`,
  `13c-bytecode-enhancement.md`, `04c-serialization-and-logging.md`. LINK, never re-derive.
- **07** owns proxy basics (`14-what-a-lazy-association-is.md`, `14b-inspecting-initialization.md`,
  `16-serialising-an-entity-graph.md`, `06b-why-lazy-one-to-one-fails.md`,
  `12-fetch-type-defaults.md`). 07/14 explicitly hands off to topic 10 for
  "what happens when the proxy outlives its session".
- **06** owns persistence context / states / flush (`18c-open-in-view.md` = unit-of-work angle).
- Topics **09, 11, 12, 13, 14 DO NOT EXIST** → bold plain text + *(not written yet)*.

## Per-file table

| File | Lines | Gotchas | Qs | Status |
|---|---|---|---|---|
| 01-what-a-proxy-actually-is.md | 289 | 8 | 8 | DONE |
| 01b-type-questions-are-fetches.md | 269 | 8 | 8 | DONE |
| 01c-a-collection-is-not-a-proxy.md | 292 | 9 | 7 | DONE |
| 02-the-exception.md | 273 | 8 | 8 | DONE |
| 02b-where-it-fires.md | 272 | 10 | 10 | DONE |
| 02c-the-mapper-and-the-logger.md | 270 | 12 | 10 | DONE |

## 🔴 VERIFIED LOAD-BEARING CLAIMS (all fetched 2026-08-26)

### The exception messages — 🔴 THE WORDING CHANGED, Hibernate 5 folklore is WRONG
Source: `hibernate-orm` branch `7.4`,
`hibernate-core/src/main/java/org/hibernate/proxy/AbstractLazyInitializer.java`
(https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/proxy/AbstractLazyInitializer.java)

`initialize()` throws exactly one of:
- `"Could not initialize proxy [" + entityName + "#" + id + "] - no session"`
- `"Could not initialize proxy [" + entityName + "#" + id + "] - the owning session was closed"`
- `"Could not initialize proxy [" + entityName + "#" + id + "] - the owning session is disconnected"`
`permissiveInitialization()` adds `"… - session was closed or disconnected"` and
`"… ]: " + e.getMessage()`. `getImplementationEntityName()` throws
`"Could not retrieve real entity name [" + entityName + "#" + id + "] - no session"`.
`setSession` throws **HibernateException** (not LIE): `"Illegally attempted to associate
proxy [" + entityName + "#" + id + "] with two open sessions"`.

Collections — `collection/spi/AbstractPersistentCollection.java`, `throwLazyInitializationException`:
builds `"Cannot lazily initialize collection"` + `" of role '<role>'"` + `" with key '<key>'"`
+ `" (<message>)"`. Messages passed in: `"no session or session was closed"`,
`"session is disconnected"`, `"no session"`, `"the owning session was closed"`,
`"the owning session is disconnected"`, `"collection not associated with session"`,
`"SessionFactory UUID not known; cannot create temporary session for loading"`.
`checkPersister` → `"Cannot lazily initialize collection (collection is being removed)"`.

⚠️ Hibernate 5's famous strings (`could not initialize proxy … - no Session`, `failed to
lazily initialize a collection of role: …`) are GONE in 7.4. Capital C, lowercase "session".

### LazyInitializationException javadoc (7.4)
https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/LazyInitializationException.html
extends `HibernateException`; "Indicates an attempt to access unfetched data outside the
context of an open stateful `Session`."

### AbstractLazyInitializer fields (7.4 source)
`entityName`, `id`, `transient SharedSessionContractImplementor session`, `boolean initialized`,
`Object target`, `boolean readOnly`, `readOnlyBeforeAttachedToSession`, `temporalIdentifier`,
`sessionFactoryUuid`, `sessionFactoryName`, `boolean allowLoadOutsideTransaction`.
`unsetSession()` = `prepareForPossibleLoadingOutsideTransaction(); session = null; readOnly
= false; readOnlyBeforeAttachedToSession = null;`
`getIdentifier()` initialises IF `isInitializeProxyWhenAccessingIdentifier()` — which is
`session != null && sessionFactoryOptions.getJpaCompliance().isJpaProxyComplianceEnabled()`.

### HibernateProxy (7.4 javadoc)
"Interface implemented directly by entity proxies, exposing access to the associated
LazyInitializer." extends `Serializable`, `PrimeAmongSecondarySupertypes`. Methods:
`getHibernateLazyInitializer()`, static `extractLazyInitializer(Object)` ("Extract the
LazyInitializer from the given object, if and only if the object is actually a proxy.
Otherwise, return a null value."), `writeReplace()`, `asHibernateProxy()` (@Internal).

### Hibernate static helpers (7.4 javadoc)
https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html
- `initialize(Object)`: "Force initialization of a proxy or persistent collection. In the
  case of a many-valued association, only the collection itself is initialized." throws
  `HibernateException` if it cannot be initialized, e.g. the Session was closed.
- `isInitialized(Object)`: true if already initialized, **or is not a proxy or collection**.
- `unproxy(Object)` / `unproxy(Object, Class)`: throws **LazyInitializationException** if
  called on an uninitialized proxy not associated with an open session.
- `isPropertyInitialized(Object,String)`.
- `getClass(Object)`: "Get the true, underlying class of a proxied entity. This operation
  will initialize a proxy by side effect."

### Settings
- `ENABLE_LAZY_LOAD_NO_TRANS` = `hibernate.enable_lazy_load_no_trans`, default **false**,
  marked **@Unsafe**. Javadoc: "Allows a detached proxy or lazy collection to be fetched
  even when not associated with an open persistence context, by creating a temporary
  persistence context when the proxy or collection is accessed." apiNote: "Generally
  speaking, all access to transactional data should be done in a transaction. Use of this
  setting is discouraged."
  https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/TransactionSettings.html
- `JPA_PROXY_COMPLIANCE` = `hibernate.jpa.proxy_compliance` (defaults from `hibernate.jpa.compliance`).
  "The JPA specification insists that an EntityNotFoundException must be thrown whenever an
  uninitialized entity proxy with no corresponding row in the database is accessed."
  Enabling it makes Hibernate initialize the proxy when its **identifier** is accessed —
  documented as not recommended (unnecessary round trips).
  https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/JpaComplianceSettings.html

### getReference / getReferenceById → EntityNotFoundException, NOT LazyInitializationException
- Jakarta Persistence 3.2 `EntityManager.getReference(Class,Object)`: "Obtain a reference to
  an instance of the given entity class with the given primary key, whose state may be
  lazily fetched." … "If the requested instance does not exist in the database, the
  `EntityNotFoundException` is thrown when the instance state is first accessed. (The
  persistence provider runtime is permitted but not required to throw the
  EntityNotFoundException when getReference() is called.)"
  @throws EntityNotFoundException "if the entity state cannot be accessed".
- Spring Data `JpaRepository.getReferenceById(ID)`: "Returns a reference to the entity with
  the given identifier. Depending on how the JPA persistence provider is implemented this is
  very likely to always return an instance and throw an EntityNotFoundException on first
  access. Some of them will reject invalid identifiers immediately." Since 2.7.

### open-in-view (Boot 4.1)
- Appendix row (docs.spring.io/spring-boot/appendix/application-properties/): property
  `spring.jpa.open-in-view`, description **"Register OpenEntityManagerInViewInterceptor.
  Binds a JPA EntityManager to the thread for the entire processing of the request."**,
  default **`true`**.
- Warning, verbatim from `4.1.x` `module/spring-boot-jpa/.../JpaBaseConfiguration.java`
  lines 259-267, fires only when `jpaProperties.getOpenInView() == null`:
  `"spring.jpa.open-in-view is enabled by default. Therefore, database queries may be
  performed during view rendering. Explicitly configure spring.jpa.open-in-view to disable
  this warning"`

### @NotFound defeats LAZY — VERIFIED (User Guide 7.4 §3.8.5)
"**@ManyToOne and @OneToOne associations annotated with @NotFound are always fetched eagerly
even if the fetch strategy is set to FetchType.LAZY.**" `NotFoundAction.EXCEPTION` (default)
→ `FetchNotFoundException`; `IGNORE` → treated as null. Both make Hibernate assume there is
no physical FK. Alternative: `jakarta.persistence.ForeignKey(NO_CONSTRAINT)`.
https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html

### 🔴 The nullable-@ManyToOne trap — WHAT I COULD AND COULD NOT CONFIRM
The brief asked me to verify that a *nullable* `@ManyToOne(fetch=LAZY)` behaves differently
from a non-nullable one. **I could NOT find any 7.4 statement that a nullable @ManyToOne
whose FK is on the owning table is fetched eagerly**, and the mechanism argues against it:
the FK value arrives with the owning row, so Hibernate can decide null-vs-proxy with no
query. What the 7.4 *Introduction* §3.18 DOES document is the **@OneToOne mappedBy** case,
verbatim: "not every Person has an associated Author, and the foreign key is held in the
table mapped by Author, not in the table mapped by Person. Therefore, Hibernate can't tell
if the reference from Person to Author is null without fetching the associated Author." Fix
shown: `@OneToOne(optional = false, mappedBy = …, fetch = LAZY)`.
The two documented `@ManyToOne` cases that DO defeat LAZY are (a) `@NotFound` (above) and
(b) the association mapped through a `@JoinTable` (Intro §4.4 shows `@ManyToOne(fetch=LAZY)
@JoinTable`; the Intro also notes "For associations mapped to a @JoinTable, fetching the
association requires two joins"). **The page states this distinction and says plainly what
is unconfirmed.**

### Jackson — 🔴 BOOT 4.1 IS JACKSON 3, group id changed
- Boot reference "JSON": "Jackson 3 is the preferred and default library. Support for
  Jackson 2 is deprecated and will be removed in a future Spring Boot 4.x release."
  Auto-configures a **`JsonMapper`** bean (not `ObjectMapper`).
  https://docs.spring.io/spring-boot/reference/features/json.html
- `JacksonAutoConfiguration` (4.1.x) `StandardJsonMapperBuilderCustomizer(JacksonProperties,
  Collection<JacksonModule> modules, …)` ← **any `JacksonModule` bean is auto-registered.**
- Hibernate module artifacts (verified on repo1.maven.org):
  - Jackson 2 line: `com.fasterxml.jackson.datatype:jackson-datatype-hibernate7` (2.22.2)
  - **Jackson 3 line: `tools.jackson.datatype:jackson-datatype-hibernate7` (3.2.2)** ← Boot 4.1
  - class `tools.jackson.datatype.hibernate7.Hibernate7Module extends tools.jackson.databind.JacksonModule`
  - README: "Jackson 2.15 adds Support for Hibernate 6.x … Jackson 2.20 adds Support for
    Hibernate 7.x". hibernate5 has a `-jakarta` variant; 6 and 7 are Jakarta-only.
  - `Hibernate7Module.Feature` enum with defaults: `FORCE_LAZY_LOADING(false)`,
    `USE_TRANSIENT_ANNOTATION(true)`, `SERIALIZE_IDENTIFIER_FOR_LAZY_NOT_LOADED_OBJECTS(false)`,
    `REQUIRE_EXPLICIT_LAZY_LOADING_MARKER(false)`, `REPLACE_PERSISTENT_COLLECTIONS(false)`,
    `WRITE_MISSING_ENTITIES_AS_NULL(false)`, `WRAP_IDENTIFIER_IN_OBJECT(true)`.
    WRITE_MISSING_ENTITIES_AS_NULL javadoc: "Using FORCE_LAZY_LOADING may result in
    jakarta.persistence.EntityNotFoundException. This flag configures Jackson to ignore the
    error and serialize a null."

### Hibernate's own recommended strategy (Intro §5.6) — quotable
"All associations should be set fetch=LAZY to avoid fetching extra data when it's not
needed… But strive to avoid writing code which triggers lazy fetching. Instead, fetch all
the data you'll need upfront at the beginning of a unit of work, using one of the techniques
described in Association fetching, usually, using join fetch in HQL or an EntityGraph."
Free operations on an unfetched proxy: read the id; use it as the target of an association
(`getReference`).

### Intro §5.6 gotcha 1, verbatim
"Hibernate will only do this for an entity which is currently associated with a persistence
context. Once the session ends, and the persistence context is cleaned up, the proxy is no
longer fetchable, and instead its methods throw the hated LazyInitializationException."

## RESUME HERE

🔴 **Next file: `03-why-it-never-fires-in-dev.md`, `sidebar_position: 7`.**

Positions so far: 01=1, 01b=2, 01c=3, 02=4, 02b=5, 02c=6.

### Corrections applied this run (coordinator instruction 2026-08-26)
- 🔴 **`<!--FOOTER-->` BREAKS THE BUILD** (invalid MDX). Every page must end with the literal
  line `{/* FOOTER */}` instead. All 6 existing files were `sed`-converted. **Never put a bare
  `<!-- -->` HTML comment in prose anywhere** — only inside a fenced code block.
- `02-the-exception.md` linked to a non-existent `02b-the-collection-message.md`; the collection
  message is already fully covered by `01c`, so the link was repointed to
  `01c-a-collection-is-not-a-proxy.md`.
- `02-the-exception.md` still forward-links to **`06b-more-fixes-that-are-not-fixes.md`** and
  **`04b-what-still-works-when-detached.md`** — BOTH MUST BE CREATED. That fixes the Jackson
  chunk's name to **`06c-jackson-and-the-hibernate-module.md`** (not 06b), which matches the
  plan list in this file rather than the coordinator brief's list.
- 02b was written at 377 lines and split on a concept boundary: 02b = the two response-path
  callers (serialiser, template); 02c = the two non-response-path callers (reflective mapper,
  log statement) + reading the stack trace.

### Boundary reminders confirmed by reading topic 08 this run
`08/15-open-in-view.md` (what OSIV does + the warning), `08/15b-what-open-in-view-costs.md`
(queries outside the tx, writes, pool, traces) and `08/15c-turning-it-off.md` (**the seven
breakages catalogue with a fix for each**) are ALREADY WRITTEN and thorough. So:
- `03-why-it-never-fires-in-dev.md` = the *correctness* angle only — OSIV as the reason the
  exception is absent, plus every OTHER reason it hides in dev (single user, small data,
  H2/dev fixture, a test that shares a transaction, the debugger, log level, warm caches).
  Link to 08/15 for the mechanism, do not re-derive it.
- `07-turning-open-in-view-off.md` = the *procedure and the property mechanics* — the exact
  property, its default, the verbatim warning, doing it in tests first, and how to read each
  exception it uncovers. **Link to `08/15c` for the seven-breakage catalogue; do not repeat it.**
- `06-fixes-that-are-not-fixes` must NOT re-derive EAGER (08/16) or `Hibernate.initialize`
  loops (08/17) as *performance* arguments — argue only that they do not close the boundary.
- `05`/`05b` must NOT re-derive projections-as-an-N+1-fix (08/12, 12c, 12c2, 12d) — argue the
  boundary contract and *when the values are read*.
- Jackson cycle patches (`@JsonIgnore`, `@JsonManagedReference`, `@JsonIdentityInfo`) are
  already in `../07-relationships-fetch/16-serialising-an-entity-graph.md`. `06c` owns the
  **lazy-specific** Hibernate Jackson module only.

### Remaining file list (a plan, not a budget)
`03-why-it-never-fires-in-dev` (7) · `03b-the-other-reasons-it-hides` (if 03 overflows) ·
`04-the-detached-entity` · `04b-what-still-works-when-detached` (REQUIRED, linked from 02) ·
`05-the-dto-boundary` · `05b-mapping-to-a-dto` · `06-fixes-that-are-not-fixes` ·
`06b-more-fixes-that-are-not-fixes` (REQUIRED, linked from 02) ·
`06c-jackson-and-the-hibernate-module` · `07-turning-open-in-view-off` ·
`08-lazy-basic-attributes` · `09-the-checklist`

### Still to verify before writing (not yet fetched)
- `@Basic(fetch = LAZY)` — the Jakarta Persistence 3.2 wording that LAZY on a basic is a
  **hint**, and what Hibernate 7.4 does on a detached enhanced entity's lazy attribute.
- The Hibernate 7.4 bytecode-enhancement plugin coordinates (Gradle/Maven) — needed for
  `08-lazy-basic-attributes`.

---

## Session `0f9ee927` — 2026-08-27 — salvage of `8f239b23`'s abrupt close

`8f239b23` died with `08-lazy-basic-attributes.md` written but never committed, at **379
lines** — 79 over the cap. Nothing was truncated; the file was complete, footer included.
It was split on the `## Why @Lob is the wrong reflex` boundary, nothing trimmed:

| File | Lines | Pos | What it owns |
|---|---|---|---|
| `08-lazy-basic-attributes.md` | 175 | 26 | Why a proxy cannot stand in for a field; the Jakarta 3.2 `@Basic` hint-vs-requirement asymmetry; the silent-ignore failure direction and why a statement-count assertion is blind to it |
| `08b-the-lob-reflex-and-the-group.md` | 256 | 27 | `@Column(length = LONG32)` vs `@Lob`; the PostgreSQL OID consequence; the LOB locator's transaction lifetime; `optional` on a `@Basic` vs on a `@OneToOne`; lazy groups; the projection answer |

Gotchas and interview questions were distributed to the half each is about — 5 gotchas + 4
questions to `08`, 5 gotchas + 3 questions to `08b`. Committed `f7eaeb74`.

🔴 **The planned enhancement chunk moved `08b` → `08c-when-enhancement-is-on.md`** to free
the letter. Both files link to it under that name.

### The resolver blind spot, confirmed again

`fixlinks.py` reported **0 unresolved** on three links that do not exist:
`08c-when-enhancement-is-on.md` (from both `08` and `08b`) and `09b-symptom-to-chunk.md`
(from `08b`). They were only found by resolving each `](*.md)` target against the filesystem
by hand. This is the §11i warning, and it is not limited to file→directory conversions — it
also misses a plain forward reference to a chunk that was never written. **Check links with
`ls`, not with the resolver alone.**

### Also done this session

- `11-flyway-migrations/_moved_bits.txt` and `_moved_body.txt` deleted (`58364fc2`). Every
  passage was verified present in the committed `09b-what-the-lock-actually-covers.md`
  first — the history-table creation race, the per-migration lock loop, the interleaved
  rollout, the `group: true` gotcha and all three interview questions.
- The **"one known defect"** in the syllabus cursor — `07b-doing-the-migration.md` at 318
  lines — is **stale**. That file is 216 lines on disk; the split was already done. Nothing
  in topic 10 is over the cap.

### Outstanding in topic 10 at the time of writing

`08c-when-enhancement-is-on.md` (pos 28) · `09-the-checklist.md` (29) ·
`09b-symptom-to-chunk.md` (30) · `README.md` index. A topic is not closed without the index.

## ✅ TOPIC CLOSED — 35 chunks + index, session `0f9ee927`, 2026-08-27

`6d7d4d39` (08c–08c5, 09) · `fe783c1d` (09b, 09b2) · `4dd24bda` (README + 10 inbound
placeholders) · boards `01fe9d53`. Positions 0–35, no gap, no reuse. Phase 10 → 13/14.

The dispatch named four files; `08c` and `09b` each split twice on concept boundaries —
`08c` into the read and its message → writes and checks → the entity's own methods → the
enhanced instance → serialisation; `09b` into symptoms that are a different Hibernate
exception → symptoms that are not an exception at all.

### 🔴 A near-miss worth remembering: the fork revised a file I had already committed

I committed `09b` at 215 lines mid-flight (cadence). The fork then kept working and left a
278-line version on disk, so it showed as `M`, not `??` — and the fork's own report flagged it
as a possible overwrite of my commit. **It was the other way round.** Diffed before staging:
17 routing rows against the committed 5, six gotchas against three, four questions against
three. A strict superset. **Diff `M` files against HEAD before assuming which side is newer** —
committing mid-flight makes a fork's later revision look like a regression.

### Load-bearing quotes banked

- **The enhancement-path exception** (`EnhancementHelper`, hibernate-orm 7.4 source):
  `"Unable to perform requested lazy initialization [%s.%s] - %s"`, four tails — `no session
  and settings disallow loading outside the Session` · `session is closed…` · `session is
  disconnected…` · `could not determine SessionFactory UUId to create temporary Session for
  loading`. 🔴 **The fork diffed 6.2 / 6.6 / 7.4 and the format string is byte-identical:
  Hibernate 7 did NOT reword this one.** It reworded only the `AbstractLazyInitializer` proxy
  strings, which `02-the-exception.md` already owns. Correct the record if a page says
  otherwise.
- **`Hibernate.isPropertyInitialized`** — *"If the named property does not exist or is not
  persistent, this method always returns `true`."*
- **The `Hibernate` class javadoc on the enhanced representation** — *"the associated entity
  instance is initially in an unloaded state, with only its identifier field set… Typecasts,
  the Java `instanceof` operator, and `Object.getClass()` may be used as normal"*, and *"As an
  exception to the above rules, polymorphic associations always work as if bytecode
  enhancement was not enabled."*
- **`@NotFound`** (user guide §3.8.5) — *"always fetched eagerly even if the fetch strategy is
  set to `FetchType.LAZY`"*; `FetchNotFoundException extends EntityNotFoundException`.
- **jackson-datatype-hibernate** — `Hibernate7Serializers.findSerializer` matches only
  `HibernateProxy`, so the module never covered lazy basic attributes, and **enhancement
  removes its cover from non-polymorphic associations too.**

### Stated as uncertain on the page, not asserted

1. Whether Bean Validation reads a lazy attribute at pre-update — `ValidationMode.AUTO` is
   documented, the interaction is not. `08c3` flags it and tells the reader to check their SQL.
2. `serialVersionUID` differing between enhanced and unenhanced builds — a deduction from two
   specs, not a documented Hibernate claim. `08c5` says so in prose and again in the answer.
3. The Java-serialisation round trip returning `null` rather than throwing — presented as
   mechanism derived from sourced facts, not as documented behaviour.

`_plan.md` still lists the original 13-chunk plan against 35 on disk. Expected; `README.md` is
the authoritative index.
