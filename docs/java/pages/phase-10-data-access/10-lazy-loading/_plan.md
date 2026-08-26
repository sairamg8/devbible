# Topic 10 · Lazy-loading pitfalls — chunk plan

Tier: **Understand**. Target: Hibernate ORM 7.4.1, Jakarta Persistence 3.2, Spring Boot
4.1.0, Jackson 2.x, JDK 25.

## Boundary (fixed, do not cross) — 🔴 READ THIS FIRST, 08 OVERLAPS HARD

- **10 owns** — the **failure**: `LazyInitializationException`. What a proxy is, when the
  session closes, the serializer walking the graph, `open-in-view` **as the reason the
  exception does not appear in dev**, DTO boundaries, and the detached-entity story.
- 🔴 **08 owns N+1 and every PERFORMANCE fix for it** — fetch join, `@EntityGraph`,
  `@BatchSize`, projections — **and 08 already has its own `open-in-view` chunk arguing it
  is not a fix.** 10 must argue the *correctness* side (the exception) and **link** to 08
  for the performance side. Do not re-derive either. `ls ../08-the-n-plus-1-problem/` first.
- **06 owns** the persistence context, entity states and flush; **07 owns** fetch-type
  defaults and why `EAGER` on a collection is a time bomb.

## Chunks (a PLAN, not a budget — split at 301 lines, rule 1)

| # | File | What it argues |
|---|---|---|
| 1 | `01-what-a-proxy-actually-is.md` | The subclass Hibernate hands you, and what it holds |
| 1b | `01b-proxies-and-instanceof.md` | `instanceof`, `getClass()`, `equals` and `Hibernate.unproxy` |
| 2 | `02-the-exception.md` | `LazyInitializationException` — the exact message and what each clause means |
| 2b | `02b-where-it-fires.md` | The serializer, the template, the mapper, the log statement, the test |
| 3 | `03-why-it-never-fires-in-dev.md` | `open-in-view` is on by default — the whole reason this topic exists |
| 4 | `04-the-detached-entity.md` | Returning an entity from a `@Transactional` method is a contract you cannot keep |
| 5 | `05-the-dto-boundary.md` | The real fix: never let an entity cross the transaction boundary |
| 5b | `05b-mapping-to-a-dto.md` | By hand, by constructor expression, by projection — and what each costs |
| 6 | `06-fixes-that-are-not-fixes.md` | `Hibernate.initialize`, touching the getter, `@Transactional` on the controller, `EAGER` — each with the reason |
| 6b | `06b-jackson-and-the-hibernate-module.md` | `hibernate6-jakarta` module, `@JsonIgnore`, and why serialising an entity is the root mistake |
| 7 | `07-turning-open-in-view-off.md` | What breaks, and how to fix each breakage properly |
| 8 | `08-lazy-basic-attributes.md` | Column-level laziness needs enhancement — hand off to 08's enhancement chunk |
| 9 | `09-the-checklist.md` | Reviewing a service method for a lazy leak |

## Traps to verify, not assume

- ⚠️ **The exact Boot 4.1 property name, its default, and the wording of the warning** it
  logs. Quote the reference, never a remembered log line.
- ⚠️ **Jackson's Hibernate module artifact id changed** for Jakarta/Hibernate 6+. Verify.
- ⚠️ A `@ManyToOne(fetch = LAZY)` proxy on a **nullable** association behaves differently
  from a non-nullable one (Hibernate cannot return a proxy it may have to make null).
- ⚠️ `getReferenceById` hands back a proxy that throws `EntityNotFoundException` — not
  `LazyInitializationException` — on a missing row.
