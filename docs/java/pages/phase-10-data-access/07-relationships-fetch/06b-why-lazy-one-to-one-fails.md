---
title: "A lazy @OneToOne on the inverse side is ignored, and the reason is precise: Hibernate cannot decide between a proxy and null without going to the database first"
sidebar_label: "6b · Why lazy @OneToOne fails"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.8.3 *@OneToOne →
> Bidirectional @OneToOne lazy association* and §31.4 *Associations*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §3.18 *One-to-one (first way)* and §5.6 *Proxies
> and lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Jakarta Persistence 3.2 `FetchType` javadoc
> ([.../fetchtype](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/fetchtype)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**You write `fetch = FetchType.LAZY` on the `mappedBy` side of a `@OneToOne`, and
Hibernate loads it eagerly anyway — with a second query, per row. This is not a bug and
it is not Hibernate ignoring you. It is a consequence of what a proxy is: a proxy stands
in for an object, and there is no proxy that can stand in for `null`. Hibernate must
know whether the row exists before it can decide what to put in the field, and finding
that out is exactly the query laziness was supposed to avoid.**

## The mapping that does not do what it says

```java
@Entity
public class Author {

    @Id @GeneratedValue
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "person_id", unique = true)
    private Person person;            // OWNING — lazy works here
}

@Entity
public class Person {

    @Id @GeneratedValue
    private Long id;

    @OneToOne(mappedBy = "person", fetch = FetchType.LAZY)
    private Author author;            // INVERSE — lazy does NOT work here
}
```

Load a `Person`. The `author` field is populated immediately, by an extra query. Load a
hundred `Person`s and you get a hundred extra queries — which is the N+1 problem,
arriving from a mapping that says `LAZY` in plain text.

The 7.4 *User Guide* states it without qualification:

> Although you might annotate the parent-side association to be fetched lazily, Hibernate
> cannot honor this request since it cannot know whether the association is null or not.

and its best-practice chapter repeats it as a rule:

> The parent-side `@OneToOne` association requires bytecode enhancement so that the
> association can be loaded lazily. Otherwise, the parent-side association is always
> fetched even if the association is marked with `FetchType.LAZY`.

## Why the owning side can be lazy and the inverse side cannot

This is the part worth understanding rather than memorising, because once you see it the
behaviour stops being arbitrary.

**A proxy is a stand-in object.** The 7.4 *Introduction* defines it: *"A proxy is an
object that masquerades as a real entity or collection, but doesn't actually hold any
state, because that state has not yet been fetched from the database."* To build one,
Hibernate needs one thing: **the identifier of the row it stands for**. It creates an
object of the right type carrying that id, and defers everything else.

Now compare the two sides.

**Owning side — `Author.person`.** When Hibernate loads an `Author` row, it reads
`author.person_id` as part of that same row. Two cases, both decidable without another
query:

- the column is `NULL` → the association is absent → put `null` in the field;
- the column holds `42` → the association is present, and its id is 42 → build a proxy.

The information needed to choose was already in the row. No extra query. Lazy works.

**Inverse side — `Person.author`.** Hibernate loads a `person` row. That row contains
`id` and `full_name`. It contains **nothing about `author`** — the key is on the other
table. So to decide what goes in `person.author`, Hibernate must answer "is there an
`author` row whose `person_id` equals this person's id?" and the only way to answer it is
`SELECT … FROM author WHERE person_id = ?`.

There is no third option. It cannot put `null` in the field, because there may be an
author. It cannot put a proxy in the field, because there may not be, and a proxy that
turns out to stand for nothing is worse than useless — `person.getAuthor()` would return
a non-null object that throws the moment you touch it, and `person.getAuthor() == null`
would be `false` for a person with no author. That would be a correctness bug, not a
performance trade.

So Hibernate runs the query. Having run it, it has the data, so it may as well populate
the field.

**The one-sentence version:** *a proxy can represent an object; nothing can represent
"maybe an object". The owning side knows which it is from its own row; the inverse side
does not.*

## Why `LAZY` is allowed to be ignored at all

Because the specification says so. The Jakarta Persistence `FetchType` javadoc draws a
deliberate asymmetry between the two constants:

- `EAGER` is *"a requirement on the persistence provider runtime that data must be
  eagerly fetched"*;
- `LAZY` is *"a **hint** to the persistence provider runtime that data should be fetched
  lazily when it is first accessed. The implementation is permitted to eagerly fetch data
  for which the `LAZY` strategy hint has been specified."*

So `EAGER` is a promise you cannot escape and `LAZY` is a request that may be declined.
Hibernate declines it here, for the reason above. It is worth carrying that asymmetry
forward: **you can always make something eager and you cannot always make something
lazy.** It is the reason `EAGER` in a mapping is so much more dangerous than `LAZY` —
see **[13 · EAGER on a collection](13-eager-on-a-collection.md)**.

## Where the cost actually lands

The extra query is per `Person`, not per query. So:

- `em.find(Person.class, 1L)` → one query for the person, one for the author. Annoying.
- a query returning 200 people → one query for the people, and **200** for their authors.

That second shape is the N+1 problem, and the 7.4 *User Guide* names it in exactly this
context: *"Because this can lead to N+1 query issues, it's much more efficient to use
unidirectional `@OneToOne` associations with the `@MapsId` annotation in place."*

🔴 **Fixing N+1 belongs to [Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md).** What belongs
here is the *mapping-level* answer: change the mapping so the extra query is not needed
in the first place. That is **[6c · The three real options](06c-the-three-real-options.md)**.

## What does *not* fix it

Worth listing, because these are the things people try first.

**Writing `LAZY` more emphatically.** Adding it to both sides, or to the `@JoinColumn`,
or setting `hibernate.enable_lazy_load_no_trans`. The last one is a different feature
entirely and a bad idea besides — it opens a temporary session per access, which converts
a startup-visible design problem into a scattering of invisible ones.

**Making the field type `Optional<Author>`.** JPA does not map `Optional` as an
association type, and even if it did the provider would still have to run the query to
know whether the `Optional` is empty.

**Removing `fetch = LAZY` and hoping.** The default for `@OneToOne` is `EAGER` anyway, so
removing it makes the situation explicitly worse rather than accidentally worse.

**Adding `@BatchSize`.** That turns N queries into N/batch queries, which is a real
improvement and is Topic 08's material — but it does not make the association lazy, and
it does not help the single-entity case at all.

## Gotchas

**The mapping says `LAZY` and lies, silently.** There is no warning at startup and no
log line saying the hint was declined. The only symptom is query count, which nobody
notices until it is a production problem.

**It is the *inverse* side, not the "parent" side, that has the problem — but Hibernate's
docs say "parent-side".** In the guide's `Phone`/`PhoneDetails` example the parent is the
`mappedBy` side, so the words line up there. In general, read "parent-side" in that
passage as "the side without the foreign key".

**A nullable owning side is fine; a nullable *inverse* side is the whole problem.** If
every `Person` is an `Author`, the ambiguity disappears — and so does the restriction.
That is option one in the next chunk.

**This interacts badly with `@OneToOne` on a `@MappedSuperclass` or a base entity.** Each
subclass inherits the inverse side and each one pays the extra query. The cost multiplies
by inheritance depth in a way that is very hard to see from any single class.

**Two inverse-side `@OneToOne`s on one entity means two extra queries per row.** They do
not combine. A `Person` with `author`, `subscription` and `profile` all mapped
`mappedBy` costs three additional queries every time a person is loaded.

**The equivalent problem does not exist for `@OneToMany`.** A collection can always be
lazy, because an empty collection is a perfectly good stand-in for "no rows" — there is
no null/proxy dilemma. That asymmetry is why `@OneToMany` defaults to `LAZY` and
`@OneToOne` to `EAGER`.

## Interview questions

**★ Why is `fetch = LAZY` ignored on the `mappedBy` side of a `@OneToOne`?**
Because the persistence provider has to decide between putting `null` in the field and
putting a proxy in it, and it cannot make that decision from the row it just loaded. The
foreign key is on the other table, so the only way to know whether an associated row
exists is to query for it — and once that query has run, the data is in hand and there is
nothing left to defer. On the owning side the foreign-key column is part of the row being
loaded, so a `NULL` column means `null` and a non-null column gives the identifier a
proxy needs; the decision is free.

**★ Why can't Hibernate just always return a proxy and let it be null-ish?**
Because that would break `person.getAuthor() == null` and `Objects.isNull(...)` — a proxy
is a non-null object, so a person with no author would appear to have one until you
touched it, at which point it would fail. That is a correctness change, not a performance
trade-off, and no amount of laziness is worth it.

**★ Is Hibernate allowed to ignore `LAZY`?**
Yes, explicitly. The Jakarta Persistence `FetchType` javadoc defines `LAZY` as a hint and
says the implementation is permitted to fetch eagerly anyway, while `EAGER` is defined as
a requirement that must be honoured. So the two constants are not symmetric: you can
always force eager loading and you cannot always force lazy loading.

**★ What does this cost in a real application?**
One extra query per loaded entity on the inverse side. For a single `find` that is one
extra round trip. For a query returning N rows it is N extra queries — the N+1 problem
arriving from a mapping annotation rather than from a loop. Hibernate's documentation
names the N+1 risk in exactly this context and recommends restructuring the mapping.

**★ Someone suggests `hibernate.enable_lazy_load_no_trans = true` to fix a related lazy
problem. What is wrong with that?**
It is not a fix for this at all — it addresses lazy loading outside a session, not the
proxy-versus-null decision — and as a general setting it is harmful. It silently opens a
temporary session and transaction for each lazy access, which turns a visible design
problem into an unbounded number of invisible short transactions, each with its own
connection checkout. Fix the mapping or fetch the data deliberately.

**★ Why does `@OneToMany` never have this problem?**
Because a collection has a natural representation for "no rows": an empty collection.
Hibernate can install an uninitialised persistent collection in the field without knowing
whether it will turn out to be empty, and nothing about that object's null-ness depends on
the answer. A single-valued association has no such neutral value, which is exactly why
the JPA defaults split the way they do — `LAZY` for collections, `EAGER` for singular
associations.

---

← Prev: [6 · @OneToOne](06-one-to-one.md) · Index: [Relationships and fetch types](README.md) · Next → [6c · The three real options](06c-the-three-real-options.md)
