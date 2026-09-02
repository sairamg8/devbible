---
title: "citext became a collation on one index, and a collation is the only index property in this app that a query can silently fail to opt into"
sidebar_label: "6 · Collation"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Collation](https://www.mongodb.com/docs/manual/reference/collation/)
> (*"To use an index that specifies a collation, query and sort operations must
> specify the same collation as the index"*; the collation document fields and
> the meaning of `strength`),
> [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/),
> [`aggregate`](https://www.mongodb.com/docs/manual/reference/command/aggregate/)
> (*"You cannot specify multiple collations for an operation"*).
> Counterpart:
> [01·08 — constraints that vanish](../01-modeling-the-store/06-constraints-that-vanish.md),
> which made this decision; this chunk is the index consequence.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1 stored `users.email` as `citext`, so `UNIQUE` was case-insensitive
because the *type* was. MongoDB has no such type; the case-insensitivity lives on
the index as a collation, and that relocation has one consequence worth an entire
chunk: **an index with a collation is only used by an operation that names the
same collation.** Every other index property in this app is opted *out* of by
mistake — you forget a partial predicate and lose the index. This one is opted
*in* to, and forgetting it produces a query that is not merely slow but returns
different results.**

## The index

```js
const EMAIL_COLLATION = {locale: 'en', strength: 2};

await db.collection('users').createIndex(
  {email: 1}, {unique: true, collation: EMAIL_COLLATION});
```

`strength: 2` is the level at which case is ignored but accents are not — so
`Ada@example.com` and `ada@example.com` collide, and `adá@example.com` does not.
That is the behaviour `citext` had, and it is the right level for an email
address: an address differing only in case is the same mailbox, and one differing
by an accent is not.

The collation document's other fields (`caseLevel`, `caseFirst`,
`numericOrdering`, `alternate`, `backwards`) all default sensibly for this use;
`locale` is the only mandatory one.

## The rule that makes it dangerous

> *"To use an index that specifies a collation, query and sort operations must
> specify the same collation as the index."*
> — [Collation](https://www.mongodb.com/docs/manual/reference/collation/)

So this:

```js
// WRONG — does not use the index, and does not match case-variantly
await users.findOne({email});
```

does not error. It performs a **collection scan** using the default binary
comparison, and because the comparison is binary, a user who registered as
`Ada@example.com` cannot log in by typing `ada@example.com`.

The correct call names the collation:

```js
export const findUserByEmail = (db, email) =>
  db.collection('users').findOne({email}, {collation: EMAIL_COLLATION});
```

Two failures in one omission, and they present differently. The performance
failure is invisible until the collection is large. The **correctness** failure is
immediate — and it is invisible in a test suite whose fixtures are all lowercase,
which is every test suite until someone writes the one that is not.

## Why the constraint is still enforced

A reasonable worry: if a query must opt into the collation, does the *uniqueness*
also need opting in?

No. **The unique constraint is enforced by the index, using the index's
collation, on every write.** A second registration as `ADA@example.com` is
rejected with a duplicate-key error whether or not the inserting code knows the
collation exists. The write path cannot opt out.

So the split is clean and worth stating: **the constraint is safe; the lookup is
not.** Phase 1's `citext` protected both, because the type applied everywhere the
column was used. Moving the behaviour to the index protects the write and leaves
the read to remember.

## The one operation, one collation rule

The Manual, on the `aggregate` command's `collation` field:

> *"You cannot specify multiple collations for an operation. For example, you
> cannot specify different collations per field, or if performing a find with a
> sort, you cannot use one collation for the find and another for the sort."*

That is a real constraint for a pipeline that matches on email *and* sorts on
something case-sensitive: both get the same collation or neither does. In this
app it never bites, because the only collated field is `email` and the only query
that touches it is a single-field lookup. It is worth knowing before designing an
admin user-search screen that filters by email and sorts by name.

The related fact: a collation can also be set as a **collection** default at
`createCollection` time, which then applies to every operation and index on it
unless overridden. This app does not use that, deliberately — a collection-wide
default makes the behaviour ambient, and ambient behaviour is what the next
section argues against.

## The alternative, which this app takes

[Chapter 01·08](../01-modeling-the-store/06-constraints-that-vanish.md) already
made the call and it is worth repeating here with the index reasoning attached:

```js
// normalise on write; the index needs no collation at all
const emailKey = email.trim().toLowerCase();
await users.insertOne({email, emailKey, /* … */});
await users.createIndex({emailKey: 1}, {unique: true});
```

Store the address as the user typed it (`email`, for display and for sending) and
a normalised key beside it (`emailKey`, for uniqueness and lookup). The index
carries no collation, every query is an ordinary binary equality, and **there is
nothing to forget.**

The trade, stated honestly:

| | Collation on the index | Normalised key |
|---|---|---|
| Uniqueness enforced by | the index | the index |
| Lookup correctness | depends on every caller remembering | structural |
| Extra field | no | yes, one |
| Normalisation rule lives | in the collation spec | in application code |
| Unicode subtleties | handled by ICU | handled by `toLowerCase()`, which is not the same thing |

That last row is the argument *for* collation and it is not trivial: ICU's
case-folding is genuinely more correct than JavaScript's `toLowerCase()` for
non-ASCII scripts. For email addresses — which are ASCII in the local part in
practice, and whose domain part is already normalised by the registrar — the
difference does not arise. For a username in an application that accepts Turkish
or Greek, it would, and the collation becomes the better answer.

**This app normalises**, because a forgettable option that changes results is a
worse failure mode than a redundant field.

## Gotchas

**★ A query that omits the collation does not use the collated index and does not
compare case-insensitively.** Two failures, one omission. The performance one
hides until the collection grows; the correctness one is immediate and invisible
under all-lowercase fixtures.

**★ The unique constraint is still enforced without the caller knowing.** Writes
cannot opt out of the index's collation, so duplicates are rejected correctly even
from code that never mentions collation. This asymmetry is exactly what makes the
read-side omission survive: nothing breaks loudly enough to find it.

**★ `strength: 2` ignores case but not accents; `strength: 1` ignores both.** The
levels are ICU's and they are not a scale of "how fuzzy" — they are which
differences are considered. Choosing 1 for an email address would make
`adá@example.com` and `ada@example.com` the same mailbox, which is wrong.

**★ One operation gets one collation.** A `find` cannot use one collation for the
filter and another for the sort, and an aggregation cannot vary it per stage.
Designing a screen that filters on a collated field and sorts on a
case-sensitive one means picking one behaviour for both.

**★ A collection-level default collation applies to indexes created on it.** If
someone sets one at `createCollection` time, every subsequent index inherits it
unless it overrides — so an index that looks plain in the migration may not be.
This app sets none, which means an index's collation is always visible where the
index is declared.

**★ `getIndexes()` shows the collation, and two indexes differing only by
collation are two indexes.** They are separately maintained and separately
chosen. Since MongoDB 7.3 you also cannot create *equivalent* partial indexes
that differ only by collation-sensitive case in the filter expression.

**★ `toLowerCase()` is not Unicode case-folding.** The normalised-key approach
trades ICU correctness for structural safety, and for email that trade is free.
For a field that accepts arbitrary scripts — the Turkish dotless ı being the
standard example — it is not free, and the collation becomes the better tool.

**★ Adding a collation to an existing index is a drop-and-recreate.**
`createIndex` will not update options in place
([chunk 3](02b-what-the-list-leaves-out.md)), so switching from binary to
collated uniqueness means dropping the constraint, and the data may not satisfy
the new one — two rows differing only in case are legal under the old index and
illegal under the new. Check before dropping.

## Interview questions

**★ Phase 1 used `citext`. What replaced it, and what changed about *where* the
behaviour lives?**
A unique index on `email` with `collation: {locale: 'en', strength: 2}`. The
behaviour moved from the **type** to the **index**, and that relocation is the
whole difference: a type applies wherever the column is used, whereas an index's
collation applies to writes automatically but only to reads that name the same
collation. So the uniqueness guarantee is unchanged and the lookup guarantee
became conditional on every caller remembering an option.

**★ What exactly goes wrong when a login query forgets the collation?**
Two things. It cannot use the collated index, so it scans the collection — which
is a performance problem that hides until `users` is large. And it compares
binary, so a user who registered as `Ada@example.com` cannot log in as
`ada@example.com` — which is a correctness problem that is immediate but invisible
under fixtures that are all lowercase. Neither raises an error, which is why the
bug reaches production.

**★ If the query has to opt in, is the uniqueness constraint still safe?**
Yes. The constraint is enforced by the index, with the index's collation, on every
write; the write path has no way to opt out. A second registration differing only
in case is rejected with a duplicate-key error regardless of what the inserting
code knows. That asymmetry — safe writes, forgettable reads — is precisely what
lets the read-side bug survive code review.

**★ Why does this app normalise on write instead of relying on the collation?**
Because the failure mode of the collation is a forgotten option that silently
changes results, and the failure mode of normalisation is a redundant field. One
of those is a bug you find in an incident, the other is a line in a document. The
cost is that `toLowerCase()` is not full Unicode case-folding, which is a real
loss for arbitrary text and a non-issue for email addresses. If the field were a
username accepting any script, the trade would go the other way.

**★ Could you set the collation on the collection instead of the index?**
Yes — `createCollection` takes a default collation that applies to every
operation and every index on that collection unless overridden. It removes the
forgetting problem for reads, and it introduces a worse one: the behaviour becomes
ambient. An index declared in a migration no longer says what it does, a query
reading the code no longer says how it compares, and the only place the truth
lives is a collection option nobody looks at. This app declines it for the same
reason it declines an implicit serialiser conversion — the behaviour should be
visible where it is used.

---

← Prev: [Partial indexes](03b-partial-indexes.md) ·
Next → [The TTL index](05-the-ttl-index.md)
