---
title: "Adding to the inverse collection persists nothing — no exception, no warning, and the object graph looks correct right up until the next transaction"
sidebar_label: "2b · The silent nothing"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §3.17 *Many-to-one*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Hibernate ORM 7.4 *User Guide* §3.8.2 *@OneToMany*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**This is the single most common JPA bug and it is a direct consequence of the previous
chunk. You add a child to the parent's collection, the code compiles, nothing throws,
the collection contains the child, and the foreign key is never written. The Hibernate
documentation states it flatly: changes made to the unowned side of an association are
never synchronized to the database. This chunk shows the exact shape of the bug, the
three ways it surfaces, and why "it worked in my test" is the most dangerous version
of it.**

## The bug, in nine lines

```java
@Transactional
public void addBook(Long publisherId, Book book) {
    Publisher publisher = em.find(Publisher.class, publisherId);

    publisher.getBooks().add(book);   // the inverse side. Maps no column.
    em.persist(book);                 // the book row IS inserted

    // book.publisher was never set
}
```

Walk it through against the mapping from the last chunk. `Publisher.books` carries
`mappedBy = "publisher"`, so it maps no column. `Book.publisher` maps
`book.publisher_id`, and nothing in this method touched it.

At flush, Hibernate inserts a `book` row. It needs a value for `publisher_id`, and it
reads that value from `Book.publisher`, which is `null`. So one of two things happens:

- If `publisher_id` is nullable, the row is inserted with `publisher_id = NULL`. The
  method returns successfully. The book exists and belongs to nobody.
- If `publisher_id` is `NOT NULL` — which it should be — the database rejects the
  `INSERT` and you get a constraint violation, surfacing in Spring as a
  `DataIntegrityViolationException` (see **[Topic 01 · JDBC](../01-jdbc/README.md)** for
  how a `SQLException` becomes that).

The second outcome is the lucky one. It fails loudly, at the point of the mistake, with
a message naming the column. The first outcome ships.

## Why nothing warns you

Three separate mechanisms each decline to complain, and it is worth knowing why, because
each one is doing its job correctly.

**The compiler.** `publisher.getBooks().add(book)` is a call to `Set.add`. It is valid
Java on a valid collection. There is no type-level distinction between an owned and an
unowned collection — both are just `Set<Book>`.

**Hibernate's dirty check.** Hibernate does compare loaded state against current state to
decide what to write (that mechanism belongs to
[Topic 06 · JPA and the persistence context](../06-jpa-hibernate-model/README.md)). But it only compares the attributes that **map columns**.
An unowned collection maps nothing, so there is nothing to compare and nothing to
generate. It is not that Hibernate looked and decided to skip it; there is no column in
its model for that attribute at all.

**The database.** A nullable foreign key is a perfectly ordinary schema. `NULL` means
"no publisher", which is a legitimate state the schema was designed to allow.

## Three ways it reaches you, in increasing order of expense

**1 · Constraint violation on flush.** `NOT NULL` on the FK column catches it
immediately. Cheapest possible outcome.

**2 · A row with a `NULL` foreign key.** Nullable FK, no cascade surprises, the insert
succeeds. You find out when a report is short, or when a `JOIN` silently drops rows, or
when someone asks why a publisher has no books. Days later, and the offending code is
not in the stack trace because there is no stack trace.

**3 · The test that passes.** This one deserves its own section.

## Why the test passes and production does not

```java
@Test
@Transactional
void addsBookToPublisher() {
    Publisher p = em.find(Publisher.class, 1L);
    Book b = new Book("978-1", "Java Concurrency");

    p.getBooks().add(b);
    em.persist(b);

    assertThat(p.getBooks()).hasSize(1);   // passes
}
```

The assertion reads `p.getBooks()`, an in-memory `Set` that you just added to. It has
one element because you put one there. The database was never consulted. The test is
asserting that `Set.add` works.

The same happens in a service method that adds and then reads within one transaction —
the persistence context returns the same managed instances, so the collection you
mutated is the collection you read back. The lie survives exactly as long as the
persistence context does, which in a request-scoped Spring transaction is exactly as
long as the request.

**A test that would actually catch it** flushes and clears, forcing a real read:

```java
@Test
@Transactional
void addsBookToPublisher() {
    Publisher p = em.find(Publisher.class, 1L);
    Book b = new Book("978-1", "Java Concurrency");

    p.getBooks().add(b);
    em.persist(b);

    em.flush();
    em.clear();                            // throw away the first-level cache

    Publisher reloaded = em.find(Publisher.class, 1L);
    assertThat(reloaded.getBooks()).hasSize(1);   // now this means something
}
```

`em.clear()` detaches everything, so the second `find` genuinely queries, and
`reloaded.getBooks()` genuinely runs `SELECT … FROM book WHERE publisher_id = ?`. With
the bug present, that returns nothing and the assertion fails — which is what you wanted.

⚠️ **`flush()` alone is not enough.** It writes pending statements but leaves the
persistence context populated, so the subsequent `find` is served from memory and the
stale collection is returned. The `clear()` is the part that does the work.

## The mirror-image bug: removing from the inverse collection

Exactly the same asymmetry applies to removal, and it is even easier to miss because
there is no `NOT NULL` constraint standing guard.

```java
publisher.getBooks().remove(book);   // does nothing to the database
```

The book keeps its `publisher_id`. Reload in a new transaction and it is back in the
collection. Developers frequently conclude that the delete "didn't commit" and start
looking at transaction boundaries — see **[Topic 04 · Spring
`@Transactional`](../04-spring-transactional/README.md)** — when the transaction was
never the problem.

The one exception is `orphanRemoval = true`, which *does* act on removal from an inverse
collection, because it is a lifecycle operation rather than a column write. That is
**[9 · Orphan removal](09-orphan-removal.md)**, and it deletes the child row entirely
rather than clearing the key, which is a different outcome again.

## The fix, stated here and shown in full next

**Set the owning side.** One line:

```java
book.setPublisher(publisher);   // this is what writes book.publisher_id
```

That alone makes the database correct. It leaves the in-memory `publisher.getBooks()`
stale for the rest of the transaction, which matters more than it sounds — so the
complete answer is a helper method that sets both sides at once, and that is
**[2c · Keeping both sides in step](02c-keeping-both-sides-in-step.md)**.

## Gotchas

**"I called `save()` on the parent" does not help.**
Cascading `persist` from `Publisher` to `Book` inserts the `book` row. It does not set
`book.publisher_id`, because cascade propagates *operations*, not column values. A
cascaded insert with an unset owning side gives you exactly outcome 1 or 2 above.

**`saveAll` and Spring Data do not change anything here.**
`JpaRepository.save` delegates to `persist` or `merge`. There is no Spring Data layer
that inspects your collections and fixes the owning side. The behaviour is identical.

**The bug is invisible in the logs.**
There is no statement to log, because no statement was generated. Turning on SQL logging
shows a correct-looking `INSERT INTO book …` with a `NULL` parameter, or nothing unusual
at all on the removal variant. You are looking for an absence.

**A `NOT NULL` foreign key is a design decision that buys you a whole class of caught
bugs.** If a child genuinely cannot exist without its parent, say so in the schema. The
constraint turns the silent version of this bug into an immediate, precisely-located
failure. That is worth more than the flexibility you give up.

**Reusing a detached parent makes it worse.**
If `publisher` came from a previous transaction and is detached, `publisher.getBooks()`
may not even be a live collection — touching it can throw, or return whatever was
loaded before. Now you have two bugs layered on each other. **Topic 10 · Lazy-loading
pitfalls** *(not written yet)* owns that failure mode.

**Bytecode enhancement can hide it — and only sometimes.**
Hibernate's bidirectional association management (a bytecode-enhancement feature listed
in the 7.4 *User Guide* §6.2.3) can keep both sides in step automatically. It is not on
by default, it requires a build plugin, and relying on it means your domain classes only
behave correctly after enhancement — including in plain unit tests that do not run it.
Write the helper method instead.

## Interview questions

**★ A colleague says "I added the child to the parent's list and called save, but the
foreign key is null." What happened?**
They mutated the inverse side of the association. The parent's collection carries
`mappedBy`, so it maps no column and Hibernate's dirty check never considers it when
generating SQL — the Hibernate documentation states that changes to the unowned side are
never synchronized to the database. The child row was inserted, either by an explicit
`persist` or by a cascade, and Hibernate read the foreign-key value from the child's
`@ManyToOne` attribute, which was never set. The fix is to set the owning side —
`child.setParent(parent)` — ideally inside a helper on the parent that sets both.

**★ Why did their test pass?**
Because the assertion read the in-memory collection they had just added to, not the
database. Within one persistence context, `find` returns the same managed instance, so
the mutated collection is handed straight back. To make the test meaningful you must
`flush()` and then `clear()` the persistence context, or commit and start a new one, so
the read actually issues a `SELECT` against the foreign-key column.

**★ Is `flush()` enough to expose the bug in a test?**
No. `flush()` synchronises pending changes to the database but leaves the first-level
cache intact, so the next `find` is served from memory. You need `clear()` (or a new
transaction) to detach everything and force a real query.

**★ Does removing from the inverse collection delete the child?**
By default it does nothing at all — the child keeps its foreign key and reappears on the
next load. If the association is mapped with `orphanRemoval = true`, removal from the
collection *does* trigger a delete of the child row, because orphan removal is a
lifecycle operation applied to the collection's contents rather than a column write. So
the same line of code either does nothing or permanently deletes a row, depending on one
annotation element. That is a good reason to read the mapping before touching the
collection.

**★ How would you stop this class of bug from recurring in a codebase?**
Three things, in order of value. Make the foreign key `NOT NULL` wherever the domain
allows it, so the silent variant becomes a loud one. Give every bidirectional
association a helper method on the parent (`addBook`/`removeBook`) and make the raw
collection accessor return an unmodifiable view, so `getBooks().add(…)` does not compile
as valid usage. And write integration tests that `clear()` the persistence context
before asserting, so the assertion talks to the database rather than to the `Set` you
just mutated.

---

← Prev: [2 · The owning side](02-the-owning-side.md) · Index: [Relationships and fetch types](README.md) · Next → [2c · Keeping both sides in step](02c-keeping-both-sides-in-step.md)
