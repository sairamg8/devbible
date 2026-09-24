---
name: progress-java-p11-t08-test-data-patterns
description: Phase 11 topic 08 (test data patterns) — what is written, the band map for the three authors, the proven splits, and the documentation facts established so nobody re-derives them.
metadata:
  type: project
---

# Java · Phase 11 · Topic 08 — Test data patterns

Session `5bd19f1e`, 2026-08-31. ✅ **CLOSED** — 34 chunks + `README.md` index, **8,999 lines,
450 ★**, positions contiguous 1–34, all four UI boards wired, everything committed.
Built by the coordinator plus **two** `devbible-author` forks inside the one topic on disjoint
`sidebar_position` bands (1–19 / 20–39 / 40–59), collapsed to 1–34 at close.

## The band map (3 agents, the ceiling — coordinator + 2 forks, one topic)

| Band | Who | Files |
|---|---|---|
| 1–19 | coordinator | `01`, `01b`, `02`, `02b`, `02c`, `02d`, `03`, `03b`, then `08-the-checklist` + `README.md` |
| 20–39 | fork A | `04` `@Sql` fixtures · `05` cleanup · `05b` order-dependent tests |
| 40–59 | fork B | `06` random and time · `07` faker and generated data |

Positions are deliberately gappy while the forks run; **the coordinator renumbers contiguously
at topic close**, then writes the `README.md` index.

## Written and committed by the coordinator

| File | Lines | ★ | Commit |
|---|---|---|---|
| `01-the-forty-line-setup.md` | 282 | 13 | `64495004` |
| `01b-what-the-fix-is-not.md` | 296 | 15 | `64495004` |
| `02-the-builder.md` | 252 | 10 | `d8e3ec73` |
| `02b-builder-design-rules.md` | 191 | 9 | `d8e3ec73` |
| `02c-where-builders-live-and-lombok.md` | 244 | 12 | `d8e3ec73` |
| `02d-builders-and-records.md` | 267 | 14 | `2dfeb974` |
| `03-object-mothers.md` | 277 | 14 | `02c995e6` |
| `03b-when-a-mother-becomes-a-god-object.md` | 249 | 15 | `02c995e6` |

## EIGHTEEN splits, every one proven (before → after, both totals UP)

Coordinator: `01`→`01`+`01b` 319/16 → **578/28** · `02`→`02`+`02b` 348/17 → **551/26** ·
`02b`→`02b`+`02c` 302/16 → **435/21**.
Fork A: `04` 457/17 → **836/40** (three-way) · `04c` 369/15 → **562/26** ·
`04d` 321/15 → **486/24** · `05` 337/15 → **480/23**.
Fork B: `06` 540/18 → **573/24** · `06b` 392/12 → **563/25** · `06c` 401/19 → **558/27** ·
`06e` 359/15 → **556/28** · `06g` 353/18 → **515/26** · `07c` 347/17 → **461/23** ·
`07`→`07`+`07b` with both gotchas moved verbatim.
**Nothing was trimmed anywhere.**

The working pattern from topic 07 held: write to exhaustion, let the PostToolUse cap hook flag
it, split on the concept boundary the page already had, redistribute the gotchas and questions
to the half each belongs to, and **add** the ones the new boundary makes obvious.

## 🔴 Documentation facts established — do NOT re-derive

- **Lombok `@Builder` ignores field initializers.** An unset field gets `0` / `null` / `false`;
  the initializer is only honoured with `@Builder.Default`. And with an **explicit** constructor
  (not a Lombok-generated one) the defaults stop applying automatically. Source:
  projectlombok.org/features/Builder. This inverts the property a test-data builder exists for,
  and is the reason `@Builder` on a domain class is a poor test builder.
- **`toBuilder()` is a shallow copy** — mutable components are shared with the original.
- **Gradle `java-test-fixtures`**: creates a `testFixtures` source set published as its own
  variant; consumed as `testImplementation(testFixtures(project(":lib")))`; fixtures see *main*,
  tests see *fixtures*. Source: docs.gradle.org `java_testing.html`. Maven's counterpart is the
  JAR plugin's `test-jar` goal, which drags the module's whole test-class output.
- 🔴 **JEP 468 · Derived Record Creation is still status CANDIDATE and was NOT delivered — not
  even as a preview — in JDK 23, 24 or 25.** So there is no `record with { … }` on the pinned
  stack and every copy-with-changes is hand-written. Verified 2026-08-31 (openjdk.org/jeps/468
  returns 403 to WebFetch; confirmed via the JDK 25 feature list and the JEP's own history).
- A **record may not declare instance fields**, so `@Builder.Default` has nothing to attach to;
  record defaults must live in the builder.
- A record's generated `equals` delegates to `BigDecimal.equals`, which is **scale-sensitive**.

## 🔴 Fork B's banked research — java.time, randomness, Spring bean overrides

- 🔴 **`@MockitoBean` uses `REPLACE_OR_CREATE`** — *"If a corresponding bean does not exist, a new
  bean will be created."* So mocking a `Clock` that was never declared **creates** it, the test
  goes green, and the application has no clock. `enforceOverride = true` switches to `REPLACE`.
  Also: the mock *"is never wrapped in a Spring AOP proxy"*. **`@TestBean` is the right tool for a
  fixed clock** (static factory method, no args, compatible return type). This is the strongest
  finding in the Spring half and the reason chunk `06f` exists.
- **`InstantSource` is Since 17**, not a JDK 25 novelty; **`Clock` is its only JDK implementation**,
  so one `Clock` bean satisfies both injection points — but declaring the bean *as* `InstantSource`
  breaks `Clock` injection points, because the container matches the declared type.
- **`LocalDate.now()` javadoc, the best quote in the topic:** *"Using this method will prevent the
  ability to use an alternate clock for testing because the clock is hard-coded."* The same
  sentence is on `now(ZoneId)`; only `now(Clock)` says the opposite.
- **`RandomGenerator` has NO seeded factory.** `RandomGenerator.of(name)` takes no seed; the seeded
  route is `RandomGeneratorFactory.of(name).create(seed)`, documented to throw
  `UnsupportedOperationException` if the algorithm cannot be seeded with a `long`.
- 🔴 **The reproducibility guarantee is documented for `java.util.Random` ONLY** — *"Java
  implementations must use all the algorithms shown here for the class Random, for the sake of
  absolute portability"* — and the `java.util.random` package makes **no equivalent promise for
  LXM/Xoshiro**, while recommending migration away from `Random`. Written in-page as an explicit
  uncertainty. `getDefault()` selects `L32X64MixRandom` and is documented not to be stable over time.
- **`ThreadLocalRandom.setSeed` throws `UnsupportedOperationException`** — untestable by construction.
- **Spring Boot does NOT auto-configure a `Clock` bean** — spring-boot#31397, *closed as not planned*.
  No maintainer rationale was readable, so none is claimed.
- **`DateTimeProvider` IS the auditing seam** — *"The time giving instance is provided by a
  `DateTimeProvider`. By default this is a `CurrentDateTimeProvider`."* Changed via
  `dateTimeProviderRef` or a bean. **Hibernate's `@CreationTimestamp` has no `Clock` seam at all**
  (default `SourceType.VM`, *"may not be directly set by the application program"*).
- **PostgreSQL:** `now()`/`current_timestamp` return the **transaction** start and do not change
  within it (*"This is considered a feature"*); `clock_timestamp()` changes within a statement.
- **`Clock.systemUTC` resolution is unspecified**; `Clock.equals` is `Object.equals` unless
  overridden; `Clock.tick`'s duration must divide into one second without remainder.
- **Awaitility is owned by topic 01** (`../01-junit-5/14c-timing-and-concurrency.md`) and was
  deliberately NOT re-taught here. ⚠️ Upstream is at **4.3.1**; the Boot 4.1.0 BOM manages 4.3.0.
- **Datafaker `net.datafaker:datafaker:2.7.0`**, not in the Boot BOM. Seeding is `new Faker(new Random(0))`.
  🔴 The docs promise predictable *instantiation*, **not value stability across Datafaker versions**
  — flagged as uncertainty, and the golden-file rule is built on it.

## ⚠️ Five claims documentation could NOT settle — left flagged, do NOT "resolve" them from a blog

1. Cross-version reproducibility of seeded LXM algorithms.
2. Datafaker value stability across library versions.
3. A test-time `Clock` recipe for Spring's task schedulers (`TriggerContext` exposes `getClock()`,
   but no documented way to supply one to `ThreadPoolTaskScheduler` in tests).
4. How a failure in an `AFTER_TEST_METHOD` `@Sql` script is attributed in the test report.
5. Sequence `setval` ordering across generators and pooling strategies.

## Environment notes for whoever is next

⚠️ **A sibling session is writing `docs/java/pages/phase-12-*` and `phase-13-*` in this same
checkout.** Its files show up in `git status` constantly. **Never `git add -A`**; always commit
explicit paths, and always `git status --porcelain` after committing.

See [[cursor-java]] for the standing order and [[java-playbook]] for the method.
