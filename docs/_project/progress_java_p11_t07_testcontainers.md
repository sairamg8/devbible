---
name: progress-java-p11-t07-testcontainers
description: Java Phase 11 topic 07 Testcontainers — the 4-agent run of 2026-08-31. Lane map, what the coordinator lane wrote, the three proven splits, and the facts established beyond the banked research.
metadata:
  type: project
---

# Java P11 T07 · Testcontainers — the 2026-08-31 run

Resumed from `CURSOR-JAVA.md` after an abrupt close. On arrival: 3 real chunks
(`01-passed-on-h2-proves-nothing` 233, `01b-where-the-line-is` 209,
`02-what-testcontainers-is` 201) plus **3 `draft: true` 15-line stubs** that are not chunks.
Working tree was clean — no salvage was owed.

## 🔴 The ceiling changed: FOUR agents, not three

> *"along with you deploy 3 more agents to works on"* — the user, 2026-08-31

Supersedes the 3-total ceiling from 2026-08-28. The reason the old ceiling existed —
**accounting, not tokens** — is preserved by keeping all four inside **one topic** on
**disjoint `sidebar_position` bands**: A = 3/5–19, B = 20–39, C = 40–59, coordinator = 60–99.
The coordinator renumbers 1..N at close. One-topic-at-a-time is unchanged.

> *"300 lines file size is hard rule but never a content budget and make sure to other agents
> get these and you"* — the user, same day. It is §1 of the fork brief and is repeated at the
> top of every lane prompt, before anything else.

## ✅ The coordinator lane is CLOSED — 11 files, 2,579 lines, 153 ★

`06-schema-and-data` (60, 272) · `06b-the-defaults-that-silently-stop` (62, 182) ·
`06c-keeping-tests-independent` (65, 160) · `06d-the-rollback-strategy` (67, 289) ·
`06e-truncating-between-tests` (70, 172) · `06f-sql-scripts-and-unique-data` (72, 254) ·
`07-beyond-postgres` (75, 281) · `07b-genericcontainer-and-waiting` (77, 255) ·
`07c-networks-and-image-names` (79, 118) · `09-the-cost` (80, 225, **stub replaced**) ·
`09b-ci-and-alternative-runtimes` (82, 134) · `10-the-checklist` (90, 237).

**Five splits, every one proven:** 409→272+182 (24 ★) · 402→159+287 (23 ★) ·
385→172+254 (24 ★) · 330→255+118 (26 ★) · 315→225+134 (23 ★). Combined line count UP every
time, no ★ lost, sections renumbered on both sides so neither half has a gap in its own argument.

🔴 **Only the `README.md` index is owed by this lane**, and it waits for every lane to close so
the renumber is done once.

## (superseded) the first six files

`06-schema-and-data` (60, 272) · `06b-the-defaults-that-silently-stop` (62, 182) ·
`06c-keeping-tests-independent` (65, 160) · `06d-the-rollback-strategy` (67, 289) ·
`06e-truncating-between-tests` (70, 172) · `06f-sql-scripts-and-unique-data` (72, 254).

**Three splits, every one proven:** 409→272+182 (24 ★ held) · 402→159+287 (23 ★ held) ·
385→172+254 (24 ★ held). Combined line count UP each time, no ★ lost.

🔴 **The working pattern:** write the chunk to exhaustion, let the PostToolUse cap hook flag it,
then split on the concept boundary the page already has and redistribute the gotchas and
questions to whichever half each is about. Record before/after in the commit message — that is
what makes a trim impossible to pass off as a split.

## Facts established beyond `research_java_p11_t07_testcontainers.md`

- **Two of Boot's five schema mechanisms are conditional on the database being embedded**, so
  both silently stop when you replace H2 with a container, and neither logs that it declined.
  *"By default, SQL database initialization is only performed when using an embedded in-memory
  database."* and *"If an embedded database is identified and no schema manager (Flyway or
  Liquibase) has been detected, `ddl-auto` defaults to `create-drop`. In all other cases, it
  defaults to `none`."* This is the single best gotcha in the topic.
- `schema.sql`/`data.sql` alongside Flyway: *"support will be removed in a future release."*
- **The JDBC-URL form's `TC_DAEMON` defaults to false** — *"database container is being stopped
  as soon as last connection is closed"* — which makes `jdbc:tc:` a poor fit for Spring's pooled
  `DataSource`. Also `TC_INITSCRIPT` (with a `file:` variant), `TC_INITFUNCTION` (*"a public
  static method which takes a `java.sql.Connection` as its only parameter"*), `TC_TMPFS`.
- `JdbcDatabaseContainer` has **three** `withInitScript`/`withInitScripts` overloads over a
  `List`, so scripts are ordered. Runs *"after the database container is started, but before your
  code is given a connection to it."*
- `PostgreSQLContainer` 2.0.5 default constants are `test`/`test`/`test` with default tag
  **9.6.12** — reachable only via the shim, since 2.0 dropped the module default constructors.
- 🔴 **Spring's transactional-test false positives, quoted:** *"Failing to flush the underlying
  unit of work can produce false positives: Your test passes, but the same code throws an
  exception in a live, production environment."* Plus entity-lifecycle callbacks not being
  invoked, and the **preemptive-timeout `ThreadLocal` trap** — a `SEPARATE_THREAD` `@Timeout`
  takes the body out of the test-managed transaction, so nothing rolls back and the failure
  lands in a *different* test class.
- *"Any before methods… and any after methods… are run within the test-managed transaction"* —
  which is why a hand-rolled `@AfterEach` cleanup silently does nothing.
- `@SqlConfig` has **ten** attributes; `transactionMode = ISOLATED` *"ensure[s] that the SQL
  scripts are executed in a new, isolated transaction that will be immediately committed"* and
  is the only reason a cleanup script survives. `@Sql`'s `BEFORE_TEST_CLASS`/`AFTER_TEST_CLASS`
  are **Spring 6.1+**. `@SqlMergeMode` defaults to override.
- **New for `@ServiceConnection` (lane B's area):** Boot 4.1 ships `@Ssl`, `@JksKeyStore`,
  `@JksTrustStore`, `@PemKeyStore`, `@PemTrustStore` for container SSL, and
  `RabbitStreamConnectionDetails` is the **one exception** to "all applicable connection details
  beans will be created for a given `Container`". Also *"Container beans are created and started
  once per application context"* and are stopped at context shutdown, which *"usually happens
  after all tests using that specific cached application context have finished executing."*

## Boundary held

Phase 10 owns Flyway-in-tests (`11-testing-migrations`, `11b-wiring-the-container`,
🔴 `11c-the-slice-that-skips-your-migrations` — `@DataJpaTest` imports no Flyway
auto-configuration at all) and topic 07 links rather than repeats. Fixture *shape* (builders,
object mothers) is handed to **08 · Test data patterns**, unwritten.

⚠️ The phase-10 defect stands unfixed and is still the user's call:
`phase-10-data-access/05-sql-first-access/12g-testcontainers-and-serviceconnection.md` is written
against Testcontainers 1.x and does not compile on 2.0.5.

---

# ✅ Lane B CLOSED — `@ServiceConnection`, 11 files, 2,607 lines, 136 ★

Positions 20–30. `04-serviceconnection.md` replaced the 15-line `draft: true` stub.
**Five splits, all proven:** 487/21→701/40 · 309/17→521/27 · 405/22→501/25 · 314/16→419/22 ·
386/17→459/22.

## 🔴 THE CORRECTION — my dispatch brief was WRONG, and the author was right to check

I told lane B: *"the registered properties participate in the context cache key — two test classes
registering different values get different contexts."* **Half of that is false, and the false half
is the dangerous half.**

`DynamicPropertiesContextCustomizer` keys on `Set<Method>`, **not on the values**:

```java
public boolean equals(@Nullable Object other) {
    return (this == other || (other instanceof DynamicPropertiesContextCustomizer that &&
            this.methods.equals(that.methods)));
}
```

So two subclasses inheriting one `@DynamicPropertySource` from a base class resolve to the **same
`Method`** → same customizer → **same cached context**, and the second silently inherits the
first's registered values. Spring's own docs confirm it by prescribing the workaround: *"you may
need to annotate your base class with `@DirtiesContext` to ensure that each subclass gets its own
ApplicationContext with the correct dynamic properties."* Written up correctly in `04c4`.

🔴 **This is the third time in phase 11 that a coordinator brief was wrong and the fork that
verified against the source was right.** Keep the "verify the brief, do not trust it" line in every
brief — it has now paid for itself three times.

## Source facts established beyond the research file

- 🔴 **`@ServiceConnection` matching is three gates** in `ContainerConnectionSource.accepts`:
  connection name (`equalsIgnoreCase` — **case-insensitive, undocumented**),
  `requiredContainerType.isAssignableFrom(containerType)`, and the `type` gate running
  `candidate.isAssignableFrom(requiredConnectionDetailsType)`.
- **"Matched on container type" is implemented by reflection on the factory's own generics** —
  `ResolvableType.forClass(ContainerConnectionDetailsFactory.class, getClass()).resolveGenerics()`.
  Nothing else declares the mapping.
- **Two silent-failure paths** make third-party classes optional: `hasRequiredClasses()` returning
  `null`, and `catch (NoClassDefFoundError ex) { // Ignore }`. This is *how* the third-party Redis
  classes can be absent without breaking anything.
- **The exact failure hint** appended by `ConnectionDetailsRegistrar` when a source has no name:
  `" You may need to add a 'name' to your @ServiceConnection annotation"`.
- **`@ServiceConnection` backs off silently against a pre-existing bean** —
  `getBeanNamesForType(connectionDetailsType)` non-empty → DEBUG
  `"Skipping registration of %s due to existing beans %s"` → return. Per `ConnectionDetails` **type**,
  not per container.
- **TRACE on `org.springframework.boot.testcontainers.service.connection`** logs which gate rejected
  each source. Best available diagnostic; three format strings quoted on the page.
- **`DataRedisConnectionDetails` is the Boot 4.1 name** — no `RedisConnectionDetails` exists in the
  4.1.0 tree.
- **`PropertiesJdbcConnectionDetails` / `PropertiesDataRedisConnectionDetails` exist**, so
  "connection details take precedence over properties" is really "the properties path is itself a
  `ConnectionDetails` bean that backs off".
- **Hazelcast has a working service connection the reference table omits** —
  `HazelcastContainerConnectionDetailsFactory`, `super("hazelcast/hazelcast",
  "com.hazelcast.client.config.ClientConfig")`. Written up as working-but-undocumented.
- **SSL annotations cover exactly 8 services**; Elasticsearch alone auto-detects server-side SSL;
  the Docker Compose SSL list is **shorter** (no Couchbase, no Kafka).
- **`TestcontainersStartup`**: relaxed name parsing; an unknown value **throws**
  `IllegalArgumentException` with no silent fallback; `PARALLEL` uses `Startables.deepStart` so
  `dependsOn` still holds; `start(Startable)` skips already-running containers.
- **`@ImportTestcontainers` imports TWO things** per its javadoc: static `Container` fields *and*
  `@DynamicPropertySource` methods. `value()` defaults to `{}` → it searches the annotated class.
- 🔴 **`@DynamicPropertySource` must be static because it is invoked with a `null` target** during
  `customizeContext`, before any test instance exists — **not** because the container must be
  started. The parameter check is an identity comparison,
  `types[0] == DynamicPropertyRegistry.class`.
- **`DynamicPropertiesContextCustomizerFactory` searches enclosing classes first**, with the source
  comment *"Beginning with Java 16, inner classes may contain static members"* — **the framework's
  own source treats the pre-16 rule as expired**, which corroborates the phase note.
- **`DynamicPropertyRegistrarBeanInitializer` is registered unconditionally**, so registrar beans
  work in any Spring test context.
- **Boot 4.1's dev-time sample registers `spring.mongodb.host`/`.port`**, not `spring.data.mongodb.*`.
- Docker Compose in tests is **off by default** (`spring.docker.compose.skip.in-tests`); minimum
  supported Compose is **2.2.0**; Gradle needs `testAndDevelopmentOnly`.
- 🔴 **The context cache is bounded: *"The size of the context cache is bounded with a default
  maximum size of 32."*** (Framework 7.0.8 `caching.adoc`) — directly relevant to the singleton and
  cost chunks.

## Decision recorded: `08-boot-4-support.md` is ABSORBED, not owed

`_plan.md` scoped chunk 08 as "`@ServiceConnection` coverage, `spring-boot-testcontainers`, and
dev-time containers". **All three are now written**, by lane B, in `04b3`, `04b5` and `04b6`. There
is no residue. **Do not dispatch an 08 — the plan row is satisfied elsewhere.**

---

# ✅ Lane C CLOSED — singleton + reuse, 9 files, 2,231 lines, 123 ★

Positions 40–48. Two proven splits: 490/22 → 1,339/77 (05, 05a, 05a2, 05a3, 05a4) and
650/30 → 892/46 (05b, 05b2, 05b3, 05b4).

## 🔴 It contradicted the research file — and the source won

**`research_java_p11_t07_testcontainers.md` says "Ryuk 0.13.0 in 2.0.x". It is 0.14.0.**
`core/src/main/java/org/testcontainers/utility/RyukContainer.java` at tag 2.0.5 reads
`super("testcontainers/ryuk:0.14.0");`. **The research file is now corrected by this note; do
not re-derive from it.** Testcontainers' own `docs/features/configuration.md` at 2.0.5 is
*also* stale, printing `ryuk.container.image = testcontainers/ryuk:0.3.3` — a third stale-docs
case after the JUnit 4 pages.

## Mechanisms worth keeping

- 🔴 **Why a reused container is never reaped:**
  `if (!reusable) createCommand = ResourceReaper.instance().register(this, createCommand);`
  — no registration means no session label means Ryuk cannot match it. That is the machinery
  behind *"won't stop after all tests are finished"*.
- **The reuse hash** is SHA-1 over the Jackson-serialised `CreateContainerCmd` with sorted
  properties/map keys, stored as label `org.testcontainers.hash`; copied files enter via a
  separate `org.testcontainers.copied_files.hash` (Adler32 over path **and** content).
  `org.testcontainers.version` is in `DEFAULT_LABELS` and merged before hashing, so **an
  upgrade changes the hash** — but the source carries `// TODO add Testcontainers' version to
  the hash`, so that is observed behaviour, not a designed guarantee.
- `findContainerForReuse` filters `["running"]` with `withLimit(1)` and carries a literal
  `// TODO locking` — **two JVMs can race and both create**.
- 🔴 **`withInitScript` re-runs on a reused container**: `JdbcDatabaseContainer` overrides only
  the one-arg `containerIsStarted`, so the `reused` flag never reaches it.
- **Ryuk is a dead-man's switch on an open socket**, not a timer — daemon thread waits for
  `"ACK"`; `ryuk.container.timeout` 30 s then `IllegalStateException`.
  `TESTCONTAINERS_RYUK_DISABLED` is read by bare `System.getenv`, so it **cannot** go in
  `~/.testcontainers.properties`. `ryuk.container.privileged` now defaults to `"true"`, which
  is *why* the old `TESTCONTAINERS_RYUK_PRIVILEGED` advice expired.
- 🔴 `RyukResourceReaper.init()` **skips the eager start when `environmentSupportsReuse()`** —
  a machine-level reuse opt-in changes Ryuk's start timing for **every project on that machine**.
- **The JUnit extension never stops a container in `afterAll`.** `StoreAdapter.close()` does it,
  via JUnit's store cleanup. `findSharedContainers` uses `TOP_DOWN`, so an inherited static
  `@Container` is re-enrolled by every subclass.
- 🔴 **`@Testcontainers` javadoc, stronger than the docs site:** *"This extension has only been
  tested with sequential test execution. Using it with parallel test execution is unsupported
  and may have unintended side effects."* `parallel = true` only starts *containers*
  concurrently — it is unrelated to JUnit's parallel *test* execution.
- `GenericContainer.containerId` is **non-`volatile`** and neither `start()` nor `stop()` is
  synchronized — the idempotence guard is not thread-safe.
- **Boot 4.1 sentence the research file omitted:** *"If the cached application context contains
  beans that depend on a container that has already been stopped, later tests or bean
  destruction callbacks may fail."*

---

# ✅ Lane A CLOSED — the H2 divergence catalogue, 9 files, 2,221 lines, 128 ★

Positions 3, 7–13, 15. **1,277/41 → 2,221/128.** All 28 `###` subsections of the draft survive
in the output. The draft and both `.tmp` scratch files were deleted by the author.

## 🔴🔴 It found a DEFECT IN A COMMITTED PAGE — now fixed

`01b-where-the-line-is.md` listed **`SKIP LOCKED` and `DISTINCT ON`** among constructs "past
the intersection dialect". **H2 2.4.240 parses both.** Verified independently at
`h2database.com/html/commands.html` before editing:
`SELECT [ DISTINCT [ ON ( expression [,...] ) ] | ALL ]` and
`FOR UPDATE [ NOWAIT | WAIT secondsNumeric | SKIP LOCKED ]`.

🔴 **The error was in the weaker direction, and fixing it made the page stronger:** a construct
H2 *rejects* costs a red build you cannot ignore; a construct H2 *accepts and approximates*
costs a **green** one. H2's own words: *"Locking behavior for rows that were excluded from
result using `OFFSET` / `FETCH` / `LIMIT` / `TOP` or `QUALIFY` is undefined"* — and
`FOR UPDATE SKIP LOCKED` with a `LIMIT` **is** the work-queue idiom, so the test passes and the
queue double-delivers. Five occurrences corrected; 209/11 → **232/12**, nothing removed.
Commit `cb122e35`.

## 🔴 And it found my brief wrong AGAIN — the SQLState example

My lane-A brief said *"a handler keyed on PostgreSQL's `23505` never fires under H2"*.
**False.** From `org.h2.api.ErrorCode`: `DUPLICATE_KEY_1` = **23505**, `NULL_NOT_ALLOWED` =
**23502**, `REFERENTIAL_INTEGRITY_VIOLATED_*` = **23503** — all identical to PostgreSQL. The
**real** divergences are `CHECK_CONSTRAINT_VIOLATED_1` = **23513** vs PostgreSQL **23514**, and
H2's `DEADLOCK_1` = **40001** where PostgreSQL splits `serialization_failure` 40001 /
`deadlock_detected` **40P01**. The author refused the claim and wrote the true one.

⚠️ **And Spring hides both**: `SQLStateSQLExceptionTranslator` at `v7.0.8` keys
`indicatesCannotAcquireLock` on `"40001"` only, `DATA_INTEGRITY_VIOLATION_CODES` on class
`"23"`, `PESSIMISTIC_LOCKING_FAILURE_CODES` on class `"40"` — so the exception *hierarchy* is
portable even where the codes are not.

## 🔴 THE TALLY: FOUR briefs/research notes contradicted by the source in this topic alone

1. lane B — dynamic property **values** are not in the context cache key (`Set<Method>` is).
2. lane C — Ryuk is **0.14.0**, not the research file's 0.13.0.
3. lane A — H2 uses **23505** too; the brief's example was backwards.
4. lane A — `01b`'s `SKIP LOCKED` / `DISTINCT ON` claim, in an already-committed page.

**Every single one was caught by an author told to verify the brief rather than comply with it.**
That line is now the highest-value sentence in the fork brief. Never drop it.

## Other source facts banked

- H2 scopes its own compatibility feature: *"only a small subset of the differences between
  databases are implemented in this way."* — the quote chunk 01 wanted and lacked.
- The PostgreSQL-mode list is **17 bullets**, not 20 (20 only if the three `REGEXP_REPLACE`
  sub-clauses count). Chunks 01 and 01b say "twenty"; defensible, arithmetic now stated.
- **Identifier folding, both sides verbatim:** PostgreSQL *"unquoted names are always folded to
  lower case"*; H2 *"With default settings unquoted names are converted to upper case"*.
- **Null ordering defaults are exact opposites** — PostgreSQL *"null values sort as if larger
  than any non-null value"*; H2 `LOW` is the default.
- H2's `JSON` type is *"Mapped to `byte[]`"* → silent double-encoding through `setString`.
- pgJDBC `stringtype` defaults to `VARCHAR`, which is the source of the
  `setString(uuid.toString())` failure; `unspecified` is a whole-application change.
- 🔴 **Boot 4.1.0 `HibernateDefaultDdlAutoProvider.getDefaultDdlAuto`**: embedded + not
  `MANAGED` → `"create-drop"`, else `"none"`; only **two** `SchemaManagementProvider`
  implementations exist (Flyway's, Liquibase's). That is the mechanism behind my own
  `06b-the-defaults-that-silently-stop` chunk.
- H2 `CREATE INDEX` has no `USING`, no expression index, no `WHERE`, no `CONCURRENTLY`, no
  `COLLATE`, no opclass; and *"This command commits an open transaction in this connection"*.
- H2 `MODE=STRICT` is *"recommended … in unit tests"* but *"cannot be used as SQL validator"*.
- Confirmed **by absence** against H2's own complete indexes: no `TEXT`, `jsonb`, `RETURNING`,
  `LATERAL`, `generate_series` (it is `SYSTEM_RANGE`), `string_agg` (it is `LISTAGG`), `~`
  regex operator, advisory locks, `CREATE EXTENSION`, range/network/`tsvector`/`hstore`/`citext`.

## ⚠️ A SIBLING SESSION IS WRITING TO THIS CHECKOUT

Commit `43404358` — *"salvage lane A's final four chunks after the process exited"* — was made
by **another Claude Code session**, not this one. It committed lane A's last four files while
this session was still running. Two consequences worth knowing:

1. **It was wrong about lane D**: it claimed `03-the-junit-integration.md`'s agent *"died
   before writing anything"*. That agent was alive and wrote a 565-line draft minutes later.
   **Do not trust another session's account of an agent you own — check the file's mtime.**
2. A `git index.lock` collision dropped **nine of thirteen files** from one of this session's
   commits (`b1941872`), recovered in `4ce09445`. 🔴 **Always `git status --porcelain` after a
   commit in this checkout** — `git add` in a loop can lose files silently to a concurrent
   session's lock.

---

# ⚠️ TOPIC 07 — the "CONTENT-COMPLETE" call below was PREMATURE

🔴 **Read this before believing the section that follows.** Minutes after it was written the
sibling session produced `03e-the-switches-and-the-limits.md` (386 lines, over the cap and
awaiting its own split). **The topic was still growing.** The lesson is general and worth more
than the numbers: **in a shared checkout you cannot declare a topic complete while another
session is live in it** — completeness is a claim about a directory nobody else is writing to.
Check `ls -lat` and `git status` before any "closed" call, and prefer "content-complete as of
HH:MM, sibling still active" to a flat claim.

The tally below was accurate at 09:53 and is the correct *floor*, not the final number.

# TOPIC 07 tally at 09:53, 2026-08-31

**48 chunks · 11,392 lines · 634 gotchas and interview questions · 0 stubs.**
0 over the 300-line cap · 0 MDX hazards · **0 dangling internal links.**

⚠️ **Commit `e3e1fee6`'s message overstates this as 49 / 11,663 / 647.** It was written
before the final count and not amended, because a sibling session shares this checkout and
rewriting its history is worse than a wrong number in a log line. **These figures are the
authoritative ones.**

The last `draft: true` stub (`03-the-junit-integration.md`) is gone. All three stubs the
topic started with were replaced with real chunks, never skipped.

## The JUnit-integration chunks came from the SIBLING session, not lane D

Positions 16–19: `03-the-junit-integration` (274, 13★) · `03b-static-versus-instance`
(275, 15★) · `03c-the-store-and-the-messages` (283, 18★) · `03d-the-lifecycle-argument`
(256, 13★). Committed here under the per-file cadence rule so a process exit could not
lose them.

🔴 **A live 404 was caught at commit time and fixed:** `03c` linked
`03b-the-lifecycle-argument.md`; the file is `03d-the-lifecycle-argument.md`.
**Rename-after-linking, the phase's second recurring defect, for the third time in this
topic** — and `fixlinks.py` is blind to it. It was caught only by the filesystem loop in
`CURSOR-JAVA.md`'s QC section. **Never accept `fixlinks.py` as the link check.**

## 🔴 What topic 07 still owes before it can be called CLOSED

1. **Contiguous renumber 1..N.** Positions are currently banded and gappy:
   1 2 3 4 7 8 9 10 11 12 13 15 16 17 18 19 · 20–30 · 40–48 · 60 62 65 67 70 72 75 77 79
   80 82 90. Renumber in one pass; **no file rename** — change only `sidebar_position`
   lines, and diff to prove nothing else moved.
2. **`README.md` index** (`sidebar_position: 0`, `sidebar_label: "Overview"`). Copy
   `02-assertj/README.md`'s shape exactly: verified line, lead argument, the full chunk
   table with tier badges, "the N things this topic is really about", "Where this connects".
3. **The four UI boards:** `src/data/progress.js` (java phase 11 `pages: 6` → `7`, and stamp
   `updated:` from `date '+%Y-%m-%d %H:%M'`), the phase `README.md` row for topic 07,
   `docs/java/pages/README.md`, and `docs/README.md`'s claim + technology row.

**Then phase 11 stands at 7/11 and Java at 160/232.** Next topic is **08 · Test data
patterns** — `_plan.md` only, 0 chunks. Do not open it until 07 is closed.

---

# ⏸️ TOPIC 07 CLOSED AND JAVA PARKED — 2026-08-31

> *"Please save current session progress and lets park java here"* — the user

## The close

**50 chunks + `README.md` index, ~11,900 lines, 657 ★, positions contiguous 1–50.** The renumber
moved 47 files and changed **exactly one line each** — line and ★ totals were identical before and
after, which is the proof it was a renumber and not an edit. All four UI boards wired:
`src/data/progress.js` (phase 11 `pages: 6 → 7`, stamped), the phase README, `docs/java/pages/README.md`,
and `docs/README.md`.

## 🔴 The build — a green baseline anyone can cite

Registry row claimed before the run and **cleared immediately after**; `build-j07` and
`.docusaurus-j07` deleted. **4,820 pages, 2,152 Java, 545 MB out, 0 `[ERROR]`, 0 `[WARNING]`,
0 broken links across the entire site.** The three TypeScript MDX failures recorded on 2026-08-17
are **gone**. `mdxcheck.py` reports only the one known false positive.

⚠️ **The verification trap that nearly produced a false report.** Docusaurus emits
`<route>.html`, **not** `<route>/index.html`, and **strips the numeric prefix** — so
`find build -name 'index.html'` returned **1** and `find build -path '*07-testcontainers*'`
returned **0** on a build that was completely fine. I read those two zeros as a broken build and
**had already deleted the output before re-checking**. Re-ran it. 🔴 **Count `*.html` under the
prefix-stripped path, and never delete the artefacts before the check passes.**

## Merge / worktree state, checked on the user's instruction

`git worktree list` → **one worktree**, the main checkout. `git branch -avv` → **only `main`**.
`git branch --no-merged main` → **empty**. `git stash list` → **empty**. So there was nothing to
merge; what was owed was a **push**, and `main` went from 18 commits ahead to in sync with origin.
20 commits deployed.

## Final position

**Java 160/232 topics (69%). Phase 11 at 7/11.** 72 topics remain: 4 in phase 11
(08 · Test data patterns, 09 · JaCoCo, 10 · jqwik, 11 · PIT — all `_plan.md` only) and 68 across
phases 12–16, whose **syllabi are fully written** (topic tables, tier badges, target versions,
phase gates) but which have **zero content pages**.

🔴 **Resume from `CURSOR-JAVA.md` at `08-test-data-patterns/` — but CONFIRM with the user first.**
The park was deliberate.
