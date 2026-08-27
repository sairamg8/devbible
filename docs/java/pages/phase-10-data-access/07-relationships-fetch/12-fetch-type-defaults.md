---
title: "The four fetch defaults, exactly: singular associations are EAGER and collections are LAZY — and the two singular defaults are wrong for almost every application"
sidebar_label: "12 · The fetch defaults"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 javadocs for `@ManyToOne`,
> `@OneToOne`, `@OneToMany`, `@ManyToMany` and `FetchType`
> ([jakarta.ee/specifications/persistence/3.2/apidocs/](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/fetchtype)),
> the Hibernate ORM 7.4 *User Guide* §31.6.1 *Fetching associations*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Hibernate ORM 7.4 *Introduction* §3.16–3.17 and §5.6
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Four annotations, two defaults, and the split is by multiplicity rather than by
sense. Singular associations — `@ManyToOne` and `@OneToOne` — default to `EAGER`.
Collections — `@OneToMany` and `@ManyToMany` — default to `LAZY`. The collection defaults
are right. The singular defaults are wrong for almost every application, and writing
`fetch = FetchType.LAZY` on every `@ManyToOne` and `@OneToOne` in your model is standard
practice, not a micro-optimisation.**

## The table, quoted from the javadocs

| Annotation | Default `fetch` | Javadoc wording |
|---|---|---|
| `@ManyToOne` | **`EAGER`** | *"If not specified, defaults to `EAGER`."* |
| `@OneToOne` | **`EAGER`** | Default: `EAGER` |
| `@OneToMany` | `LAZY` | Default: `LAZY` |
| `@ManyToMany` | `LAZY` | *"If not specified, defaults to `LAZY`."* |

Hibernate's *Introduction* reproduces the same split in its table of association-defining
annotation members: *"`LAZY` for `@OneToMany` and `@ManyToMany`, `EAGER` for
`@ManyToOne`"* — with three skull emojis attached to the last one, which is as close to
editorial comment as reference documentation gets.

## `EAGER` and `LAZY` are not symmetric

The `FetchType` javadoc defines them with deliberately different force:

- **`EAGER`** — *"a requirement on the persistence provider runtime that data must be
  eagerly fetched."*
- **`LAZY`** — *"a **hint** to the persistence provider runtime that data should be fetched
  lazily when it is first accessed. The implementation is permitted to eagerly fetch data
  for which the `LAZY` strategy hint has been specified."*

So one is binding and one is advisory. **You can always force eager loading; you cannot
always force lazy loading.** You have already seen the provider decline the hint —
**[6b · Why lazy `@OneToOne` fails](06b-why-lazy-one-to-one-fails.md)**.

That asymmetry is why the two mistakes are not equally serious. A wrongly-`LAZY` mapping
costs you a query you did not want at a moment you chose. A wrongly-`EAGER` mapping costs
you a query you cannot decline, at every call site, forever.

## Why the singular defaults are what they are

Hibernate's *User Guide* gives the history, and it is worth knowing because it explains why
the default is not defensible on technical grounds:

> Prior to Jakarta Persistence, Hibernate used to have all associations as `LAZY` by
> default. However, when Java Persistence 1.0 specification emerged, it was thought that
> not all providers would use Proxies. Hence, the `@ManyToOne` and the `@OneToOne`
> associations are now `EAGER` by default.

The default exists to accommodate providers that could not build a proxy for a singular
association. Hibernate can. The default is a compatibility decision from 2006 that every
application since has had to override.

The *Introduction* does not soften it:

> A very unfortunate misfeature of JPA is that `@ManyToOne` associations are fetched
> eagerly by default. This is almost never what we want. Almost all associations should be
> lazy.

and the *User Guide*'s best-practice chapter:

> `EAGER` fetching is almost always a bad choice. […] So, `EAGER` fetching is to be
> avoided. For this reason, it's better if all associations are marked as `LAZY` by
> default.

## The one exception the documentation allows

The *Introduction* names a single case where `EAGER` on a singular association is
reasonable:

> The only scenario in which `fetch=EAGER` makes sense is if we think there's always a
> very high probability that the associated object will be found in the second-level
> cache. Whenever this isn't the case, remember to explicitly specify `fetch=LAZY`.

Read the condition carefully. Not "the object is small". Not "we usually need it". A very
high probability that it is already in the second-level cache — so the eager fetch costs a
cache lookup rather than a query. A country lookup table, a currency table, a small set of
configuration rows with caching enabled and a high hit rate.

Everything else is `LAZY`.

## What `EAGER` actually does at fetch time

It is not one behaviour. The *User Guide* describes two, and the second is the one that
hurts:

> The `EAGER` fetching strategy cannot be overwritten on a per query basis, so the
> association is always going to be retrieved even if you don't need it. Moreover, if you
> forget to `JOIN FETCH` an `EAGER` association in a JPQL query, Hibernate will initialize
> it with a secondary statement, which in turn can lead to N+1 query issues.

So an `EAGER` association is fetched either by joining it into the query — which changes
the shape of the result set — or, when the query did not join it, by a follow-up statement
per row. You do not choose which; the provider does, based on how the entity was loaded.

🔴 **Naming the danger is this topic's job. Solving it is not.** Fetch joins,
`@EntityGraph`, `@BatchSize` and projections all belong to [Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md).

## The mapping discipline that follows

```java
@ManyToOne(fetch = FetchType.LAZY, optional = false)
@JoinColumn(name = "publisher_id")
private Publisher publisher;

@OneToOne(fetch = FetchType.LAZY, optional = false)
@JoinColumn(name = "person_id", unique = true)
private Person person;

@OneToMany(mappedBy = "publisher")           // LAZY by default — leave it
private Set<Book> books = new HashSet<>();

@ManyToMany                                   // LAZY by default — leave it
@JoinTable(name = "book_author", …)
private Set<Author> authors = new HashSet<>();
```

Two rules, and they are all you need:

1. **Write `fetch = FetchType.LAZY` on every `@ManyToOne` and `@OneToOne`.** Not because
   the current code needs it, but because you cannot know which call site will load this
   entity next year.
2. **Never write `fetch = FetchType.EAGER` on anything.** If you need an association
   loaded for a particular operation, load it for that operation.

The second rule is the one this whole part of the topic exists to justify. It is
**[13 · EAGER on a collection is a time bomb](13-eager-on-a-collection.md)**.

## How to audit an existing model

Every `@ManyToOne` or `@OneToOne` without an explicit fetch type is eager. There is no
warning, no log line and no startup message. A grep finds them:

```bash
grep -rn --include='*.java' -A1 '@ManyToOne\|@OneToOne' src/main/java \
  | grep -B1 -v 'FetchType.LAZY'
```

Crude, and it will find the ones worth looking at. In a mature codebase the count is
usually higher than anyone expects, because the default is invisible and nobody wrote
anything wrong — they wrote nothing.

## Gotchas

**"No fetch type specified" means `EAGER` on singular associations.** The most common
performance defect in JPA applications is not a bad annotation; it is an absent one.

**`LAZY` may be ignored, and you will not be told.** It is a hint by specification. The
inverse side of a `@OneToOne` is the documented case, and it is silent.

**Making an association `LAZY` moves the failure, it does not remove it.** The query you
avoided at load time still happens when you touch the association — and if the persistence
context has closed by then, you get a `LazyInitializationException` instead. **Topic 10 ·
Lazy-loading pitfalls** *(not written yet)* owns that.

**Spring Data projections and `EAGER` interact badly.** An interface projection selecting
three columns still has to honour the entity's `EAGER` associations when the query returns
entities. Read the generated queries rather than assuming a projection makes the mapping
irrelevant.

**`FetchType` on `@Basic` and `@Lob` exists and does nothing without bytecode
enhancement.** `@Basic(fetch = LAZY)` on a large text column is a hint the provider can
only honour with enhancement enabled — the same mechanism as
**[6c](06c-the-three-real-options.md)**.

**Two `@ManyToOne`s that are both eager compound at every level.** `OrderLine` eagerly
loading `Order`, which eagerly loads `Customer`, which eagerly loads `Address`, means
loading one line joins four tables. Nobody wrote that; four separate defaults did.

**Changing a mapping from `EAGER` to `LAZY` can break code that relied on it.** Somewhere,
a method returns an entity and something outside the transaction reads an association. That
worked because of the eager default. Fixing the mapping surfaces the real bug, which is
that the association was being read outside a session — but it surfaces it as a new
exception, so the change needs testing rather than a blanket find-and-replace.

## Interview questions

**★ What are the fetch defaults for the four association annotations?**
`@ManyToOne` and `@OneToOne` default to `EAGER`; `@OneToMany` and `@ManyToMany` default to
`LAZY`. The split is by multiplicity, not by usefulness — the javadocs state each of the
four explicitly. In practice the collection defaults are correct and the two singular
defaults should be overridden to `LAZY` on essentially every mapping.

**★ Why are the singular defaults `EAGER` if everyone overrides them?**
History. Hibernate's user guide explains that before JPA existed, Hibernate made all
associations lazy by default; when the Java Persistence 1.0 specification was written it
was thought that not all providers would use proxies, so singular associations were
specified as eager. It is a portability decision from the specification's first version,
not a technical recommendation, and Hibernate's own documentation calls it an unfortunate
misfeature.

**★ Is `LAZY` guaranteed?**
No. The `FetchType` javadoc defines `EAGER` as a requirement on the provider and `LAZY` as
a hint, explicitly permitting the implementation to fetch eagerly anyway. The documented
case where Hibernate declines the hint is the inverse side of a `@OneToOne`, where it
cannot decide between null and a proxy without querying. The asymmetry is worth
remembering as a rule: eager is always achievable, lazy is not.

**★ Is there any case where `EAGER` is the right choice?**
Hibernate's documentation names one: when there is a very high probability that the
associated object is already in the second-level cache, so the eager fetch costs a cache
lookup rather than a database round trip. A small, heavily-cached reference table fits.
"We usually need it" does not — that is an argument for fetching it deliberately in the
queries that need it, which is a per-query decision rather than a mapping-wide one.

**★ What exactly does `EAGER` do when you run a JPQL query?**
It depends on whether the query joined the association. If it did, the association comes
back in the same result set. If it did not, Hibernate issues a secondary statement to
initialise it — per row. The user guide states both halves: the eager strategy cannot be
overridden per query, and forgetting to `JOIN FETCH` an eager association leads to a
secondary statement which can produce N+1 queries. You do not get to choose which path is
taken.

**★ How would you audit an existing entity model for fetch problems?**
Look for every `@ManyToOne` and `@OneToOne` that does not specify a fetch type, because
each of those is eager and nothing in the code says so. That is a grep, and in a mature
codebase it usually finds more than anyone expects — the defect is an absent annotation
rather than a wrong one. Then look for any explicit `FetchType.EAGER`, especially on
collections, and treat each as something that has to be justified rather than something to
be tuned.

**★ Why is a wrongly-`EAGER` mapping worse than a wrongly-`LAZY` one?**
Because of where the decision lives. A lazy association that you needed costs one query,
issued when you touch it, at a call site that can choose to fetch it up front instead. An
eager association is fetched at every call site that loads the entity, including the
hundred that never touch it, and no call site can decline — the user guide says the eager
strategy cannot be overridden on a per-query basis. One mistake is local and fixable at the
point of use; the other is global and fixable only by changing the mapping.

---

← Prev: [11 · @ElementCollection](11-element-collection.md) · Index: [Relationships and fetch types](README.md) · Next → [13 · EAGER on a collection](13-eager-on-a-collection.md)
