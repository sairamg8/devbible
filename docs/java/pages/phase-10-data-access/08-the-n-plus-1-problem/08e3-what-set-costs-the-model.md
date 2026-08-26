---
title: "Changing a collection from List to Set hands equality the power to decide what exists, and hashCode the power to issue queries"
sidebar_label: "8e3 · What Set costs the model"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §3.9.11 *Bags*,
> §3.9.12 *Ordered Lists* and §3.9.13 *Sets*
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> and the `java.util.Set` and `java.util.SortedSet` specifications in the JDK 25
> API documentation
> ([docs.oracle.com/en/java/javase/25/docs/api](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/SortedSet.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Fix 1 in [chunk 8e2](08e2-the-three-ways-out.md) is one word — `List` becomes
`Set` — and it is the only fix in this part that changes what the domain model
*means*. Equality starts deciding which rows exist, `hashCode()` starts running
once per element during loading, and an identifier assigned by a flush can put an
element in the wrong bucket of its own collection. None of that throws.**

## What you actually changed

You did not change a fetching strategy. You changed a **collection semantic**.

The Hibernate user guide is precise about what a `List`-typed association can be.
§3.9.11 calls a plain `List` a **bag** — "bags are unordered lists". §3.9.12 adds
that "although they use the `List` interface on the Java side, bags don't retain
element order", and offers two ways to get order back. §3.9.13 says "sets are
collections that don't allow duplicate entries".

| Java type | Hibernate semantic | Duplicates | Order | Extra column |
|---|---|---|---|---|
| `List`, nothing else | bag | kept | none guaranteed | none |
| `List` + `@OrderBy` | bag, ordered on read | kept | by an `ORDER BY` | none |
| `List` + `@OrderColumn` | indexed list | kept | persisted | **yes** |
| `Set` | set | **collapsed by `equals`** | none | none |
| `SortedSet` + comparator | sorted set | collapsed | in memory | none |

`MultipleBagFetchException` is raised for **bags**, so anything in that table
except the first two rows silences it. The rest of this chunk and
[8e4](08e4-ordering-and-the-call-sites.md) are why *which* one you pick matters
far more than the exception did.

The mapping detail behind each is
[topic 07 chunk 10](../07-relationships-fetch/10-collection-types.md). What
follows is what changes *because you made the switch to fix a query*.

## Consequence 1 · `hashCode()` now runs during loading

A `Set` is materialised into a hash-based collection, so as Hibernate adds each
row's entity it calls `hashCode()` on it — and, on a collision, `equals()`.

That is fine when `hashCode()` reads a stored column. It is a catastrophe when it
dereferences an association:

```java
@Entity
class OrderLine {
    @Id @GeneratedValue Long id;
    @ManyToOne(fetch = FetchType.LAZY) Order   order;
    @ManyToOne(fetch = FetchType.LAZY) Product product;
    int quantity;

    @Override public int hashCode() {
        return Objects.hash(order, product, quantity);   // ← two proxies, per element
    }
}
```

Every element now touches two lazy proxies to compute its own hash. You have
replaced a Cartesian product with a fresh N+1 **inside the collection loader**,
which is strictly worse than what you started with: it is invisible to the row
count you were watching, and it happens on every read of that collection forever,
not only in the query you were fixing.
[Chunk 4e](04e-lazy-columns-and-hashcode.md) is the mechanism in full; the
correct shape is
[topic 06 chunk 10b](../06-jpa-hibernate-model/10b-fixing-entity-equality.md).

**Lombok's `@Data` and a bare `@EqualsAndHashCode` generate exactly the bad
shape**, and an IDE's "generate `equals` and `hashCode` over all fields"
generates it too. This is not a rare mistake; it is the default one.

## Consequence 2 · `equals` starts deciding what exists

A bag delivers what the database delivered. A `Set` delivers what `equals`
permits. If two rows compare equal, one of them is gone — not "gone from this
query", gone from the object you are about to render, serialise, or write back.

```java
// two rows in ORDER_LINE, same product, entered as separate lines
// bag -> lines.size() == 2
// set -> lines.size() == 1, if equals() compares product and price
```

Three things make this land in production rather than in a test:

- The collapse is **silent**. No exception, no warning, no log line, no
  difference in the SQL.
- It only happens for rows that genuinely duplicate on the business fields, and
  test fixtures rarely contain those, because fixtures are written to be
  distinguishable.
- If the collection is later **written back** — cleared and re-saved, or governed
  by `orphanRemoval` — the row that was dropped on read is deleted for real. A
  read bug becomes a write bug one release later.

The fix is not to revert the collection type; it is to make `equals` mean *"the
same row"*, which for an entity means the identifier. Reverting is the right
*first* move to stop the bleeding, and fixing equality is the right second one.

## Consequence 3 · a `hashCode` that changes after `persist`

This is specific to `Set`, and it is why "just use the id in `hashCode`" is not,
by itself, advice.

```java
Order order = new Order();
OrderLine line = new OrderLine(order, product, 2);
order.getLines().add(line);        // line.id is null      -> hashCode() is one value
em.persist(order);                 // flush assigns the id -> hashCode() is another
order.getLines().contains(line);   // may now be false
order.getLines().remove(line);     // may now do nothing
```

A `HashSet` buckets an element using the hash it had **at insertion time**. When
the flush assigns the identifier, the hash changes, the element sits in the wrong
bucket, and `contains()` and `remove()` stop finding it. Nothing throws. The
collection is quietly wrong for the rest of that persistence context's life.

With a bag none of this could happen, because an `ArrayList` never asks for a
hash. Switching to `Set` is precisely what makes an entity's `hashCode` stability
start to matter — which is why the two changes belong in one commit.

The two resolutions are an **immutable** business key, or a `hashCode()` that
returns a constant for the class. The second is correct under the contract and
degrades hash lookups within one collection to a linear scan, which is fine for a
collection you have already decided is small.

## Gotchas

**⚠️ Shipping the type change and the equality change in separate commits.**
The window between them is a production window in which the collection either
collapses rows or issues a query per element. They are one change. If review
pressure forces them apart, ship the **equality fix first** — it is inert on a
bag, and it is the half that is dangerous to be missing.

**⚠️ Using a mutable field as the business key.**
A business key works only if it is immutable for the entity's whole life. An
email address, a SKU, a display name — all get edited, and editing one while the
entity sits in a `HashSet` reproduces consequence 3 exactly, without a `persist`
anywhere in sight.

**⚠️ Believing a constant `hashCode()` is a hack.**
It is a legitimate implementation for entities: correct under the
`equals`/`hashCode` contract (which requires equal objects to have equal hashes
and says nothing about unequal ones), stable across identifier assignment, and it
costs a linear scan *within one entity's collection*. What would be a hack is a
hash that is fast and changes.

**⚠️ Forgetting the bidirectional helper methods.**
`addLine`/`removeLine` usually wrap `add` and `remove`. On a `Set`, `remove` is
hash-based, so a broken `hashCode` breaks *removal*, not only lookup — and if the
association has `orphanRemoval`, the child that was never removed from the
collection is never deleted either. See
[topic 07 chunk 02c](../07-relationships-fetch/02c-keeping-both-sides-in-step.md).

**⚠️ Reaching for `SortedSet` to get ordering and inheriting a comparator
contract.**
A `SortedSet` decides membership with `compareTo` or a `Comparator`, not with
`equals`. A comparator returning `0` for two distinct rows **removes one of
them**, exactly as a colliding `equals` would — with the extra trap that the
comparator and `equals` can disagree, which the `SortedSet` specification calls
being "inconsistent with equals" and which produces behaviour no reader of the
mapping will predict.

**⚠️ Migrating an existing table without first asking whether the duplicates are
real.**
Before shipping `Set`, ask the database whether the rows it would collapse
actually exist:

```sql
SELECT order_id, product_id, price, COUNT(*)
FROM   order_line
GROUP  BY order_id, product_id, price
HAVING COUNT(*) > 1;
```

An empty result means the collapse is inert *today*, which is a fact with a
shelf-life. A non-empty result means you have just found the data your change
would eat.

**⚠️ Assuming `@ElementCollection` is exempt.**
The same bag / set / indexed-list semantics apply to element collections of
embeddables and basics, and the equality deciding collapse there is the
**embeddable's** — usually generated over all its fields, and therefore
collapsing genuine duplicates aggressively, with no identifier available to fix
it. See
[topic 07 chunk 11](../07-relationships-fetch/11-element-collection.md).

**⚠️ `equals` that is correct but `hashCode` that is not, or vice versa.**
A `Set` exercises both, in that order. An `equals` on the identifier paired with
a Lombok-generated `hashCode` over all fields is the worst combination available:
the hash dereferences proxies *and* two equal entities can hash differently, so
the set holds both.

**⚠️ Testing the change with a fixture of two obviously different children.**
That fixture cannot fail. The test that means something loads a parent whose
children duplicate on the business fields, and asserts the size. If you cannot
construct such a fixture from the domain, that is the argument that the `Set` is
safe — make it explicitly, in a comment, rather than by omission.

## Interview questions

**★ Why does changing a collection to `Set` sometimes create an N+1 that was not
there before?**
Because a set is hash-based, so `hashCode()` runs on every element as the
collection is built, and if `hashCode()` reads an association it dereferences a
lazy proxy per element. The bag never asked for a hash, so the same `hashCode()`
was harmless. This is the most common way the fix makes things worse, and it is
invisible to the check most people run afterwards — the exception is gone, so the
fix "worked".

**★ What is the relationship between `equals` and data loss here?**
In a `Set`, `equals` decides what exists. Two rows that compare equal become one
object; if the collection is later written back, or the association has
`orphanRemoval`, the row that vanished on read is deleted for real. So an
`equals` written with value semantics — "same product, same price" — silently
becomes a deletion policy the moment the collection type changes. Entity equality
should mean "the same row", which means the identifier.

**★ Explain the `hashCode` instability problem with generated identifiers.**
A `HashSet` buckets an element by the hash it had at insertion time. An entity
added to a collection before `persist` has a `null` id; the flush assigns one; if
`hashCode()` reads the id, the hash changes, the element is in the wrong bucket,
and `contains()` and `remove()` fail to find it. Nothing throws — the collection
is simply wrong. The resolutions are an immutable business key or a constant
`hashCode()` for the class.

**★ Someone says a constant `hashCode()` is obviously bad. What do you say?**
That it is bad for a `HashMap` of a million entities and irrelevant for a
collection of an order's twenty lines. The contract requires equal objects to
have equal hashes; it says nothing about unequal objects having different ones. A
constant satisfies the contract, is stable across identifier assignment, and
turns hash lookups within one small collection into a linear scan of that
collection. The alternative — a hash that changes when the object is persisted —
breaks the *usage* contract of `HashSet` and produces silent corruption, which is
the much worse defect.

**★ Why does `SortedSet` not solve the equality problem?**
Because it replaces one membership rule with another. A `SortedSet` decides
whether two elements are the same by asking the comparator whether it returns
zero, not by asking `equals`. So a comparator over a business field collapses
distinct rows in exactly the way a loose `equals` does, and — because the two can
disagree — you can reach a state where the set contains an element that `equals`
says is already there, or excludes one it says is not. The specification's phrase
for this is "inconsistent with equals", and it is a correctness hazard, not a
style note.

**★ How would you roll this change out safely on an existing system?**
Fix `equals` and `hashCode` first and ship that alone — it is inert on a bag.
Then query the table for the duplicate groups the `Set` would collapse; a
non-empty result is a stop sign, not a merge conflict. Then change the type,
audit the call sites the compiler flags, and check the ones it cannot — see
[8e4](08e4-ordering-and-the-call-sites.md). Finally, confirm the fetching fix
with statement and row counts rather than with the absence of the exception, per
[chunk 6b](06b-asserting-the-count-in-a-test.md).

**★ Which collection semantic would you default to for a new `@OneToMany`?**
`Set` with identifier-based equality, because that is the semantic most
`@OneToMany` associations actually have — a row belongs to its parent once — and
because choosing it forces the `equals` question at design time rather than at
incident time. The case for a plain bag is a genuinely append-only log of rows
where duplicates are meaningful and nothing ever removes by identity.

**★ Why is any of this in a chapter about N+1?**
Because it is the cost of the most popular N+1 fix, paid by people who did not
know they were buying it. `MultipleBagFetchException` sends a developer to a
search engine, the top answer says "change one to a `Set`", and the change is one
word in one file. Everything above is what that word does. The general lesson is
part 3's lesson: a fetching problem should get a fetching fix, and a change to
the domain model should happen because the domain changed.

---

← Prev: [8e2 · The three ways out](08e2-the-three-ways-out.md) · Index: [08 · The N+1 problem](README.md) · Next → [8e4 · Ordering and the call sites](08e4-ordering-and-the-call-sites.md)
