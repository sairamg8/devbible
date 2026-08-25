---
title: "08 · The N+1 problem"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: see each chunk's own `> Verified:` line.

**The single most common Java performance bug in the wild: seeing it in the SQL log, and every fix for it with its real cost.**

:::caution Topic in progress — 23 of ~42 chunks written
**Part 1 (the problem) and Part 2 (seeing it) are complete**, and Part 3 (the fixes)
is written as far as `JOIN FETCH` and its three failure modes. ⚠️ The last chunk,
**8e2 · The three ways out**, is missing its Gotchas and Interview questions sections.
Outstanding: `@EntityGraph`, `@BatchSize`, subselect, projections, choosing a fix,
what is not a fix, and prevention. Forward references to those appear as bold plain
text rather than links.
:::

<!--CHUNKS-->

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · 101 queries](01-one-hundred-and-one-queries.md)** | You asked for one hundred orders and got one hundred and one queries — and every single one of them was fast |
| 2 | **[1b · The general rule](01b-the-general-rule.md)** | State it generally and the fix becomes obvious: decide what the unit of work needs before you start navigating, not one parent at a time |
| 3 | **[2 · Why nobody sees it](02-why-nobody-sees-it.md)** | Every query is fast, every query is correct, the code passes review — which is exactly why this bug reaches production |
| 4 | **[3 · Why production is worse](03-why-production-is-worse.md)** | The same hundred queries that cost nothing on your laptop cost a connection, a thread and a round trip each in production |
| 5 | **[4 · The shapes it hides in](04-the-shapes-it-hides-in.md)** | The loop is the textbook case and it is the one you will almost never meet — here are the shapes N+1 actually arrives in |
| 6 | **[4b · Three more shapes](04b-three-more-shapes.md)** | Nested walks multiply rather than add, writes have their own N+1, and the best-disguised case is a perfectly good query called once per element |
| 7 | **[4c · Serialisation and logging](04c-serialization-and-logging.md)** | Nobody wrote the loop: a Jackson serialiser and a log line will both walk your entity graph and issue a query per node |
| 8 | **[4d · The ones you cannot make lazy](04d-the-ones-you-cannot-make-lazy.md)** | Some associations issue a query per row no matter what you annotate them, and the bidirectional one-to-one is the one that will catch you |
| 9 | **[4e · Lazy columns and hashCode](04e-lazy-columns-and-hashcode.md)** | A lazy column is not a proxy and needs the bytecode rewritten, and an entity whose hashCode reads an association re-creates N+1 after your fetch join worked |
| 10 | **[5 · Turning the SQL on](05-turning-the-sql-on.md)** | There are three ways to see the SQL Hibernate emits, they are not interchangeable, and the one everybody uses is the one that writes to System.out |
| 11 | **[5b · Why show-sql is not it](05b-show-sql-is-not-the-answer.md)** | show-sql writes past your logging configuration to standard output, and that single fact disqualifies it from every job except looking at a test |
| 12 | **[6 · Count, do not read](06-count-do-not-read.md)** | Stop reading the SQL log and start counting it — Hibernate keeps the numbers for you, and two of them name the bug directly |
| 13 | **[6b · Asserting the count](06b-asserting-the-count-in-a-test.md)** | Write the assertion that fails the build when someone reintroduces it — this is the single highest-value thing in the whole topic |
| 14 | **[6c · Making it reusable](06c-making-it-reusable.md)** | Wrap the counting in one component and a custom assertion, and put the tests only where N is unbounded — that is what makes the practice survive |
| 15 | **[6d · Proxies and agents](06d-proxies-and-agents.md)** | Count one layer lower and you see every statement, not just Hibernate's — datasource-proxy and p6spy exist for exactly this |
| 16 | **[7 · From a count to a call site](07-from-a-count-to-a-call-site.md)** | The counter says 341 statements — now find the line of Java that caused them, which the log will not tell you |
| 17 | **[8 · join fetch](08-join-fetch.md)** | join fetch is the fix Hibernate calls the truly correct one — it makes the count 1, and it cannot be lazy, which is the whole trade |
| 18 | **[8b · What it breaks](08b-what-a-fetch-join-breaks.md)** | The three things a fetch join breaks, and the one rule that tells you in advance which queries are safe |
| 19 | **[8c · Duplicates and distinct](08c-duplicate-parents-and-distinct.md)** | Since Hibernate 6 you must NOT write distinct to remove duplicate parents — Hibernate does it for you, and the keyword now only costs you a DISTINCT in SQL |
| 20 | **[8d · Pagination](08d-pagination.md)** | Hibernate 7.4 fixed pagination with a collection fetch join, and every article you will find on this is now wrong |
| 21 | **[8e · MultipleBagFetchException](08e-multiplebagfetchexception.md)** | cannot simultaneously fetch multiple bags — the exception is Hibernate refusing to give you a wrong answer, and changing List to Set is only one of two honest fixes |
| 22 | **[8d2 · Paginating before 7.4](08d2-paginating-on-older-versions.md)** | Below 7.4 you page the ids first and fetch the graph second — and the forgotten order by in step two is the bug everyone writes |
| 23 | **[8e2 · The three ways out](08e2-the-three-ways-out.md)** | Set, subselect, or stop loading the graph — three fixes with very different costs, and the popular one optimises the wrong metric |
