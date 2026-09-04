---
title: "Reviewing a diff for N+1 before it ships — the eleven things to look at, in the order they appear in a pull request, and the two questions that catch most of them"
sidebar_label: "19 · The review checklist"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §12 *Fetching*, §12.2, §12.8
> and §31.6.1
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §5.6 and §9
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `org.hibernate.Hibernate` javadoc
> ([docs.jboss.org/hibernate/orm/7.4/javadocs/](https://docs.jboss.org/hibernate/orm/7.4/javadocs/org/hibernate/Hibernate.html))
> and the Spring Boot 4.1 properties appendix
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**N+1 reaches production because it passes review — every query is fast, every query is
correct, and nothing in the diff looks like data access. This is what to look at instead, in
the order the files appear in a pull request. Two questions catch most of it: *does anything
dereference an association inside a loop or a stream*, and *does the number of statements
depend on the number of rows*. The rest of the list is the shapes where those two questions are
hard to ask.**

## The two questions

Ask these of every diff that touches an entity, a repository or a service.

**1 · Is an association dereferenced per element?** A `for`, a `stream().map`, a
`forEach`, a `Collectors.toMap`, a comparator, a `flatMap`. The dereference may be a getter, a
`.size()`, a `Hibernate.initialize`, or a nested call three methods deep that the reviewer has
to open a second file to see.

**2 · Does the statement count depend on the row count?** If the answer is yes or unknown, the
diff needs a test that says otherwise. This is the question the whole topic exists to make
answerable, and [6b · Asserting the count](06b-asserting-the-count-in-a-test.md) is how it gets
answered.

Everything below is a place where one of those two is easy to miss.

## In the entity

**① A to-one association without `fetch = LAZY`.** `@ManyToOne` and `@OneToOne` default to
`EAGER`, so an omitted attribute is an eager mapping — and in an entity query, eager means a
secondary select per row ([16 · EAGER is not a fix](16-eager-is-not-a-fix.md)). This is the
single highest-yield line to grep for in a new entity.

**② `equals`, `hashCode` or `toString` reading an association.** These run inside every
collection operation and every log statement, so one of them touching `getCustomer()` reinstates
the N+1 after every other fix worked
([4e · Lazy columns and hashCode](04e-lazy-columns-and-hashcode.md)). A Lombok
`@Data`/`@ToString` on an entity does exactly this by default and shows up in a diff as one
annotation.

**③ A new collection on an entity that already has one.** Two collections is the point at
which fetch joins stop composing — `MultipleBagFetchException`
([8e](08e-multiplebagfetchexception.md)) or a cartesian product. Every existing query that
fetch-joins the first collection now has a constraint it did not have yesterday.

**④ `@Basic(fetch = LAZY)` or `@LazyGroup` in a project whose build is not enhanced.** The
annotation is silently ignored and the column is fetched eagerly
([13c · Bytecode enhancement](13c-bytecode-enhancement.md)). This one is not visible in a
statement count at all.

## In the repository

**⑤ A new derived finder returning entities.** Ask what the caller does with them. If the answer
is "maps them to a response", the diff wants a projection, not a finder
([14b · Worked: the list page](14b-the-list-page.md)).

**⑥ A `join fetch` on a collection in a method that takes a `Pageable`.** The two disagree, and
which way they disagree depends on the Hibernate version
([8d · Pagination](08d-pagination.md)). This is worth stopping the review over, because it is
the most commonly written broken JPA query.

**⑦ A method name that does not imply its fetch plan.** `findByCustomerId` fetching a graph, or
`findDetailById` fetching nothing in particular, both mean the next caller will guess wrong.

## In the service

**⑧ A loop or stream over entities that reaches through them.** Question 1, applied. Include
the sneaky forms: `.stream().map(o -> o.getCustomer().getName())`, a `Comparator.comparing`
that navigates, a `groupingBy` classifier that navigates, and a log line inside the loop.

**⑨ A public method that calls a repository and has no `@Transactional`.** It works today
because open-session-in-view is providing an ambient session
([15c · Turning it off](15c-turning-it-off.md)), and it is one configuration change away from
throwing. Add `@Transactional(readOnly = true)`.

**⑩ An entity returned past the service boundary.** To a controller, a serialiser, an event, a
cache, a queue. Each of those is a place data access can happen with no transaction and no plan
([18 · Fetching belongs to the call site](18-fetching-belongs-to-the-call-site.md)).

**⑪ A `Hibernate.initialize` loop over parents.** Read the mapping before commenting — with a
`@BatchSize` on the association this is the shape the Hibernate user guide itself uses to
demonstrate batch fetching, and without one it is the textbook N+1
([17 · Initialize loops](17-initialize-loops.md)).

## Three things that look wrong and are not

Worth knowing so the review does not generate noise.

**`distinct` absent from a collection fetch join.** Since Hibernate 6 you should *not* write it
— Hibernate de-duplicates the returned list itself, and the keyword now only adds a `DISTINCT`
to the SQL ([8c · Duplicates and distinct](08c-duplicate-parents-and-distinct.md)). A review
comment asking for it is asking for a regression.

**A fetch join and a `@BatchSize` on the same association.** Not a conflict. The join wins where
it applies because the collection arrives initialised; the batch size serves the call sites that
did not join.

**Several small statements instead of one large one.** Two statements with no duplication often
beat one statement returning the cartesian product. Statement count finds the bug; it is the
wrong metric for choosing the fix ([14 · Choosing a fix](14-choosing-a-fix.md)).

## The comment worth writing

Not "this looks like an N+1". That gets answered with "it's only a few rows" and the thread
dies.

> *This dereferences `order.getCustomer()` inside the stream, so the statement count grows with
> the page size. Either fetch it in the query or return a projection — and either way, could
> this get the count assertion, since it's a paged endpoint?*

Three things make that work: it names the line, it states the property (**count grows with
rows**) rather than the label, and it asks for the test. The test is the part that survives the
next refactor, and it is the only part that converts a review opinion into something the build
enforces.

## Gotchas

**★ The diff that introduces the N+1 usually contains no query.** It adds a field to a DTO, a
column to a template, or a log line. The query it breaks was written months ago and is not in
the pull request.

**★ Reviewing only the repository misses almost everything.** The dereference is in the mapper,
the serialiser or the comparator. The repository method is innocent, which is why it passes.

**★ "It's only 20 rows" is about today.** A page size is a configuration value, a report grows
monthly, and a detail-view service ends up inside a loop when someone writes a bulk endpoint.

**★ A green test suite is not evidence of anything here.** Tests run against small fixtures where
101 fast statements are indistinguishable from 1. Only an assertion on the count says anything.

**★ A warm second-level cache can make a count assertion pass over a real N+1.** Cache hits
execute no statements ([17b · The second-level cache](17b-the-second-level-cache.md)). Disable
the second-level cache in the test profile.

**★ Lombok on an entity is a fetch decision.** `@Data` generates `equals`, `hashCode` and
`toString` over every field including associations. One annotation, in one line of a diff.

**★ Asserting a single count is weaker than asserting it does not grow.** The signature of this
bug is a count that scales with rows; measure at two sizes and require equality.

**★ You cannot review your way out of a missing standing configuration.** If
`spring.jpa.open-in-view` is unset and no test disables the second-level cache, every reviewer is
working without the signals. That is a one-time project decision, not a per-diff one.

## Interview questions

**★ What do you look for in a code review to catch N+1?**
Two questions, and then the shapes where they are hard to ask. Does anything dereference an
association per element — inside a loop, a stream, a comparator, a `groupingBy` classifier, or a
log line? And does the statement count depend on the row count? Beyond that: to-one associations
without `fetch = LAZY`, since JPA's default is eager; `equals`/`hashCode`/`toString` or a Lombok
`@Data` on an entity reading an association; a collection fetch join in a method taking a
`Pageable`; and a service method that calls a repository without `@Transactional`. The comment I
try to write names the line, states that the count grows with rows, and asks for the assertion —
because the assertion is the only part that outlives the review.

**★ Why is reviewing the repository not enough?**
Because the query is almost never where the bug is. An N+1 is created by a dereference, and
dereferences live in mappers, serialisers, comparators, templates and log statements — code that
reads as transformation rather than data access. The most common shape is a pull request that
contains no query at all: it adds a field to a response DTO, and the association behind that
field was not in the fetch plan of a query written six months ago. That is also why the fix has
to be a test rather than a habit.

**★ Someone says "it's only twenty rows, it doesn't matter". What do you say?**
That twenty is today's number and none of the things that make it twenty are stable — page size
is configuration, a report grows every month, and a service method that loads one entity is one
bulk endpoint away from being called in a loop. I would also point at the other half: twenty
statements is twenty round trips, each of which takes a connection and a network hop in
production even though it takes microseconds on a laptop. But the argument I would actually make
in the review is the cheap one: it costs one assertion to make the question permanent, so let us
add it and stop having the conversation.

**★ Are there things that look like an N+1 in review and are not?**
Yes, and getting these wrong makes reviewers less trusted. Omitting `distinct` from a collection
fetch join is correct on Hibernate 6 and later — Hibernate de-duplicates the list itself and the
keyword only adds a `DISTINCT` to the SQL. A fetch join alongside a `@BatchSize` on the same
association is not a conflict; the join wins where it applies and the batch size covers the other
call sites. And a fix that produces two small statements instead of one large one is often the
right trade, because the single statement may be returning a cartesian product. Statement count is
the diagnostic, not the objective.

**★ What is the one thing you would put in a project to prevent this class of bug?**
A statement-count assertion on every endpoint whose result set is unbounded, measured at two
different sizes so it asserts the count does not grow rather than asserting a number. Everything
else — lazy mappings, DTO boundaries, review checklists — depends on people; that one is enforced
by the build. The supporting configuration matters too and it is one-time rather than per-diff:
open-session-in-view decided explicitly, and the second-level cache disabled in the test profile
so cache hits cannot make the assertion pass over a real bug.

**★ How would you introduce this checklist to a team that has not thought about fetching?**
Not as a checklist first. I would find one real endpoint, show the statement count moving with
the page size, fix it, and add the assertion — because the list is abstract and the measurement
is not. Then the standing configuration decisions, which are one conversation and prevent whole
categories. The per-diff list is the last part and the least important, because most of what it
contains stops being a judgement call once the assertions exist: the build tells you, and the
reviewer's job goes back to whether the code is any good.

**★ Where in a pull request does the N+1 usually actually live?**
Not in the query. Almost always in a mapper, a serialiser, a comparator, a `groupingBy` classifier
or a log line — code that reads as transformation and happens to dereference an association per
element. The second most common location is nowhere in the diff at all: the change adds a field to
a response DTO or a column to a template, and the association behind it was never in the fetch plan
of a query written months earlier. That is why the two questions I ask are about *dereferences per
element* and about *whether the count scales*, rather than about anything a repository file
contains.

**★ Can static analysis catch this?**
Partially, and the parts it catches are the ones that are easiest to catch by eye anyway. A rule
can find `@ManyToOne` without an explicit `fetch`, Lombok `@Data` on an `@Entity`, a `join fetch`
on a collection in a method taking a `Pageable`, and an entity type in a controller signature —
all syntactic, all worth automating. What it cannot see is a dereference three call frames deep
inside a stream, which is where the bug actually is. So static rules are useful for the standing
hygiene and the runtime assertion is what catches the real thing; treating the first as a
substitute for the second is how a project ends up with a green analyser and a slow endpoint.

**★ A junior developer asks why their code passed review and still caused an incident. What is the
honest answer?**
That review is the wrong instrument for this bug and always was. Every statement it produces is
individually fast and individually correct, the code reads as ordinary object navigation, and the
only thing wrong with it is a relationship between two numbers — statements and rows — that is not
visible in a diff at all. Human attention is unreliable at spotting a property that only exists at
scale. The fix is not to review harder; it is to make the property measurable and assert it, so
the build knows something the reviewer cannot.

---

← Prev: [18 · Fetching belongs to the call site](18-fetching-belongs-to-the-call-site.md) · Index: [08 · The N+1 problem](README.md) · Next → [19b · Standing configuration](19b-the-standing-configuration.md)
