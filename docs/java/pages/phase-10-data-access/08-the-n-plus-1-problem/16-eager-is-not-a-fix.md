---
title: "EAGER is the one fetch decision that cannot be overridden downward — it makes the fetch unconditional at every call site, and in an entity query it produces the N+1 it was supposed to prevent"
sidebar_label: "16 · EAGER is not a fix"
sidebar_position: 56
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §12.2 *Direct fetching vs.
> entity queries*, §12.6 *Dynamic fetching via Jakarta Persistence entity graph*, §31.6.1
> *Fetching associations* and Appendix A.7.2 `hibernate.max_fetch_depth`
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy fetching* and §9.16
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Jakarta Persistence 3.2 specification's `FetchType` defaults
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Every other fix in this topic is additive: the mapping stays lazy and a call site asks for
more. `EAGER` is the only one that goes the other way, and it is a one-way door. Once an
association is eager, no query, no entity graph, no fetch profile and no repository method can
decide it does not want it — the user guide states flatly that the "`EAGER` fetching strategy
cannot be overwritten on a per query basis". And the reason it belongs in the *not a fix*
section rather than merely the *bad idea* section is sharper than that: in an entity query,
eager fetching is implemented by issuing one extra select per row. `EAGER` does not prevent
N+1. It is one of the ways you get it.**

## The asymmetry nobody is told about

An eager association behaves **differently depending on how the parent was loaded**, and the
user guide devotes §12.2 to exactly this.

**Loaded directly** — `entityManager.find(Employee.class, 1L)` — Hibernate adds a `LEFT OUTER
JOIN` for the eager association to the same statement. One query. This is what everyone
pictures when they think "eager", and it is why eager mappings so often look fine in the unit
test that loads one entity by id.

**Loaded by an entity query** — `select e from Employee e where e.id = :id` — Hibernate emits
the query you wrote, and then a *separate* select for the association. The guide's explanation:

> *"Hibernate uses a secondary select instead. This is because the entity query fetch policy
> cannot be overridden, so Hibernate requires a secondary select to ensure that the `EAGER`
> association is fetched prior to returning the result to the user. If you forget to `JOIN
> FETCH` all `EAGER` associations, Hibernate is going to issue a secondary select for each and
> every one of those which, in turn, can lead to N + 1 query issue. For this reason, you should
> prefer `LAZY` associations."*

And again, independently, in §12.6:

> *"When executing a JPQL query, if an `EAGER` association is omitted, Hibernate will issue a
> secondary select for every association needed to be fetched eagerly, which can lead to N+1
> query issues. For this reason, it's better to use `LAZY` associations, and only fetch them
> eagerly on a per-query basis."*

**Put the two behaviours side by side and the trap is obvious.** The same mapping gives you a
join on a `find` and an N+1 on a `select … from`. So the developer who mapped it eager tested
it with `findById`, saw one statement, and shipped. The N+1 appears the first time somebody
writes a list query — which is a different method, in a different sprint, and looks like a
problem with that query.

It is worth being precise about *why* Hibernate does this rather than just adding the join. A
JPQL query is a specification of the result the user asked for; silently adding joins to it
would change its semantics — the row count, the `distinct` behaviour, the pagination. So
Hibernate honours the query as written and then satisfies the eager contract separately. The
per-row select is not a Hibernate defect. It is the only correct implementation of two
requirements that conflict.

## The one-way door

§31.6.1 states the property that makes this a design decision rather than a tuning knob:

> *"`EAGER` fetching strategy cannot be overwritten on a per query basis, so the association is
> always going to be retrieved even if you don't need it. Moreover, if you forget to `JOIN
> FETCH` an `EAGER` association in a JPQL query, Hibernate will initialize it with a secondary
> statement, which in turn can lead to N+1 query issues. So, `EAGER` fetching is to be avoided.
> For this reason, it's better if all associations are marked as `LAZY` by default."*

Lay out what each mapping permits:

| Mapping | A call site can ask for more | A call site can ask for less |
|---|---|---|
| `LAZY` | ✅ `join fetch`, entity graph, fetch profile, `@BatchSize` | — (already minimal) |
| `EAGER` | ✅ (already fetched) | ❌ **nothing** |

`LAZY` is a floor that any query can raise. `EAGER` is a floor **and** a ceiling. Every fix in
this topic operates in the space `LAZY` leaves open, and `EAGER` closes that space for every
caller, forever, including the ones that have not been written.

That is the whole argument, and it is a design argument rather than a performance one. A
mapping that fixes the fetch strategy is a mapping that has made a decision on behalf of code it
cannot see.

## Where eager comes from, when nobody chose it

Most eager associations in real codebases were never decided. Jakarta Persistence specifies the
defaults, and they are not uniform:

- `@ManyToOne` — **`EAGER`** by default
- `@OneToOne` — **`EAGER`** by default
- `@OneToMany` — `LAZY` by default
- `@ManyToMany` — `LAZY` by default

So `@ManyToOne private Customer customer;` with no `fetch` attribute is an eager mapping, and it
is the single most common one in any JPA codebase. The introduction is openly critical of this,
describing it as "the problem of JPA having specified the wrong default for the `fetch` member
of `@ManyToOne`" — a phrase it uses while explaining the built-in `org.hibernate.defaultProfile`
that exists partly to mitigate it
([13b · Enabling a profile](13b-enabling-and-the-default-profile.md)).

The topic-07 chunk on this is
[../07-relationships-fetch/12-fetch-type-defaults.md](../07-relationships-fetch/12-fetch-type-defaults.md),
and the practical instruction is one line: **write `fetch = LAZY` on every `@ManyToOne` and
`@OneToOne`, always, even where you think you want the join.** Wanting the join is a statement
about a query, and it belongs in the query.

## Eager on a collection is a different order of bad

Everything above concerns to-one associations. On a collection, eager fetching adds the
multiplication problem on top:

- Every load of the parent fetches the whole collection, regardless of size, with no way for a
  caller to decline.
- Two eager collections produce a cartesian product on any load that joins them — and if both
  are `List`, `MultipleBagFetchException`
  ([8e · MultipleBagFetchException](08e-multiplebagfetchexception.md)).
- Pagination becomes the problem [8d · Pagination](08d-pagination.md) describes, except you did
  not opt into it and cannot opt out.

[../07-relationships-fetch/13-eager-on-a-collection.md](../07-relationships-fetch/13-eager-on-a-collection.md)
and [../07-relationships-fetch/13b-how-it-multiplies.md](../07-relationships-fetch/13b-how-it-multiplies.md)
work this through. There is no case in which `@OneToMany(fetch = EAGER)` is the right answer to
an N+1; it is a way of guaranteeing you will meet several others.

## The argument for eager, taken seriously

**"The association is always needed, so eager expresses the truth."** This is the best version
of the case and it is worth answering rather than dismissing. Two problems. First, "always
needed" is a claim about today's callers; the count query, the existence check and the bulk
export added later do not need it and cannot say so. Second, even where it is true, `EAGER` is
the *wrong mechanism* for expressing it, because in entity queries it is implemented as a
per-row select rather than a join — so you do not even get the behaviour you were asking for.
A `@ManyToOne(fetch = LAZY)` plus a fetch join in the two queries that need it expresses the same
intent, gets you the join, and leaves the third query free.

**"It avoids `LazyInitializationException`."** It does, and so does open-session-in-view, and
both are the same mistake in different clothes: converting a signal into a cost
([15 · Open session in view](15-open-in-view.md)). The exception was telling you a fetch plan was
missing.

**"It is only one extra join."** On a `find`, yes. On a query, it is one extra select per row —
which is the thing this entire topic is about.

## Gotchas

**★ The same eager mapping is a join in `find` and an N+1 in a query.** This is §12.2's whole
point and it is the reason eager mappings survive review: the test that loads one entity by id
sees exactly one statement.

**★ `@ManyToOne` with no `fetch` attribute is eager.** Nobody typed `EAGER`, and the mapping is
eager. Most eager associations in production got there this way.

**★ Adding `join fetch` to one query does not neutralise the eager mapping.** It fixes that
query. Every other query that returns the entity still issues the secondary select, and there is
no way to audit "which queries fetch-join all my eager associations" other than reading them all.

**★ Eager associations chain.** An eager `@ManyToOne` whose target has its own eager
`@ManyToOne` pulls both. `hibernate.max_fetch_depth` bounds how deep Hibernate will nest outer
joins — the appendix gives its default as "0 (none)" — but the *fetching* still happens, by
whatever means. A three-hop eager chain is a load you did not ask for on every query in the
application.

**★ Making an association eager to fix an N+1 usually moves it one level up.** The parent is now
always loaded with its child; the query that returns a page of parents now issues a select per
parent for that child. The count often gets worse, not better.

**★ It defeats `getReference`.** The whole point of obtaining a reference is to avoid a load
when you only need a foreign key. An eager association on the referenced type undermines that as
soon as the proxy initialises, and the code that set an association by reference is now doing
real work.

**★ It cannot be undone incrementally.** Changing `EAGER` to `LAZY` on a widely-used mapping
breaks every call site that was silently relying on it — which is precisely the audit the eager
mapping was avoiding. The longer it stays, the more expensive it is to remove, which is what
makes it a one-way door in practice as well as in principle.

## Interview questions

**★ Why is `EAGER` described as impossible to override, when `LAZY` is easy to override?**
Because the override mechanisms all work in one direction. `join fetch`, an entity graph, a
fetch profile and a batch size all say "fetch this now" — they raise a lazy association to
eager for one query. There is no corresponding mechanism that says "do not fetch this", because
JPA's contract is that an eager association is populated before the result is handed to the
caller, and a query cannot renegotiate that contract. The user guide states it directly: the
eager strategy "cannot be overwritten on a per query basis". So `LAZY` is a floor callers can
raise and `EAGER` is a fixed value.

**★ Explain why an eager association can cause an N+1.**
Because in an entity query Hibernate cannot satisfy the eager contract by modifying your query
— adding joins would change the result's row count and semantics — so it runs the query as
written and then issues a separate select for the association, per returned row. The guide says
if you "forget to `JOIN FETCH` all `EAGER` associations, Hibernate is going to issue a secondary
select for each and every one of those which, in turn, can lead to N + 1 query issue." The
irony is exact: the mapping that was supposed to guarantee the data is there is the mechanism
producing the per-row query.

**★ Why does the eager mapping look fine when you test it?**
Because a test almost always loads one entity by id, and direct fetching *does* use a join — the
guide contrasts precisely these two cases in §12.2. One statement, correct result, mapping looks
proven. The behaviour changes when the entity arrives via a JPQL or criteria query, which is
what every list endpoint uses, and by then the mapping is used by twenty call sites and is hard
to change.

**★ What is the correct way to express "this association is basically always needed"?**
Map it `LAZY` and fetch it in the queries that need it — an entity graph on the repository
method is the most reusable spelling, a `join fetch` the most explicit. If the number of such
queries is large, `@BatchSize` on the association gives you a cheap default for the call sites
you did not think about, without closing the door on the ones that do not want it. What you
gain over `EAGER` is that a future count query, existence check or export can opt out, and that
you get an actual join rather than a per-row select.

**★ You inherit a codebase with `EAGER` everywhere. How do you unwind it?**
Not by a global find-and-replace, because every call site that was silently depending on the
eager load will start throwing — and with open-session-in-view on, some will not even throw,
they will just get slower in different places. I would go association by association: change one
to `LAZY`, run the test suite with OSIV disabled, and fix each failure with a fetch plan or a
DTO at the call site that needs it. Start with collections, since eager collections cause the
multiplication problems as well, and with associations on the entities that appear in list
queries, since those are where the secondary selects are being issued per row.

**★ Is there any situation where you would map an association `EAGER`?**
I would not choose it, and I would not fight about it for a to-one on a small, immutable
reference entity that every query needs — a currency, a country, a status row — where it is
also likely to be cached. Even there the honest recommendation is `LAZY` plus a batch size,
because the cost of being wrong is asymmetric: `LAZY` that should have been eager is one fetch
plan away from correct, and `EAGER` that should have been lazy is a migration.

**★ Why can a `find` join an eager association but a JPQL query cannot?**
Because they are different kinds of request. `find` asks Hibernate for one entity by identifier
and leaves the SQL entirely to Hibernate, so it is free to satisfy the eager mapping by widening
the statement with an outer join. A JPQL query is a specification the application wrote: its row
count, its `distinct` semantics and its pagination are all part of what was asked for, and
silently adding joins would change all three. So Hibernate executes the query as written and then
satisfies the eager contract separately, per row. The per-row select is the only correct way to
honour two requirements that conflict — it just happens to be the bug this topic is about.

**★ What is the counterpart of `EAGER` for a lazy basic column?**
There is none, and the asymmetry is instructive. A basic attribute is fetched with the entity by
default and made lazy by opting out with `@Basic(fetch = LAZY)` plus bytecode enhancement — but
there is no per-query mechanism to say "this query does not need that column" on an entity load,
short of not loading the entity at all and selecting a projection instead. That is one more reason
projections keep turning out to be the answer: for columns, unlike for associations, the query
level has no override at all, so choosing what to select *is* the mechanism.

---

← Prev: [15c · Turning it off](15c-turning-it-off.md) · Index: [08 · The N+1 problem](README.md) · Next → [17 · Initialize loops](17-initialize-loops.md)
