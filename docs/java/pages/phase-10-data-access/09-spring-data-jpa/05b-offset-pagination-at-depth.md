---
title: "OFFSET makes the server compute and discard every row it skips, so page 5,000 costs five thousand pages of work — and on a table that is being written to, the page boundaries move under the reader as well"
sidebar_label: "05b · Offset pagination at depth"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 documentation, "LIMIT and OFFSET"
> ([queries-limit](https://www.postgresql.org/docs/18/queries-limit.html));
> the Spring Data JPA 4.1 reference — "Defining Query Methods" (the "Consuming
> Large Query Results" table)
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html))
> and "JPA Query Methods", section "Scrolling Large Query Results"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Offset pagination has a cost that nobody sees in development, because the cost
is proportional to the page number and development never leaves page one. The
database cannot jump to row 100,000; it produces the first 100,000 rows in order
and throws them away. PostgreSQL says so directly, and Spring Data's own table
repeats the warning for every offset-based return type it offers. The fix is not
a faster query — it is a different question, and that is
[05b2 · keyset filtering](05b2-keyset-filtering-and-scrolling.md).**

## What `OFFSET` actually does

> "The rows skipped by an `OFFSET` clause still have to be computed inside the
> server; therefore a large `OFFSET` might be inefficient."

That is the whole mechanism. `limit 20 offset 100000` reads and orders 100,020
rows and returns twenty. Page one is instant, page five hundred is noticeable,
page five thousand is a timeout — and the same page number gets slower every
month as the table grows, so a query that was fine at launch degrades without
anyone changing it.

Spring Data's comparison table attaches the same warning to `Slice`, to `Page`
and to the offset-based `Window`:

> "Offset-based queries becomes inefficient when the offset is too large because
> the database still has to materialize the full result."

⚠️ **Note what is *not* the problem.** It is not the `limit`, not the number of
rows returned, and not the count query — a `Slice` has no count query and has this
problem in full. It is the skip, and only the skip.

## The second, quieter problem: the page boundary moves

PostgreSQL also warns about the ordering itself:

> "When using `LIMIT`, it is important to use an `ORDER BY` clause that constrains
> the result rows into a unique order. Otherwise you will get an unpredictable
> subset of the query's rows."

Even with a stable order, offset pagination over a table that is being written to
is inconsistent by construction: insert a row that sorts before the current page
and every subsequent page shifts by one, so the reader sees a record twice. Delete
one and a record is skipped entirely. Both are invisible in testing and both are
routine in production — this is why exports built on offset pages quietly lose
rows.

## Gotchas

**⚠️ Testing pagination on a table with a thousand rows.**
Every page is fast, so nothing is learned. Offset cost is invisible until the
offset is large, which means the defect ships and appears months later as "the
export is timing out".

**⚠️ Believing `Slice` fixes the offset problem.**
It removes the count query, not the skip. The reference attaches the same
"inefficient when the offset is too large" warning to `Slice`, to `Page` and to
offset-based `Window`.

**⚠️ Blaming the page size.**
Fetching twenty rows is never the problem; producing and discarding the hundred
thousand before them is. Halving the page size does not halve the cost of page
five thousand — it doubles the number of requests that each pay it.

**⚠️ Paging without a unique order.**
PostgreSQL warns that `LIMIT` without an order constraining rows into a unique
order returns "an unpredictable subset". Two requests for the same page can
legitimately differ, and adding a primary-key tiebreaker is the fix.

**⚠️ Exporting a table by walking offset pages.**
Concurrent inserts and deletes shift the window, so rows are duplicated or
missed. An export needs a keyset walk, a snapshot transaction, or both.

**⚠️ Assuming a slow deep page is a missing index.**
An index helps — a fully indexed sort turns the skip into an index-only scan —
but it does not change the shape of the cost. The work still grows with the
offset, so indexing buys you a constant factor, not the problem going away.

**⚠️ Keeping the total on a deep-paged screen "because the UI already has it".**
The count is over the entire matching set and is recomputed per request. If the
screen genuinely needs a number, consider an approximate or cached count rather
than an exact one on every page view.

**⚠️ Letting the page number come straight from a URL with no cap.**
`?page=999999` is a request to compute and discard twenty million rows. It is a
denial-of-service parameter with a friendly name, and it does not need
authentication to be expensive.

**⚠️ Measuring page one in a load test.**
A benchmark that always requests the first page measures the one case that has no
offset. If the test harness picks page numbers uniformly, or not at all, it is
not testing pagination.

**⚠️ Treating the instability as a rare race.**
It is not a race — it is the ordinary behaviour of a moving result set. Any table
with regular inserts produces duplicated and skipped rows across offset pages,
reliably, for every reader who is paging while writes are happening.

## Interview questions

**★ Why is `OFFSET 100000` slow?**
Because the server still has to compute the rows it skips. PostgreSQL's
documentation says exactly that: the skipped rows still have to be computed
inside the server, so a large offset might be inefficient. Cost grows with the
page number, not the page size.

**★ Does returning a `Slice` fix it?**
No. `Slice` removes the count query, which is a different cost. The offset skip is
unchanged, and Spring Data's own table attaches the "inefficient at large offset"
warning to `Slice` as well as to `Page`.

**★ Would an index fix it?**
It improves it and does not solve it. A covering index over the sort columns lets
the database skip within the index instead of the heap, which is much cheaper —
but the work is still proportional to the offset, so page five thousand is still
five thousand pages of work.

**★ What is wrong with offset paging over a table that is being written to?**
The page boundaries move. An insert before the current page pushes a row into the
next page, so the reader sees it twice; a delete pulls one back and it is never
seen. Neither is a race condition — it is what offsets mean on a changing result.

**★ Why does nobody notice this in development?**
Because development never leaves page one, and the test data is small enough that
even page five hundred is fast. The cost is proportional to the offset and to the
table size, and both are small everywhere except production.

**★ What is the worst-performing common combination in this area?**
`Page` with a large offset: a count over the whole matching set plus an offset
scan, per request, on a query nobody has indexed for. Removing the total is
usually the cheapest improvement available, and it is a one-word change.

**★ How would you detect this in an existing application?**
Look for endpoints that accept a page parameter with no upper bound, and check the
distribution of page numbers actually requested. Then look at the queries with the
largest execution time and see whether their offsets correlate with it — that
correlation is the signature.

**★ Is the fix always keyset pagination?**
No. Capping the depth and requiring a filter is often better, because a user on
page 400 is usually a user who needed a search box. Keyset is the fix when the
deep traversal is real — an export, a feed, a sync job — rather than a user
scrolling.

{/* FOOTER */}
