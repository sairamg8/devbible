---
title: "The one-time decisions that make the checklist mostly unnecessary — the configuration a project sets once, and the audit you run once on a codebase that has never thought about fetching"
sidebar_label: "19b · Standing configuration"
sidebar_position: 61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* Appendix A.7 *Fetch Related
> Settings*, A.16.5 `hibernate.query.fail_on_pagination_over_collection_fetch`, A.20.1
> `hibernate.generate_statistics` and §14.2 *Configuring second-level cache mappings*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §9.15 *Using the bytecode enhancer*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the Spring Boot 4.1 properties appendix for `spring.jpa.open-in-view`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, PostgreSQL 18.

**Most of the review checklist is only necessary because the project never made a handful of
decisions. Each of them is made once, costs nothing to keep, and removes a whole category of
things a reviewer would otherwise have to notice. This is that list, plus the audit worth
running on an existing codebase and how to order what it finds.**

## The decisions, and what each one buys

### Open-session-in-view, decided rather than defaulted

```yaml
spring:
  jpa:
    open-in-view: false
```

The Boot default is `true`, and the auto-configuration logs a warning only while the property is
unset. Setting it to `false` restores `LazyInitializationException` as a signal that a fetch plan
is missing — which is what makes items ⑧, ⑨ and ⑩ of
[19 · The review checklist](19-the-checklist.md) fail loudly instead of quietly.

⚠️ On an existing application this is a migration, not a config change; do it in the test profile
first. [15c · Turning it off](15c-turning-it-off.md) is the whole procedure. If the decision goes
the other way, set it to `true` **with a comment explaining why**, so the next person knows it
was chosen.

### Statistics on, in tests

```yaml
# src/test/resources/application.yaml
spring:
  jpa:
    properties:
      hibernate.generate_statistics: true
```

The appendix gives the default as `false`. Turning it on in the test profile is what makes the
counting in [6 · Count, do not read](06-count-do-not-read.md) and the assertions in
[6b · Asserting the count](06b-asserting-the-count-in-a-test.md) available everywhere, rather
than something each test has to arrange.

⚠️ It is not free at runtime — leave it off in production unless you have decided to pay for it
deliberately.

### The second-level cache off, in tests

Cache hits execute no statements, so a warm cache can make a count assertion pass over a genuine
N+1 ([17b · The second-level cache](17b-the-second-level-cache.md)). The default
`jakarta.persistence.sharedCache.mode` is `ENABLE_SELECTIVE`, so an application that has never
enabled caching is already safe; one that has should set the mode to `NONE` in the test profile,
which §14.2 describes as the option that "can make sense to disable second-level cache
altogether".

### A batch-fetch default, decided explicitly

```yaml
spring:
  jpa:
    properties:
      hibernate.default_batch_fetch_size: 100
```

Appendix A.7.1 is explicit that without this, "Hibernate only uses batch fetching for entities
and collections explicitly annotated `@BatchSize`". So the choice is between annotating every
association that might be walked unplanned and setting one floor for all of them.

**Neither answer is wrong and the decision should be made.** A global value bounds the cost of
every N+1 nobody has found yet, which on a large codebase is most of them; it is also invisible
at the mapping, so a reader of the entity sees no reason to think batching is happening. Whatever
you choose, record it — this is exactly the kind of setting that gets discovered years later and
removed by someone tidying up.

### The bytecode enhancer, if any mapping needs it

If the model uses `@Basic(fetch = LAZY)`, `@LazyGroup`, or a lazily-fetched bidirectional
`@OneToOne`, the build plugin is not optional — without it those mappings are silently ignored
([13c · Bytecode enhancement](13c-bytecode-enhancement.md)). ⚠️ On Gradle, the block form with
braces: the documentation warns that `hibernate { enhancement }` "will result in bytecode
enhancement NOT happening (unfortunately silently)".

If the model does **not** need it, that is a decision too, and writing it down stops someone
adding `@Basic(fetch = LAZY)` next year and believing it works.

### The pagination guard, knowing it may be inert

`hibernate.query.fail_on_pagination_over_collection_fetch` defaults, in the appendix's words, to
"false (disabled) — no exception is thrown, and the possibility of terrible performance is left
as a problem for the client to avoid", and it now fires only when "the database does not support
`LIMIT` inside a subquery". [8d · Pagination](08d-pagination.md) works through what 7.4 changed
and why, on PostgreSQL 18, this setting has very little left to catch. Know the setting exists;
do not expect it to be your guard.

## The audit, run once

On a codebase that has never thought about fetching, this is roughly the order of yield. None of
these greps is precise — they are for building a list, not for judging it.

| Look for | Why it matters |
|---|---|
| `@ManyToOne` / `@OneToOne` without `LAZY` | eager by JPA default; a secondary select per row in entity queries |
| `EAGER` written explicitly | a decision that closed the door for every caller |
| `@Data`, `@ToString`, `@EqualsAndHashCode` on an entity | generates methods that read associations |
| `join fetch` in a method taking a `Pageable` | the pagination conflict |
| entities in controller method signatures or return types | data access outside the transaction |
| service classes with a repository field and no `@Transactional` | relying on open-session-in-view for a session |
| `Hibernate.initialize` | fine with batching, an N+1 without |
| `.stream()` inside a `@Transactional` method | where the dereference usually is |

## Ordering what you find

Fix in this order, because the list will be long and the temptation is to start at the top of the
file tree.

**1 · Unbounded N first.** Batch jobs, exports, reports — anything whose parent count is not
capped by a page size. These are the ones that fail at 3am rather than getting slowly worse.

**2 · Then paged endpoints with the largest page sizes**, since their cost is `N` times whatever
the operator sets.

**3 · Then eager mappings**, which are structural and get more expensive to remove the longer
they stay.

**4 · Detail views last.** Bounded waste, worth fixing, not worth doing first.

And at each one, add the assertion before moving on. A fix without an assertion has a half-life
of about two sprints, which is roughly the interval at which someone adds a field to a response
DTO.

## What "done" looks like

Not zero lazy loads — that is neither achievable nor desirable. Done is:

- **Every unbounded query has an assertion** that its statement count does not grow with its row
  count.
- **No association is `EAGER`.**
- **`spring.jpa.open-in-view` has a value and a reason.**
- **Entities do not appear in controller signatures.**
- **A `@BatchSize` policy exists**, per-association or global, so the loads nobody planned are
  bounded rather than linear.

Everything else is a per-diff judgement, and with those five in place the judgements are small.

## Gotchas

**★ Turning open-session-in-view off in production first turns a slow application into a broken
one.** Test profile first, always. The failure list is the migration backlog and it is much better
discovered by a test run than by users.

**★ `hibernate.generate_statistics` left on in production is a cost nobody chose.** It defaults to
`false` for a reason. Put it in the test profile, not the shared one.

**★ A global batch fetch size is invisible at the mapping.** Someone reading `Order` sees no
annotation and reasonably concludes no batching is happening. Record the decision somewhere the
next person will look.

**★ Disabling the second-level cache in tests can change other behaviour.** If the application
depends on cached reference data for correctness — it should not, but some do — turning the cache
off in the test profile will surface that, and it is better surfaced there.

**★ The audit greps have false positives and that is fine.** `@ManyToOne` without `LAZY` on the
same line is a syntactic search over a semantic question; multi-line annotations will hide from
it. Use it to build a list, then read the list.

**★ Fixing in file order rather than risk order wastes the effort.** The detail views are easy and
visible and least important. The unbounded job nobody has opened in a year is the one that pages
you.

**★ "No N+1 anywhere" is the wrong target.** A lazy load that happens once per request, bounded,
inside a transaction, is fine. The property that matters is that the count does not scale with the
data, and chasing zero produces eagerly-fetched graphs, which is the failure mode this whole topic
argues against.

## Interview questions

**★ What would you configure on a new Spring Boot project to prevent this class of bug?**
`spring.jpa.open-in-view: false` from day one, so a missing fetch plan fails rather than costing;
`hibernate.generate_statistics: true` in the test profile, so the counting assertions are always
available; the second-level cache disabled in tests, so a cache hit cannot make an assertion pass
over a real N+1; and an explicit decision on `hibernate.default_batch_fetch_size`, because without
it batching happens only where somebody remembered `@BatchSize`. Four lines, made once, and they
remove most of what a reviewer would otherwise have to spot by eye.

**★ Why disable the second-level cache in tests rather than leaving it as production has it?**
Because the assertion measures statements Hibernate executed, and a cache hit executes none — so a
suite that shares a `SessionFactory`, or a test that runs after a fixture warmed the cache, can be
green over a genuine N+1. The test is supposed to be measuring the fetch plan, and the cache is a
different variable. If caching behaviour itself needs testing, that deserves its own tests with the
cache deliberately enabled, rather than being ambient in every other test.

**★ You have inherited a large codebase and the audit returns 200 hits. How do you prioritise?**
By blast radius rather than by effort. Anything whose parent count is unbounded — jobs, exports,
reports — comes first, because those are the ones that fail rather than degrade. Then paged
endpoints, ordered by the largest page size an operator can set. Then eager mappings, which are
structural and get harder to remove over time. Detail views last, since their waste is bounded by
one parent. And an assertion goes in with each fix, because a fix without one has a half-life of a
couple of sprints.

**★ What does "done" mean here — zero lazy loads?**
No, and aiming for that produces the opposite problem: eagerly-fetched graphs that every call site
pays for. Done is that the statement count for any unbounded query does not grow with its row
count and there is a test saying so; that no association is mapped `EAGER`; that
open-session-in-view has been decided rather than defaulted; that entities do not cross the
service boundary; and that a batching policy exists so the loads nobody planned are bounded. A
single lazy load per request, inside a transaction, is not a defect.

**★ Is a global `hibernate.default_batch_fetch_size` a good idea?**
It depends on how much of the codebase you can see. On a large or inherited application it is
usually worth it, because it puts a ceiling on every N+1 that has not been found yet, and most of
them have not been. The cost is that it is invisible at the mapping — an entity shows no
annotation, so nobody reasons about batching when reading it — and that it changes the behaviour of
every lazy association at once, which needs a measurement rather than a guess. On a small codebase
where every association's callers are known, per-association `@BatchSize` is more honest, because
the annotation is where the reader will look.

**★ Which of these settings would you fight for if you could only have one?**
Statistics on in the test profile, because it is the one that makes everything else checkable. It
costs nothing in production, it needs no migration, nobody has to agree with a philosophy to accept
it, and it converts "we think this endpoint is fine" into a number a test can assert. Turning
open-session-in-view off has more effect on the codebase in the long run, but it is a migration
that needs buy-in and time; the statistics flag is a one-line change that immediately makes the
argument for everything else, because you can show the count moving with the page size instead of
describing it.

**★ Is there a downside to setting `spring.jpa.open-in-view: false` on a brand-new project?**
Almost none, and that asymmetry is why it is worth doing on day one. On a new project nothing
depends on it yet, so the cost is that developers must decide what each endpoint returns and fetch
it deliberately — which is work they were going to do anyway, done at the point where it is
cheapest. The only real friction is early prototyping, where lazy loading everywhere genuinely is
faster to write. If that matters, the honest compromise is to leave the default during a spike and
set it before the code is anything anyone depends on, because the cost of flipping it rises with
every endpoint written under it.

---

← Prev: [19 · The review checklist](19-the-checklist.md) · Index: [08 · The N+1 problem](README.md)
