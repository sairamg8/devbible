---
title: "The fix is a helper method on the parent that sets both sides — here it is in full, along with the accessor change that stops anyone bypassing it"
sidebar_label: "2c · Keeping both sides in step"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.8.2 *@OneToMany* and
> §6.2.3 *Bidirectional association management*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Hibernate ORM 7.4 *Introduction* §3.17 and §3.26 *equals() and hashCode()*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Setting the owning side fixes the database. Setting both sides fixes the object graph
as well, and the object graph is what the rest of your transaction reads. The standard
answer is a pair of methods on the parent entity — `addBook` and `removeBook` — that do
both mutations in one place, plus an accessor that makes it impossible to skip them.
Hibernate's own user guide writes exactly these methods in its `@OneToMany` examples,
so this is not folklore.**

## Why setting only the owning side is not quite enough

```java
book.setPublisher(publisher);   // database: correct
```

That writes `book.publisher_id`. Done, as far as SQL is concerned. But
`publisher.getBooks()` — if it has already been loaded in this persistence context —
still does not contain the book. So for the remainder of the transaction:

- a loop over `publisher.getBooks()` skips the new book;
- a size check reports the old count;
- a subsequent `orphanRemoval` pass sees a collection that never contained the book, so
  nothing surprising there, but a `CascadeType.PERSIST` from the parent will not reach
  it either — because the cascade walks the collection, and the book is not in it.

Reloading in a fresh persistence context gives the right answer. Within *this* one, you
are reading a stale view. That is not a Hibernate defect: the collection is a Java
field, you did not update it, and nothing was going to.

## The helper method, complete

```java
@Entity
public class Publisher {

    @Id @GeneratedValue
    private Long id;

    private String name;

    @OneToMany(mappedBy = "publisher",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private Set<Book> books = new HashSet<>();

    public void addBook(Book book) {
        books.add(book);            // inverse side  — keeps memory correct
        book.setPublisher(this);    // owning side   — keeps the database correct
    }

    public void removeBook(Book book) {
        books.remove(book);
        book.setPublisher(null);
    }

    public Set<Book> getBooks() {
        return Collections.unmodifiableSet(books);   // see below
    }
}
```

Four things about this that are deliberate:

**The methods live on the parent.** Not on `Book`, and not on a service class. The
parent is where the collection is, and the collection is the thing that goes stale.
Putting them anywhere else means the collection can be mutated by a path that does not
go through them.

**Both lines are in one method.** The entire point is that the two mutations cannot be
separated by accident. A code review can check one method once; it cannot check every
call site forever.

**`removeBook` sets the owning side to `null`.** That is what actually clears
`book.publisher_id`. Without it the removal is the mirror-image silent bug from
**[2b](02b-mappedby-and-the-silent-nothing.md)** — the collection shrinks in memory and
the row is untouched. With `orphanRemoval = true` the row is deleted rather than
orphaned, but you still want the field nulled so the in-memory `Book` is not pointing at
a parent that has disowned it.

**The collection is initialised at the field.** `= new HashSet<>()` means `addBook` never
sees `null`, including on a brand-new instance that has never been near a database.

## The accessor that stops people bypassing it

`Collections.unmodifiableSet(books)` is the part most codebases skip, and it is the part
that makes the pattern hold. Without it, `publisher.getBooks().add(book)` still compiles
and still silently does nothing — the helper method exists but nothing forces its use.
With it, that call throws `UnsupportedOperationException` at the point of the mistake.

⚠️ **Return the wrapper, but keep the field itself mutable.** Hibernate assigns and
mutates the real `books` field through reflection (or the enhanced accessor). Never make
the field itself an immutable collection, and never replace it wholesale with
`setBooks(Set.copyOf(…))` — Hibernate tracks the *identity* of the persistent collection
instance it gave you, and swapping it out for a different instance defeats its change
tracking.

That last point deserves a rule of its own: **do not write a public setter for a
collection field.** Take the arguments you actually need and mutate in place:

```java
public void replaceBooks(Collection<Book> newBooks) {
    this.books.clear();                       // mutate the SAME instance
    newBooks.forEach(this::addBook);
}
```

## The `equals`/`hashCode` interaction you have to notice now

`books` is a `HashSet`. `add` and `remove` therefore call `hashCode()` and `equals()` on
`Book`. If `Book` inherits the defaults from `Object`, identity semantics apply and the
set behaves — but only as long as you never mix instances loaded in different
persistence contexts, which represent the same row and are not `==`.

If `Book` overrides `hashCode()` using its generated `id`, you get a worse failure:

```java
Book b = new Book("978-1", "Java Concurrency");
publisher.addBook(b);       // b.id is null → hashCode computed from null-ish state
em.persist(b);              // b.id is now assigned → hashCode CHANGES
publisher.getBooks().contains(b);   // may return false; the bucket is wrong
```

The Hibernate 7.4 *Introduction* gives the rule directly: *"we advise against including
any database-generated field in the hashcode"*, and recommends basing `equals`/`hashCode`
on an immutable natural key instead — for `Book`, the ISBN. The full argument, including
why `equals` must use `instanceof` rather than `getClass()`, is
**[15 · equals, hashCode and toString](15-equals-hashcode-tostring.md)**.

For now: if you use a `Set` for the inverse collection — and you probably should — you
have taken on a `hashCode` obligation.

## Where the pattern is unnecessary

**Unidirectional `@ManyToOne` with no collection.** There is only one field, so there is
nothing to keep in step. This is one more argument for not adding the collection unless
you navigate it.

**A parent you never keep across the mutation.** If your service loads the child, sets
its parent, and returns, the parent's collection was never loaded and cannot be stale.
Correct, but fragile — the next person to add a `parent.getBooks()` call three lines
later reintroduces the problem. The helper costs six lines; write it.

## The bytecode-enhancement alternative, and why not to rely on it

Hibernate can do this for you. The 7.4 *User Guide* lists **bidirectional association
management** among the features of bytecode enhancement (§6.2.3): with enhancement
enabled, setting one side updates the other automatically.

Three reasons this does not replace the helper method:

1. **It is not on by default.** It requires the Hibernate Gradle or Maven plugin, an
   extra build step, and a decision that affects every entity class.
2. **Your classes then behave differently before and after enhancement.** A plain unit
   test that constructs entities with `new` and never touches Hibernate runs against
   *unenhanced* classes, so the automatic synchronisation is absent exactly where you are
   asserting on it.
3. **The helper method is six lines and works everywhere** — in tests, in DTO assembly,
   in a `main` method, in code that has not met a persistence context yet.

Turn enhancement on for the reasons it actually pays for itself (lazy attribute loading,
in-line dirty tracking, and the lazy `@OneToOne` case in
**[6c](06c-the-three-real-options.md)**), and write the helper anyway.

## Gotchas

**A helper that only adds is half a fix.**
`addBook` without `removeBook` guarantees that removals go through the raw collection,
which is the path you were trying to close. Write both, always, as a pair.

**`removeBook` on a `@ManyToOne` with a `NOT NULL` column will fail unless orphan removal
is on.** Setting `book.setPublisher(null)` asks Hibernate to write `NULL` into a
`NOT NULL` column. With `orphanRemoval = true` the row is deleted instead and the update
never happens. Without it, you get a constraint violation at flush — which is arguably
correct, because you asked for something the schema forbids.

**Cascading `persist` through the collection requires the object to be *in* the
collection.** If you call `book.setPublisher(publisher)` alone and rely on
`cascade = PERSIST` from the parent to save the book, nothing is persisted: the cascade
walks `publisher.books`, and the book is not there. This is the exact case where "the
database is correct" is not enough.

**Do not call the helper from inside a JPA lifecycle callback.**
Mutating associations from `@PrePersist`/`@PreUpdate` is unsupported territory in the
specification and behaves unpredictably with respect to flush ordering. Keep the helper
in ordinary business methods.

**A `List` inverse collection changes the removal semantics.**
`List.remove(Object)` removes the first element that `equals` the argument, and with a
weak `equals` that may not be the element you meant. It also has different persistence
behaviour — see **[10b · What a `List` costs](10b-what-a-list-costs.md)**.

**Lombok `@Data` generates a public setter for the collection and an `equals`/`hashCode`
over every field, including the association.** That is three of this chunk's rules broken
by one annotation. **[15](15-equals-hashcode-tostring.md)** covers it in full.

## Interview questions

**★ Why write `addChild`/`removeChild` helpers rather than just setting the owning side?**
Setting the owning side is sufficient for the database and insufficient for the object
graph. Within the current persistence context, the parent's collection is a plain Java
field that nobody updated, so any code that iterates it, counts it, or cascades through
it sees the state from before your change. The helper performs both mutations in one
place so they cannot drift apart, which also means the correctness argument lives in one
method instead of at every call site.

**★ Why make the collection getter return an unmodifiable view?**
Because otherwise the helper is advisory. `parent.getChildren().add(child)` compiles, does
not throw, and silently fails to persist — the exact bug the helper exists to prevent.
Returning `Collections.unmodifiableSet(...)` converts that mistake into an immediate
`UnsupportedOperationException` at the offending line. Important detail: you wrap the
field on the way out, you do not make the field itself immutable — Hibernate needs to
mutate the real collection instance it manages.

**★ Why should you never write a public setter for a mapped collection?**
Because Hibernate replaces the collection field with its own persistent-collection
wrapper when the entity is loaded, and it tracks changes through that specific instance.
Assigning a different collection object throws away the instance Hibernate is watching,
so change tracking is lost or the collection is treated as entirely new — which, on a
bag, can mean deleting and reinserting every row. Mutate in place instead: `clear()` the
existing collection and add to it.

**★ What is the connection between the helper method and `equals`/`hashCode`?**
The inverse collection is usually a `Set`, so `add` and `remove` route through
`hashCode()` and `equals()`. If those are derived from a database-generated identifier,
an entity's hash changes when it is persisted and the object is effectively lost inside
the set — `contains` returns false for an element that is physically present. Hibernate's
documentation advises against putting any database-generated field in the hash code and
recommends an immutable natural key. So choosing `Set` for the collection commits you to
writing a sound `equals`/`hashCode`.

**★ Hibernate has bytecode enhancement that manages both sides automatically. Why still
write the helper?**
Because enhancement is an opt-in build step, it changes behaviour between enhanced and
unenhanced runs, and plain unit tests that never involve Hibernate exercise the
unenhanced class. Relying on it means your entity is only correct in one of the two
environments it runs in. The helper is a handful of lines, has no build dependency, and
behaves identically everywhere. Enable enhancement for lazy attribute loading and the
lazy one-to-one case; do not use it as a substitute for correct domain code.

**★ Is there a case where you would deliberately not keep both sides in step?**
Yes — when the inverse side is not mapped at all. If the parent has no collection, there
is nothing to synchronise, and that is frequently the better design for a large
one-to-many. Hibernate's introduction also notes that updating the unowned side is not a
hard requirement if you know what you are doing; the practical exception is when the
parent's collection is never loaded in that unit of work, so it cannot be observed stale.
That is a fragile thing to rely on, because it stops being true the moment someone adds
a read of the collection nearby.

---

← Prev: [2b · The silent nothing](02b-mappedby-and-the-silent-nothing.md) · Index: [Relationships and fetch types](README.md) · Next → [3 · @ManyToOne](03-many-to-one.md)
