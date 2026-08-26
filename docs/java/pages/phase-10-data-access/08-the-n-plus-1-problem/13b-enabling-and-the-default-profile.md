---
title: "Enabling a profile is a session-wide switch with three spellings, an entity graph beats it when both apply, and there is a built-in profile that adds outer joins to every query you write"
sidebar_label: "13b · Enabling a profile"
sidebar_position: 46
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §9.16 *Named fetch
> profiles*, Table 9.16 and §7.x *finder methods*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 *User Guide* §12.1 *The basics* and §12.7
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> and the `org.hibernate.Session` javadoc for `enableFetchProfile`,
> `disableFetchProfile` and `isFetchProfileEnabled`
> ([docs.jboss.org/hibernate/orm/7.4/javadocs/](https://docs.jboss.org/hibernate/orm/7.4/javadocs/org/hibernate/Session.html)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1,
> Jakarta Persistence 3.2.

**A declared profile does nothing until something enables it, and the scope of "enable" is
the whole session — not the query, not the call. That is the feature's defining property
and its defining hazard. Hibernate offers three spellings of the switch, one of which
narrows it back down to a single `find`; it also ships a built-in profile that rewrites
every query in the session, and a documented rule that when a profile and an entity graph
both apply, the profile loses.**

## One association, several profiles

An association may carry more than one override, which is where profiles stop looking like
an awkward entity graph and start looking like a distinct tool:

```java
@FetchProfile(name = "EagerBook")
@FetchProfile(name = "BookWithAuthorsBySubselect")
@Entity
class Book {

    @OneToOne
    @FetchProfileOverride(profile = Book_.PROFILE_EAGER_BOOK, mode = JOIN)
    Person person;

    @ManyToMany
    @FetchProfileOverride(profile = Book_.PROFILE_EAGER_BOOK, mode = JOIN)
    @FetchProfileOverride(profile = Book_.BOOK_WITH_AUTHORS_BY_SUBSELECT,
                          mode = SUBSELECT)
    Set<Author> authors;
}
```

`authors` now has three behaviours: its mapped default with no profile enabled, a join
under `EagerBook`, and **a subselect** under `BookWithAuthorsBySubselect`. The
introduction is unambiguous that the third is the whole case for the feature:

> *"The one and only advantage unique to fetch profiles is that they let us very
> selectively request subselect fetching. We can't do that with entity graphs, and we
> can't do it with HQL."*

Subselect fetching is otherwise a mapping-level, all-or-nothing decision — see
[11 · `@Fetch(SUBSELECT)`](11-subselect.md). If you have one report that wants it and forty
endpoints that do not, a profile is the mechanism, and there is no second one.

The available modes are the ones the user guide lists in §12.1: `SELECT`, `JOIN`, `BATCH`
and `SUBSELECT`. Note what the guide calls the first of those — "a separate SQL select to
load the data… **This is the strategy generally termed N+1**." A profile can therefore set
an association *back* to per-row loading, which is occasionally deliberate and never what
anyone meant to write.

## Three ways to switch it on

### On the session, by name

```java
session.enableFetchProfile(Book_.PROFILE_EAGER_BOOK);
Book eagerBook = session.find(Book.class, bookId);
```

The javadoc is precise about the semantics and about the failure mode: the call enables the
profile "in this session", is a no-op "if the requested fetch profile is already enabled",
and throws `UnknownProfileException` when the name "does not match any known fetch profile
names". `disableFetchProfile(String)` and `isFetchProfileEnabled(String)` mirror it exactly,
including the exception.

**Everything after that line, until the session ends or you disable it, runs under the
profile.** Not the next query — every query, every `find`, every lazy association that
initialises. That is the scope, and it is the reason this spelling is the one to be careful
with.

### From the generated metamodel

```java
Book_._EagerBook.enable(session);
Book eagerBook = session.find(Book.class, bookId);
```

Same scope, no string. Hibernate Processor generates an `EnabledFetchProfile` instance
alongside the name constant.

### As a `FindOption` — the one that is actually safe

```java
Book eagerBook = entityManager.find(Book.class, bookId, Book_._EagerBook);
```

The introduction calls this form "even better", and it deserves the emphasis for a reason
the surrounding text does not spell out: **this is the only spelling whose scope is one
operation.** Jakarta Persistence 3.2 gave `find` an options-accepting overload
(`find(Class, Object, FindOption...)`), and `EnabledFetchProfile` is a `FindOption`, so the
profile applies to this `find` and to nothing else in the session. If you are reaching for
a profile in application code, reach for this one; the session-wide spellings exist for
cases where you genuinely cannot get at the operation.

### And, if you use Hibernate's generated repositories

```java
@Find(namedFetchProfiles = Book_.FETCH_WITH_AUTHORS)
Book getBookWithAuthors(String isbn);
```

The introduction's summary of what this buys is the clearest statement of the whole
feature's appeal: *"This lets us declare which associations of `Book` should be pre-fetched
by annotating the `Book` class."* One finder, one profile, no query text, no session
juggling. ⚠️ This is Hibernate's own `@Find` processor, not a Spring Data derived query
method — Spring Data JPA has no `namedFetchProfiles` attribute, and the equivalent there is
an [`@EntityGraph` on the method](09g-spring-data-entitygraph.md).

## When a profile and an entity graph both apply, the graph wins

The user guide states the rule directly, in its list of dynamic fetching scopes:

> *"`fetch profile` and `entity graph` are mutually exclusive. When both are present,
> `entity graph` would take effect and `fetch profile` would be ignored."*

Read that carefully, because the practical consequence is not obvious. It is not "the more
specific one wins" and it is not "the two combine". A repository method carrying an entity
graph **discards** whatever profile the session had enabled — including a profile someone
enabled two layers up, for a reason, to fix a different N+1. So a fix applied at the graph
level can silently undo a fix applied at the profile level, and the symptom is an N+1 that
reappears only when two particular code paths run in the same request.

The rule also means the two mechanisms cannot be layered deliberately. You cannot enable a
profile for the associations a graph does not mention and expect both plans to apply. Pick
one per operation.

## The built-in profile that rewrites your queries

There is a profile you did not declare:

```java
session.enableFetchProfile("org.hibernate.defaultProfile");
```

The introduction defines it as "the profile with `@FetchProfileOverride(mode=JOIN)` applied
to every eager `@ManyToOne` or `@OneToOne` association", and describes the effect plainly:

> *"Then outer joins for such associations will automatically be added to every HQL or
> criteria query. This is nice if you can't be bothered typing out those `join fetch`es
> explicitly. And in principle it even helps partially mitigate the problem of JPA having
> specified the wrong default for the `fetch` member of `@ManyToOne`."*

This is a genuinely interesting thing to know about, and it needs reading with care.

**What it fixes.** The classic entity-query N+1 on to-one associations. An eager
`@ManyToOne` that a JPQL query forgot to `join fetch` is loaded by a secondary select per
row — the shape [4 · The shapes it hides in](04-the-shapes-it-hides-in.md) describes and
[8b · What it breaks](08b-what-a-fetch-join-breaks.md) picks apart. Enabling this profile
turns those secondary selects into outer joins on the original statement, everywhere,
without editing a query.

**What it does not fix.** It says `@ManyToOne` and `@OneToOne`, and it says **eager**. It
does nothing for collections, and it does nothing for a to-one you correctly mapped
`fetch = LAZY`. So it is not a general N+1 switch — it is a retrofit for the mapping mistake
of leaving to-one associations eager, which is a mistake [16 · EAGER is not a
fix](16-eager-is-not-a-fix.md) argues you should fix at the mapping instead.

**Why "in principle" is doing work in that sentence.** Adding an outer join for every eager
to-one association to **every** query in the session is not free. A query that touched one
table now touches four, including on the queries that never dereferenced those associations
at all. You have traded a variable number of small statements for a fixed, larger one — a
good trade on the pages that were N+1-ing and a bad one everywhere else. The documentation's
own framing of it, "if you can't be bothered", is an accurate description of when to use it.

## Why they never caught on

The introduction answers this about itself, and the honesty is worth quoting in full:

> *"So why or when might we prefer named fetch profiles to entity graphs? Well, it's really
> hard to say. It's nice that this feature exists, and if you love it, that's great. But
> Hibernate offers alternatives that we think are more compelling most of the time."*

The structural reasons behind that verdict are the ones this chunk has been laying out.
**A profile's scope is wrong for the problem.** N+1 is a property of a call site; a profile
is a property of a session. Every other fix in this topic — a fetch join, a graph, a batch
size, a projection — attaches to something narrower than "everything that happens next".
**Its precedence is surprising.** Losing silently to an entity graph makes it unsafe to
combine with the mechanism most codebases already use. **And its one unique capability is
narrow.** Selective subselect fetching is real and occasionally exactly right, but most
teams never identify the case, so they never find the reason to adopt the feature.

Know it for three situations: the load with nowhere to hang a plan (natural-id lookup, a
`getReference` initialised later), the case that genuinely wants subselect fetching for one
use case only, and the interview question about what else exists besides `join fetch` and
entity graphs.

## Gotchas

**★ The session-wide spellings outlive the method that called them.** `enableFetchProfile`
is a property of the `Session`, and the `Session` is the persistence context — so in a
Spring service it lasts for the transaction, and under open-session-in-view
([15 · Open session in view](15-open-in-view.md)) it lasts until the response is written.
A profile enabled inside one service method changes fetching for every other service method
that joins the same transaction. Disable it in a `finally` block or use the `FindOption`
form.

**★ An entity graph anywhere in the call chain silently discards your profile.** The
mutual-exclusivity rule is not "most specific wins" — the graph wins, unconditionally, and
the profile "would be ignored". Two fixes that each work in isolation can therefore cancel
one another when the code paths meet.

**★ `UnknownProfileException` is thrown by all three session methods, not just enable.**
`disableFetchProfile` and `isFetchProfileEnabled` throw it too. A defensive
`if (session.isFetchProfileEnabled(name))` guard around a disable does not make the code
safe against a bad name — it just moves which line throws.

**★ Enabling a profile twice is a documented no-op, and that is a trap for the disable.**
"If the requested fetch profile is already enabled, the call has no effect." So nested
enables do not nest — the first `disableFetchProfile` in the innermost `finally` turns it
off for the outer caller too. Profiles have no reference count.

**★ `org.hibernate.defaultProfile` costs you joins on queries that did not want them.**
It applies to every HQL and criteria query in the session, not to the ones with an N+1. On a
model with several eager to-one associations, a lookup that needed one row now joins several
tables every time.

**★ `mode = SELECT` in a profile is the N+1 strategy, written down.** The user guide names
`SELECT` as "the strategy generally termed N+1". It is a legal override and it will do
exactly what it says.

**★ `@Find(namedFetchProfiles = …)` is Hibernate's, not Spring Data's.** Copying that
annotation onto a `JpaRepository` method does not compile, and the closest Spring Data
equivalent is a different mechanism with different precedence.

## Interview questions

**★ What is the scope of `session.enableFetchProfile(name)`?**
The session — every operation from that call until the profile is disabled or the session
closes, not just the next query. In a Spring application that means at minimum the current
transaction, and with open-session-in-view left at its default it means the rest of the HTTP
request. This is the single most important fact about the feature, because it is what makes
a profile unsuitable as a general-purpose per-query fix and what makes the `FindOption` form
the one to prefer.

**★ Both a fetch profile and an entity graph apply to a load. What happens?**
The entity graph takes effect and the fetch profile is ignored — the user guide states this
as a flat rule in §12.1, describing the two as mutually exclusive. The practical hazard is
that this happens silently and asymmetrically: adding an `@EntityGraph` to a repository
method to fix one N+1 can reintroduce another that a session-level profile was suppressing,
and nothing in either annotation hints that they interact.

**★ What is `org.hibernate.defaultProfile` and when would you enable it?**
A built-in profile equivalent to `@FetchProfileOverride(mode=JOIN)` on every eager
`@ManyToOne` and `@OneToOne` association, so enabling it adds outer joins for those
associations to every HQL and criteria query in the session. It exists as a mitigation for
JPA having chosen `EAGER` as the default for `@ManyToOne` — it converts the resulting
secondary-select-per-row into a join. I would reach for it only on a legacy model I could not
re-map, and knowing it makes every query in the session wider, including the ones that never
touch those associations. On a model I control, mapping the associations `LAZY` and fetching
at the call site is strictly better.

**★ Three spellings enable a profile. Which one would you put in a code review as the
default, and why?**
`entityManager.find(Book.class, bookId, Book_._EagerBook)`. It is the only one whose scope is
a single operation, so it cannot leak into unrelated work sharing the same persistence
context, it needs no `finally` block to unwind, and it reads at the call site as "this load
wants this plan" — which is the shape every good fetch decision has. The session-wide forms
are for the cases where the operation is not yours to modify.

**★ If profiles are this awkward, why does the feature still exist?**
Because of one capability nothing else has: selectively requesting subselect fetching. HQL
cannot express it and an entity graph cannot express it, so without profiles `@Fetch(SUBSELECT)`
in the mapping is the only way to get it — and that turns it on for every query in the
application. A profile is the only mechanism that scopes subselect fetching to a use case.
The documentation is candid that this is the sole unique advantage.

**★ How do fetch profiles interact with an N+1 you found in a Spring Data derived query
method?**
They are one of the few things that can fix it without changing the method, because the
override lives on the association and the switch lives on the session — you never touch the
generated query. In practice I would still prefer `@EntityGraph` on the method: it is scoped
to the call rather than the session, it is visible in the same file as the finder, and by the
mutual-exclusivity rule it wins anyway if both are present. The profile is the answer when
the load has no annotatable call site at all, which is the natural-id lookup case the user
guide uses to motivate the feature.

---

← Prev: [13 · Fetch profiles](13-fetch-profiles.md) · Index: [08 · The N+1 problem](README.md) · Next → [13c · Bytecode enhancement](13c-bytecode-enhancement.md)
