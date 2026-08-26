---
title: "08 · The N+1 problem"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: see each chunk's own `> Verified:` line.

**The single most common Java performance bug in the wild: seeing it in the SQL log, and every fix for it with its real cost.**

:::tip Complete — 61 chunks
Five parts. **The problem** (what N+1 is, why nobody sees it, why production is worse,
every shape it hides in). **Seeing it** (turning the SQL on, counting statements rather
than reading logs, getting from a count to a call site). **The fixes** — `join fetch`
and everything it breaks, entity graphs in all four spellings, `@BatchSize`, subselect
fetching, projections and DTOs, fetch profiles and bytecode enhancement — then
**choosing** between them, worked through three real services. **What is not a fix**
(open-session-in-view, `EAGER`, `Hibernate.initialize` loops, the second-level cache).
And **prevention**: fetching is a property of the call site, not of the mapping.
:::

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · 101 queries](01-one-hundred-and-one-queries.md)** | You asked for one hundred orders and got one hundred and one queries — and every single one of them was fast |
| 2 | **[1b · The general rule](01b-the-general-rule.md)** | State it generally and the fix becomes obvious: decide what the unit of work needs before you start navigating, not one parent … |
| 3 | **[2 · Why nobody sees it](02-why-nobody-sees-it.md)** | Every query is fast, every query is correct, the code passes review — which is exactly why this bug reaches production |
| 4 | **[3 · Why production is worse](03-why-production-is-worse.md)** | The same hundred queries that cost nothing on your laptop cost a connection, a thread and a round trip each in production |
| 5 | **[4 · The shapes it hides in](04-the-shapes-it-hides-in.md)** | The loop is the textbook case and it is the one you will almost never meet — here are the shapes N+1 actually arrives in |
| 6 | **[4b · Three more shapes](04b-three-more-shapes.md)** | Nested walks multiply rather than add, writes have their own N+1, and the best-disguised case is a perfectly good query called … |
| 7 | **[4c · Serialisation and logging](04c-serialization-and-logging.md)** | Nobody wrote the loop: a Jackson serialiser and a log line will both walk your entity graph and issue a query per node |
| 8 | **[4d · The ones you cannot make lazy](04d-the-ones-you-cannot-make-lazy.md)** | Some associations issue a query per row no matter what you annotate them, and the bidirectional one-to-one is the one that will… |
| 9 | **[4e · Lazy columns and hashCode](04e-lazy-columns-and-hashcode.md)** | A lazy column is not a proxy and needs the bytecode rewritten, and an entity whose hashCode reads an association re-creates N+1… |
| 10 | **[5 · Turning the SQL on](05-turning-the-sql-on.md)** | There are three ways to see the SQL Hibernate emits, they are not interchangeable, and the one everybody uses is the one that w… |
| 11 | **[5b · Why show-sql is not it](05b-show-sql-is-not-the-answer.md)** | show-sql writes past your logging configuration to standard output, and that single fact disqualifies it from every job except … |
| 12 | **[6 · Count, do not read](06-count-do-not-read.md)** | Stop reading the SQL log and start counting it — Hibernate keeps the numbers for you, and two of them name the bug directly |
| 13 | **[6b · Asserting the count](06b-asserting-the-count-in-a-test.md)** | Write the assertion that fails the build when someone reintroduces it — this is the single highest-value thing in the whole topic |
| 14 | **[6c · Making it reusable](06c-making-it-reusable.md)** | Wrap the counting in one component and a custom assertion, and put the tests only where N is unbounded — that is what makes the… |
| 15 | **[6d · Proxies and agents](06d-proxies-and-agents.md)** | Count one layer lower and you see every statement, not just Hibernate's — datasource-proxy and p6spy exist for exactly this |
| 16 | **[7 · From a count to a call site](07-from-a-count-to-a-call-site.md)** | The counter says 341 statements — now find the line of Java that caused them, which the log will not tell you |
| 17 | **[8 · join fetch](08-join-fetch.md)** | join fetch is the fix Hibernate calls the truly correct one — it makes the count 1, and it cannot be lazy, which is the whole t… |
| 18 | **[8b · What it breaks](08b-what-a-fetch-join-breaks.md)** | The three things a fetch join breaks, and the one rule that tells you in advance which queries are safe |
| 19 | **[8c · Duplicates and distinct](08c-duplicate-parents-and-distinct.md)** | Since Hibernate 6 you must NOT write distinct to remove duplicate parents — Hibernate does it for you, and the keyword now only… |
| 20 | **[8d · Pagination](08d-pagination.md)** | Hibernate 7.4 fixed pagination with a collection fetch join, and every article you will find on this is now wrong |
| 21 | **[8d2 · Paginating before 7.4](08d2-paginating-on-older-versions.md)** | Below 7.4 you page the ids first and fetch the graph second — and the forgotten order by in step two is the bug everyone writes |
| 22 | **[8e · MultipleBagFetchException](08e-multiplebagfetchexception.md)** | cannot simultaneously fetch multiple bags — the exception is Hibernate refusing to give you a wrong answer, and changing List t… |
| 23 | **[8e2 · The three ways out](08e2-the-three-ways-out.md)** | Set, subselect, or stop loading the graph — three fixes with very different costs, and the popular one optimises the wrong metric |
| 24 | **[8e3 · What Set costs the model](08e3-what-set-costs-the-model.md)** | Changing a collection from List to Set hands equality the power to decide what exists, and hashCode the power to issue queries |
| 25 | **[8e4 · Ordering and the call sites](08e4-ordering-and-the-call-sites.md)** | A bag's order was never guaranteed, so the Set fix does not remove ordering — it removes the illusion of it, and the code that … |
| 26 | **[9 · Entity graphs](09-entity-graph.md)** | An entity graph is a fetch plan expressed as data, and it is the first fix in this part that does not change the mapping |
| 27 | **[9b · Building and applying](09b-applying-a-graph.md)** | Building a graph is three lines; applying it has three mechanisms, two of which fail silently when you get them wrong |
| 28 | **[9c · Named entity graphs](09c-named-entity-graphs.md)** | A named entity graph moves the fetch plan onto the entity, which buys reuse and costs the ability to see which endpoint the pla… |
| 29 | **[9d · Hibernate's graph syntax](09d-hibernates-graph-syntax.md)** | Hibernate parses a fetch plan from a string, which turns fourteen lines of annotation into one and makes runtime-assembled plan… |
| 30 | **[9e · Subgraphs](09e-subgraphs.md)** | A subgraph is how a fetch plan gets a second level, and Jakarta Persistence 3.2 quietly renamed half the API for building one |
| 31 | **[9e2 · How deep to go](09e2-how-deep-a-graph-should-go.md)** | Depth along to-ones is nearly free and breadth across collections is not, so the number of plural nodes at one level predicts a… |
| 32 | **[9f · fetchgraph vs loadgraph](09f-fetchgraph-vs-loadgraph.md)** | The difference between fetchgraph and loadgraph is what happens to attributes you did not list, and the specification permits t… |
| 33 | **[9g · Spring Data @EntityGraph](09g-spring-data-entitygraph.md)** | Spring Data's @EntityGraph puts the fetch plan on the repository method, which is the only placement that keeps the query and i… |
| 34 | **[9h · A graph is still a join](09h-a-graph-is-still-a-join.md)** | An entity graph is a notation for joins, so every failure mode of the fetch join arrives with it — including two the documentat… |
| 35 | **[10 · @BatchSize](10-batch-size.md)** | Batch fetching does not remove the extra queries — it divides them, turning N statements into N over k, and that is a different… |
| 36 | **[10b · What the SQL looks like](10b-what-the-sql-looks-like.md)** | On PostgreSQL a batch is one array parameter, not a variable-length IN list — which quietly retires the most-repeated piece of … |
| 37 | **[10c · Choosing a batch size](10c-choosing-a-batch-size.md)** | Batch size bounds owners and not rows, so the number to reason about is k times the fan-out, and the returns from raising k fal… |
| 38 | **[11 · @Fetch(SUBSELECT)](11-subselect.md)** | Subselect fetching gets every collection in one extra statement by re-running the query that found the owners, which is either … |
| 39 | **[11b · The subselect trap](11b-the-trap.md)** | Subselect fetching pays for the driving query twice and, on PostgreSQL's default isolation level, the two executions can see di… |
| 40 | **[12 · Projections and DTOs](12-projections-and-dtos.md)** | A projection fixes N+1 by never creating the object graph that could have one, which is why it is the only fix on this list tha… |
| 41 | **[12b · Projecting a collection](12b-projecting-a-collection.md)** | A constructor expression consumes one flat row, so a DTO with a nested list needs either two queries or a grouping step — and b… |
| 42 | **[12c · Spring Data projections](12c-spring-data-projections.md)** | Spring Data will narrow the query for a closed interface projection and will not for an open one, and that single sentence deci… |
| 43 | **[12c2 · DTO projections in Spring Data](12c2-dto-projections-in-spring-data.md)** | Spring Data will write the constructor expression for you when the return type is a DTO, and back off silently the moment you w… |
| 44 | **[12d · The entity was never the model](12d-the-entity-was-never-the-model.md)** | Most endpoints that hit N+1 were never loading an aggregate — they were assembling a document out of a change-tracking mechanis… |
| 45 | **[13 · Fetch profiles](13-fetch-profiles.md)** | A fetch profile is a named fetch plan that lives on the mapping and is switched on per session — the one fix that can ask for s… |
| 46 | **[13b · Enabling a profile](13b-enabling-and-the-default-profile.md)** | Enabling a profile is a session-wide switch with three spellings, an entity graph beats it when both apply, and there is a buil… |
| 47 | **[13c · Bytecode enhancement](13c-bytecode-enhancement.md)** | Bytecode enhancement is the fix for the N+1 you cannot annotate your way out of — and the only Hibernate feature whose off stat… |
| 48 | **[13d · Lazy groups and the cost](13d-lazy-groups.md)** | By default every lazy column in an entity loads together, which turns one lazy field into a fetch of all of them — @LazyGroup i… |
| 49 | **[14 · Choosing a fix](14-choosing-a-fix.md)** | Every fix in this topic is correct somewhere and wrong somewhere else — choosing between them is a decision procedure keyed on … |
| 50 | **[14b · Worked: the list page](14b-the-list-page.md)** | Service one: the order list page, where the right fix is to stop loading entities — and every fetch plan you could have applied… |
| 51 | **[14c · Worked: the report](14c-the-report.md)** | Service two: the settlement report, where the parents are unbounded and there are two collections — the case that eliminates ev… |
| 52 | **[14d · Worked: the detail view](14d-the-detail-view.md)** | Service three: the order detail view, where N is one and almost everything works — which is why this is the case that teaches y… |
| 53 | **[15 · Open session in view](15-open-in-view.md)** | Open session in view is on by default in Spring Boot, and it is not a fix — it is the mechanism that makes every N+1 in this to… |
| 54 | **[15b · What it costs](15b-what-open-in-view-costs.md)** | What open session in view costs: queries outside the transaction, a response that can be internally inconsistent, writes with n… |
| 55 | **[15c · Turning it off](15c-turning-it-off.md)** | Turning open session in view off: the seven things that break, why each one was already a bug, and the fix for each that is not… |
| 56 | **[16 · EAGER is not a fix](16-eager-is-not-a-fix.md)** | EAGER is the one fetch decision that cannot be overridden downward — it makes the fetch unconditional at every call site, and i… |
| 57 | **[17 · Initialize loops](17-initialize-loops.md)** | A Hibernate.initialize loop is the N+1 written out by hand and given a reassuring name — but the class it comes from also holds… |
| 58 | **[17b · The second-level cache](17b-the-second-level-cache.md)** | The second-level cache can genuinely collapse the N queries, and it is still not the fix — because it needs three separate opt-… |
| 59 | **[18 · Fetching belongs to the call site](18-fetching-belongs-to-the-call-site.md)** | The mapping's job is to describe the relationship and default to lazy; deciding what to fetch is the query's job — get that bou… |
| 60 | **[19 · The review checklist](19-the-checklist.md)** | Reviewing a diff for N+1 before it ships — the eleven things to look at, in the order they appear in a pull request, and the tw… |
| 61 | **[19b · Standing configuration](19b-the-standing-configuration.md)** | The one-time decisions that make the checklist mostly unnecessary — the configuration a project sets once, and the audit you ru… |
