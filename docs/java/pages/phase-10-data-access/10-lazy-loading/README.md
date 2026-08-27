---
title: "10 · Lazy-loading pitfalls"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: see each chunk's own `> Verified:` line.

**One exception, taken apart completely: what the object in the field actually is, who calls the
line that throws, why it never happens on your machine, and why the fix is a type change rather
than a setting.**

:::tip Complete — 35 chunks
Six parts. **The object** (a proxy is a generated subclass holding a live session reference; every
type or identity question about it is a fetch in disguise; a collection is a different class with a
different failure). **The exception** (the exact 7.4 strings, what each clause means, and the four
callers who actually produce it — a serialiser, a template engine, a reflective mapper and a log
statement). **Why it hides** (ten independent reasons a lazy access succeeds in development,
sorted into three groups, of which open-session-in-view is only the famous one). **The detached
entity** (the moment of detachment, what still works afterwards, what looks safe and is not, the
four ways the transaction boundary moves without a code change, and the references that outlive or
outstore the method). **The fix and the not-fixes** (the DTO boundary and the three honest ways to
build one; then `Hibernate.initialize`, the warm-up getter, a controller transaction, `EAGER`,
`enable_lazy_load_no_trans` and Jackson's Hibernate module, each with the reason it is a
suppression). **Turning it off** (the exact Boot property, the warning's precise condition, and a
six-step migration with a triage table). It closes on the two places the topic stops being about
associations: column-level laziness and everything bytecode enhancement changes the day it starts
working — then a review checklist and a two-page differential for symptoms that are not this
exception at all.
:::

Boundaries this topic keeps: **08** owns N+1 and every *performance* fix for it — fetch joins,
`@EntityGraph`, `@BatchSize`, projections-as-an-N+1-fix, and how to turn bytecode enhancement on —
so this topic argues the *correctness* side and links there for the rest. **07** owns mappings,
fetch-type defaults and why `EAGER` on a collection is a time bomb. **06** owns the persistence
context, the four entity states, `merge` and flush. **04** owns the `@Transactional` proxy,
propagation and rollback rules. **09** owns repositories and what their return types decide.

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · What a proxy actually is](01-what-a-proxy-actually-is.md)** | A proxy is a generated subclass whose real payload is a live reference to the session that created it, and… |
| 2 | **[01b · Type questions are fetches](01b-type-questions-are-fetches.md)** | Almost every operation that answers a type or identity question about a proxy is a fetch wearing a disguise, so… |
| 3 | **[01c · A collection is not a proxy](01c-a-collection-is-not-a-proxy.md)** | A lazy collection is not a proxy: it is a different class, with a different session check, a different failure… |
| 4 | **[02 · The exception](02-the-exception.md)** | The exception message names the entity, the id and which of three different things went wrong — and in Hibernate 7… |
| 5 | **[02b · Where it fires](02b-where-it-fires.md)** | Almost nobody writes the line that throws — and the two callers that produce it most often, a JSON serialiser and a… |
| 6 | **[02c · The mapper and the logger](02c-the-mapper-and-the-logger.md)** | The other two callers are worse than the serialiser because they are the fix people reach for and the diagnostic… |
| 7 | **[03 · Why it never fires in dev](03-why-it-never-fires-in-dev.md)** | There are at least ten independent reasons a lazy access succeeds, open-session-in-view is only the famous one, and… |
| 8 | **[03b · It was never a proxy](03b-it-was-never-a-proxy.md)** | The larger group of reasons this exception hides is not that the session stayed open — it is that the field never… |
| 9 | **[03c · Something initialised it first](03c-something-initialised-it-first.md)** | The third way this exception hides is the most disorienting: the association really was a lazy proxy, and something… |
| 10 | **[04 · The detached entity](04-the-detached-entity.md)** | Returning an entity from a @Transactional method is a promise about what is loaded that the signature cannot express,… |
| 11 | **[04b · What still works detached](04b-what-still-works-when-detached.md)** | Detachment removes the ability to fetch, not the result of fetches already performed — so a detached entity is an… |
| 12 | **[04c · What looks safe and is not](04c-what-looks-safe-and-is-not.md)** | The other half of the detached list is the operations that read like memory access and go to the database instead —… |
| 13 | **[04d · The boundary moves](04d-the-boundary-is-not-where-you-think.md)** | Three Spring mechanisms move the transaction boundary away from where the @Transactional annotation appears to put it… |
| 14 | **[04e · References that outlive](04e-references-that-outlive-the-method.md)** | A fourth family of detachment bugs involves no transaction annotation at all — a future, a repository Stream or a… |
| 15 | **[04f · References that get stored](04f-references-that-get-stored.md)** | The quieter half of the lifetime problem stores the reference instead of moving it — an HTTP session, a cache entry,… |
| 16 | **[05 · The DTO boundary](05-the-dto-boundary.md)** | The fix is not to keep the session open longer — it is to make sure nothing that needs a session ever leaves the… |
| 17 | **[05b · Mapping to a DTO](05b-mapping-to-a-dto.md)** | There are two honest ways to produce the record — read the entity and map it, or query straight into the constructor… |
| 18 | **[05c · Projections and mappers](05c-projections-and-generated-mappers.md)** | Spring Data's two projection styles are not equally safe at the boundary — a class-based projection is a value, and… |
| 19 | **[06 · Fixes that are not fixes](06-fixes-that-are-not-fixes.md)** | The two fixes applied inside the service — forcing the fetch and warming the getter — each remove one instance of the… |
| 20 | **[06b · More fixes that are not fixes](06b-more-fixes-that-are-not-fixes.md)** | Two of the remaining candidates are applied outside the service — a transaction on the controller and an eager… |
| 21 | **[06b2 · Turning it off](06b2-turning-the-exception-off.md)** | The last three candidates do not try to keep the session open — they remove the failure instead, by fetching without… |
| 22 | **[06c · Jackson and the module](06c-jackson-and-the-hibernate-module.md)** | Jackson's Hibernate module is the most defensible entry on the list and still not a fix — it teaches the serialiser… |
| 23 | **[07 · Turning open-in-view off](07-turning-open-in-view-off.md)** | Before you turn open-session-in-view off you need to know exactly what registers it, what the default is, when Boot… |
| 24 | **[07b · Doing the migration](07b-doing-the-migration.md)** | The migration is six steps and the first two are about tests, because a suite that runs everything inside a… |
| 25 | **[07c · Triage and rollout](07c-triage-and-rollout.md)** | Once the failures are visible the migration becomes a sorting exercise — five buckets with five different fixes, an… |
| 26 | **[08 · Lazy basic attributes](08-lazy-basic-attributes.md)** | A lazy basic attribute is the weakest promise in the specification — LAZY is defined as a hint, Hibernate honours it… |
| 27 | **[08b · The @Lob reflex and the lazy group](08b-the-lob-reflex-and-the-group.md)** | The mapping documentation recommends for a lazy column is not @Lob — the annotation people reach for selects the JDBC… |
| 28 | **[08c · When enhancement is on](08c-when-enhancement-is-on.md)** | The day the enhancer starts running, a getter that returned a value starts throwing — and the exception it throws is… |
| 29 | **[08c2 · Writes and checks](08c2-writes-and-checks.md)** | Under enhancement a setter on a detached entity is silently accepted while the matching getter throws, and the helper… |
| 30 | **[08c3 · The entity's own methods](08c3-the-entitys-own-methods.md)** | Enhancement intercepts the field, not the getter, which quietly promotes every method your entity declares —… |
| 31 | **[08c4 · The enhanced instance](08c4-the-enhanced-instance.md)** | Enhancement stops using proxies for non-polymorphic associations, which fixes instanceof and getClass and… |
| 32 | **[08c5 · Serialising an enhanced instance](08c5-serialising-an-enhanced-instance.md)** | The enhancer's bookkeeping is transient, so a Java-serialisation round trip replaces the lazy-loading exception with… |
| 33 | **[09 · The checklist](09-the-checklist.md)** | Reviewing a service method for a lazy leak is four questions asked in a fixed order — what leaves, where the boundary… |
| 34 | **[09b · Symptoms that are not this exception](09b-symptom-to-chunk.md)** | Half the tickets that arrive labelled lazy loading are a different failure wearing the same clothes — a missing row,… |
| 35 | **[09b2 · Symptoms with no exception](09b2-symptoms-with-no-exception.md)** | The other half of the differential produces no Hibernate exception at all — an empty JSON object, a null association,… |
{/* FOOTER */}
