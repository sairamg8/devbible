---
title: "Every fix in this topic is correct somewhere and wrong somewhere else — choosing between them is a decision procedure keyed on evidence, and 'add a join fetch' is the wrong default"
sidebar_label: "14 · Choosing a fix"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §12 *Fetching* (§12.1 the
> basics, §12.7 profiles, §12.8 batch fetching) and §31.6 *Fetching*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §9 *Fetching and lazy loading*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Jakarta Persistence 3.2 specification
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**This is the chunk the topic exists for. You have a statement count and a call site; there
are now seven or eight things you could do, every one of which someone on the internet
calls "the fix". They are not interchangeable, they fail in different directions, and the
one most people reach for first — a fetch join — is the one with the most side conditions.
What follows is a procedure: the evidence to gather, the questions to ask of it in order,
and the fix each answer lands on.**

## Gather the evidence first — all three pieces

You cannot choose a fix from a slow page. You need three specific facts, and the earlier
chunks in this topic exist to get them.

**1 · The statement count, and how it moves with the data.**
[6 · Count, do not read](06-count-do-not-read.md) shows how to take it from Hibernate's own
statistics rather than by reading a log. What you actually need is not the number but its
**derivative**: run the same operation against 10 rows and against 100 rows. A count that
goes 11 → 101 is N+1. A count that goes 3 → 3 is not, however slow the page is, and you are
about to fix the wrong thing.

**2 · The call site.**
[7 · From a count to a call site](07-from-a-count-to-a-call-site.md) is about turning a
number into a line of Java. This matters more than it looks, because several fixes are only
available at a call site you can edit. A count is enough to know you have a problem; only
the call site tells you which fixes are on the table.

**3 · What the caller does with the result.**
Not the query — the consumer. Does it mutate the entities and flush? Does it serialise them
to JSON and forget them? Does it aggregate them into a number? This is the question people
skip, and it is the one that most often eliminates every other fix in favour of not loading
entities at all.

Without all three you are guessing, and the guess is almost always "add `join fetch`",
which is where the next section comes in.

## Why "use a fetch join" is the wrong default

`join fetch` is an excellent fix and Hibernate's documentation calls it the truly correct
solution to the problem it solves ([8 · join fetch](08-join-fetch.md)). It is still the
wrong thing to reach for *first*, for four reasons that this topic has already spent four
chunks on:

- **It changes the shape of the result.** Fetching a collection multiplies parent rows, and
  Hibernate 6 onward de-duplicates the returned list for you — which means the SQL is
  returning more rows than your list has, forever, invisibly
  ([8c · Duplicates and distinct](08c-duplicate-parents-and-distinct.md)).
- **It fights pagination.** A collection fetch join with `setFirstResult`/`setMaxResults` is
  the single most-written broken query in JPA ([8d · Pagination](08d-pagination.md)), and
  the fix differs by Hibernate version.
- **It caps out at one bag.** Two `List` collections in one fetch join is
  `MultipleBagFetchException` ([8e · MultipleBagFetchException](08e-multiplebagfetchexception.md)),
  and the popular workaround optimises the wrong thing.
- **It is baked into query text.** The plan and the query become one object. A second caller
  that wants the same rows without the collection needs a second method, and now the two
  drift.

None of that makes it bad. It makes it **specific**. A fix with four side conditions should
be chosen deliberately, not by reflex.

The deeper reason for the reflex is worth naming: `join fetch` is the fix that requires the
least thought about what the code is actually doing. It answers "how do I load this
association in fewer queries" without ever asking "does this code need this association, or
these entities, at all". That second question eliminates more N+1s than any annotation.

## The questions, in order

Ask them in this order. The order is not arbitrary — each one either eliminates the problem
or narrows the remaining choice, and asking them out of order is how people end up tuning a
query that should not have been loading entities.

### Q1 · Is the mapping eager?

Look at the association's `fetch` before anything else. If it is `EAGER`, or is a
`@ManyToOne`/`@OneToOne` that inherited the JPA default of `EAGER`, **that is the bug**, and
no query-level fix will hold. The user guide's §31.6.1 is blunt about why:

> *"`EAGER` fetching strategy cannot be overwritten on a per query basis, so the association
> is always going to be retrieved even if you don't need it."*

Map it `LAZY`, fix the call sites that then fail, and re-measure.
[16 · EAGER is not a fix](16-eager-is-not-a-fix.md) is the long version.

### Q2 · Does the caller need entities at all?

If the result is serialised, rendered, aggregated or exported — anything that is not "read,
mutate, flush" — the answer is very often no. A
[projection or DTO query](12-projections-and-dtos.md) selects exactly the columns
needed, in one statement, with no
persistence context, no proxies, no dirty checking and no possibility of an N+1 later
because there is nothing left to navigate.

**This question eliminates more N+1s than every other fix combined, and it is the one people
ask last.** It is also the only answer that is robust against the next developer: you cannot
lazily initialise a field on a record that has no association to initialise.

### Q3 · Is N bounded?

**One parent, or a page of parents?** The distinction decides almost everything downstream.

- **One parent** — a detail view, a single `find`. The worst case is a handful of extra
  statements, the cartesian product is bounded by that one parent's children, and pagination
  is not in play. Almost any fix works; pick the simplest, which is usually a fetch join or a
  graph.
- **A page of parents** — a list endpoint, a report, a batch job. N scales with the page and
  the cartesian product scales with the product of the collections. This is where fixes start
  eliminating each other.
- **An unbounded N** — a job over "all orders". Nothing that multiplies is safe here, and
  the honest fix is often to change the shape of the work, not the fetch plan.

### Q4 · Collection, or single-valued?

**Single-valued** (`@ManyToOne`, `@OneToOne`): a fetch join adds one join and no duplication.
It is safe with pagination, safe in combination with other to-one fetch joins, and there is
no bag problem. This is the easy case and a fetch join or an entity graph is nearly always
right.

**Collection** (`@OneToMany`, `@ManyToMany`, `@ElementCollection`): every side condition in
the previous section applies. Ask Q5.

### Q5 · How many collections, and does it paginate?

For a page of parents with collections, the choice is essentially between joining and
batching:

- **One collection, no pagination** → fetch join or entity graph. One statement, duplication
  handled, done.
- **One collection, with pagination** → this is version-dependent and
  [8d · Pagination](08d-pagination.md) is the chunk that settles it. On older versions the
  answer is the two-query id-then-fetch pattern
  ([8d2 · Paginating before 7.4](08d2-paginating-on-older-versions.md)); alternatively
  [`@BatchSize`](10-batch-size.md) sidesteps the conflict entirely because it does not
  join.
- **Several collections** → do not fetch-join more than one.
  [`@BatchSize`](10-batch-size.md) or [subselect fetching](11-subselect.md) give you a
  small, fixed
  number of statements with no cartesian product, which is a better trade than one enormous
  result set. [8e2 · The three ways out](08e2-the-three-ways-out.md) argues this in detail.

### Q6 · Can you edit the call site?

If the N+1 is in a Spring Data derived finder, a natural-id load, a cascade, or a
serialisation walk, "add `join fetch`" may not be available. Then:

- [`@EntityGraph` on the repository method](09g-spring-data-entitygraph.md) — usually the
  right answer,
  because it attaches the plan to the call without touching the query.
- [`@BatchSize` on the association](10-batch-size.md) — changes behaviour everywhere, but
  needs no call site at all, which is exactly why it is the best default for a mapping you
  cannot predict the callers of.
- **A fetch profile** ([13 · Fetch profiles](13-fetch-profiles.md)) — for the loads with
  nowhere to hang a plan, and the only route to selective subselect fetching.

### Q7 · Is it even a query problem?

Two cases in this topic are not, and no fetch plan touches them:

- **A lazy basic column being fetched eagerly** — the mapping is being ignored because the
  build is not enhanced ([13c · Bytecode enhancement](13c-bytecode-enhancement.md)).
- **A `hashCode` or `toString` that reads an association** — the fetch plan is fine and the
  entity is re-triggering the loads after you fixed them
  ([4e · Lazy columns and hashCode](04e-lazy-columns-and-hashcode.md)).

## The table

Read it as a summary of the questions above, not as a substitute for them.

| Evidence | Fix | Why this one |
|---|---|---|
| Association mapped `EAGER` | remap `LAZY` first | no query-level fix survives an eager mapping |
| Result is serialised / aggregated / exported | [projection or DTO query](12-projections-and-dtos.md) | the entity was never needed; removes the problem rather than tuning it |
| One parent, any association | `join fetch` or [entity graph](09-entity-graph.md) | N is 1; every side condition is bounded |
| Page of parents, one to-one association | `join fetch` or [entity graph](09-entity-graph.md) | one extra join, no duplication, pagination-safe |
| Page of parents, one collection, no paging | `left join fetch` | one statement; Hibernate de-duplicates |
| Page of parents, one collection, **paged** | see [8d · Pagination](08d-pagination.md), or [`@BatchSize`](10-batch-size.md) | the join and the row limit disagree |
| Page of parents, **several** collections | [`@BatchSize`](10-batch-size.md) or [subselect](11-subselect.md) | avoids the cartesian product and `MultipleBagFetchException` |
| Call site not editable | [`@EntityGraph`](09-entity-graph.md), [`@BatchSize`](10-batch-size.md), or a [fetch profile](13-fetch-profiles.md) | the plan attaches to the call or the mapping, not the query text |
| Unbounded N in a batch job | change the shape of the work | no fetch plan makes an unbounded cartesian product safe |
| Lazy column fetched anyway | bytecode enhancement + `@LazyGroup` | the mapping is being ignored, not mis-planned |
| Count returns after you fixed it | check `hashCode`/`toString`/serialisation | the query is fine; the entity is re-triggering |

## Gotchas

**★ Choosing a fix from a slow page rather than from a count.** Slowness has many causes and
N+1 is only one of them. If the statement count does not grow with the row count, you do not
have this bug, and the fix you are about to apply will make the code more complicated and no
faster.

**★ Fixing the first N+1 the profiler shows and stopping.** The shapes chunk
([4 · The shapes it hides in](04-the-shapes-it-hides-in.md)) exists because they nest.
Re-measure after every fix; a fetch join that collapses the outer loop routinely reveals an
inner one that was hidden behind it.

**★ Applying a mapping-wide fix to a call-site-specific problem.** `@BatchSize` on the
association changes behaviour for every caller — which is the right call when the mapping's
callers are unpredictable and the wrong call when one report is the only offender and forty
other endpoints now pay for it.

**★ Applying a call-site fix to a mapping-wide problem.** The mirror image, and more common.
Adding `@EntityGraph` to the one repository method that showed up in the profile leaves the
other six call sites of the same association exactly as broken, and the next profile finds
them one at a time over six months.

**★ Treating "fewer statements" as the objective function.** It is not; latency and data
volume are. A fetch join across three collections is one statement and can move vastly more
bytes than the twelve statements it replaced. Count statements to *find* the bug, then think
about rows to *choose* the fix.

**★ Not asking what the caller does with the entities.** Q2 is the highest-yield question in
the list and the one most consistently skipped, because it questions the design rather than
the query, and because the answer often means writing a DTO.

**★ Assuming the fix that worked last time transfers.** The same association, fetched from a
detail view and from a paged list, wants different fixes. The fix is a property of the call
site and the page size, not of the association.

## Interview questions

**★ Walk me through how you would decide between a fetch join, an entity graph and a batch
size.**
By call site and cardinality, in that order. If the caller is a query I own and the plan is
inherent to that query, a fetch join says so most directly. If the caller is a repository
method whose query text I do not write, or if the same rows are wanted with different plans
by different callers, an entity graph attaches the plan to the call rather than baking it into
the query. If the offending loads are spread across call sites I cannot enumerate, or if the
query pages, or if there are several collections, a batch size is the one that does not need a
call site and does not multiply rows. The tie-breaker is whether the fix should apply to one
caller or to all of them — that is a design decision, not a performance one.

**★ Why is `join fetch` not the default answer?**
Because it has four side conditions — it changes the result shape and relies on Hibernate's
de-duplication, it conflicts with pagination, it accepts at most one bag, and it fuses the
plan into the query text so the query stops being reusable. It is the right fix often enough
that it deserves to be the first one considered and not often enough to be the one applied
without thinking. More importantly, reaching for it first skips the question that eliminates
the most N+1s: whether the code needed entities at all.

**★ What is the single most valuable question to ask about an N+1?**
"What does the caller do with these objects?" If the answer is anything other than mutating
and flushing them, a projection removes the problem instead of tuning it — one statement,
exactly the columns needed, and no association left for anyone to navigate later. Every other
fix leaves a lazy association in place and depends on the next developer not touching it.

**★ You fixed an N+1 with a fetch join and the count went from 101 to 1, but the endpoint got
slower. What happened?**
Almost certainly the cartesian product. One statement returning the product of the parents and
their children can move far more data than a hundred small statements, especially if the parent
rows are wide or a second collection is involved, and the cost lands on both the network and
Hibernate's result-set processing. Statement count found the bug; it is the wrong metric for
choosing between fixes. I would look at rows returned and bytes moved, and switch to a batch
size or a subselect, which give a small fixed number of statements with no duplication.

**★ When is the right fix not a fetch plan at all?**
Three cases. When the column is a lazy basic attribute and the build is not
enhanced — the mapping is being ignored, so no query changes anything. When an entity's
`hashCode`, `toString` or serialiser walks an association, in which case the fetch plan is
already correct and something downstream is re-triggering it. And when N is genuinely
unbounded — a job over every order — where the answer is to restructure the work into batches
or a set-based statement, because no fetch plan makes an unbounded product safe.

**★ How do you know when you are done?**
When the statement count no longer grows with the row count, and there is a test that asserts
it ([6b · Asserting the count](06b-asserting-the-count-in-a-test.md)). "It looks faster now" is
not done, because the fix that works at ten rows on a laptop is exactly the one that fails at a
thousand rows in production — that is the whole argument of
[3 · Why production is worse](03-why-production-is-worse.md). The assertion is what makes the
fix survive the next refactor.

**★ How do you decide whether the fix belongs in the mapping or at the call site?**
By asking whether the answer is the same for every caller. Cardinality, the owning side and the
lifecycle rules are properties of the model and belong in the mapping. What to fetch is a property
of a unit of work and belongs at the call site — which is why `EAGER` is wrong and why a fetch
join, a graph or a projection is right. The one mapping-level exception is a batch size, because
it does not force any load; it only changes how loads that happen anyway are grouped, so it lowers
the cost of the call sites nobody planned without constraining the ones that do declare a plan.

---

← Prev: [13d · Lazy groups and the cost](13d-lazy-groups.md) · Index: [08 · The N+1 problem](README.md) · Next → [14b · Worked: the list page](14b-the-list-page.md)
