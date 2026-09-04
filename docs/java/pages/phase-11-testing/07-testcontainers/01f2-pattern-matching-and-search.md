---
title: "Pattern matching and search — two different regular-expression engines, an ILIKE that really is portable, and a full-text mechanism with nothing in common on either side"
sidebar_label: "01f2 · Pattern matching and search"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **H2 2.x documentation** — *SQL Grammar → Like Predicate Right
> Hand Side* and *→ Regexp Predicate*
> ([grammar.html](https://www.h2database.com/html/grammar.html)), *Functions*
> ([functions.html](https://www.h2database.com/html/functions.html)), *Features → Compatibility*
> and *→ PostgreSQL Compatibility Mode*
> ([features.html](https://www.h2database.com/html/features.html)) and *Tutorial → Fulltext
> Search* ([tutorial.html](https://www.h2database.com/html/tutorial.html)).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, Testcontainers 2.0.5,
> **H2 2.4.240**, PostgreSQL JDBC 42.7.11, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker, no PostgreSQL and no sandbox on this machine.** Nothing here is a query log, a
> timing or a test run.

**[01f](01f-functions-and-the-dialect.md) covered the statement-level dialect. Text matching gets
its own short page for one reason: it contains both the clearest example in the catalogue of
something that genuinely *is* portable, and the clearest example of something that is not portable
at any level — same purpose, different mechanism, different index, different results. Getting the
first one wrong is how portability lists lose their credibility; getting the second one wrong is
how a search feature ships untested.**
## Regular expressions, LIKE and search

### Regular expressions

PostgreSQL has operators — `~`, `~*`, `!~`, `!~*` — plus `regexp_replace`, `regexp_match`,
`regexp_matches`, `regexp_split_to_table`. H2 has the `REGEXP` predicate and `REGEXP_LIKE`,
`REGEXP_REPLACE`, `REGEXP_SUBSTR`, and no `~` operator.

Even the shared name diverges, and H2's PostgreSQL mode is the proof — it patches
`REGEXP_REPLACE` three separate ways:

> *"uses `\` for back-references; does not throw an exception when the flagsString parameter
> contains a 'g'; replaces only the first matched substring in the absence of the 'g' flag in the
> flagsString parameter."*

Three documented behaviour changes to one function, needed because the same call meant three
different things. A `CHECK` constraint containing a regular expression is therefore engine-specific
by construction — and a check constraint is exactly the kind of thing a repository test is
supposed to prove.

### `ILIKE`, and where the case-insensitivity story actually splits

`ILIKE` **is** in the intersection: H2 documents it plainly — *"`ILIKE` does a case-insensitive
compare."* Do not put it on a portability list.

Where the split happens is in *typed* case-insensitivity. PostgreSQL's answer is the `citext`
extension. H2's answers are `VARCHAR_IGNORECASE` (a data type) and the `IGNORECASE=TRUE` URL
setting, which H2 introduces as a MySQL-compatibility feature:

> *"In MySQL text columns are case insensitive by default, while in H2 they are case sensitive.
> However H2 supports case insensitive columns as well. To create the tables with case
> insensitive texts, append `IGNORECASE=TRUE` to the database URL."*

Nothing transfers. And `IGNORECASE=TRUE` is a *database-wide* switch set in a URL, which means a
test suite can turn on case-insensitive comparison for every column in the schema and never
mention it in a single test file.

### Full-text search

PostgreSQL: `tsvector`, `tsquery`, `to_tsvector`, `plainto_tsquery`, the `@@` match operator,
`ts_rank`, and GIN indexes over the vector. None of those names appear in H2's type or function
lists.

H2's answer is a bolt-on:

> *"H2 includes two fulltext search implementations. One is using Apache Lucene, and the other
> (the native implementation) stores the index data in special tables in the database."*

initialised with `CREATE ALIAS IF NOT EXISTS FT_INIT FOR "org.h2.fulltext.FullText.init";` and
queried as `SELECT * FROM FT_SEARCH('Hello', 0, 0);`. Different mechanism, different results,
different ranking. There is no sense in which a search test on H2 is evidence about search on
PostgreSQL.


## Gotchas

**★ A `CHECK` constraint containing a regular expression is engine-specific by construction.**
PostgreSQL's regular expressions are POSIX-style with `~`, `~*`, `!~`, `!~*` operators; H2 has a
`REGEXP` predicate and the `REGEXP_LIKE`/`REGEXP_REPLACE`/`REGEXP_SUBSTR` functions and no `~`
operator at all. H2's PostgreSQL mode patching `REGEXP_REPLACE` three separate ways — back-reference
syntax, the `g` flag not raising, single-versus-global replacement — is the measure of how far
apart the two dialects are. A check constraint is exactly the sort of thing a repository test is
supposed to prove, and this is the one class of constraint whose *definition* does not survive the
move between engines.

**★ `ILIKE` is portable, and putting it on a "not portable" list costs you the whole list.**
H2 documents it in five words: *"`ILIKE` does a case-insensitive compare."* If a reader finds one
false entry on a portability list, the rational response is to distrust every other entry, and
after that the divergences that genuinely bite go unargued. Verify against the grammar before you
write the list.

**★ Case-insensitivity splits at the *typed* level, not at `ILIKE`.**
PostgreSQL's answer is the `citext` extension — a type. H2's answers are `VARCHAR_IGNORECASE` (a
type) and `IGNORECASE=TRUE` (a database-wide URL setting). None of the three names transfers, and
the H2 URL setting silently applies to every text column in the schema
([01e](01e-text-numbers-and-ordering.md)).

**★ H2's `LIKE` uses an index only when the pattern does not start with a wildcard, and it says so.**
*"The database uses an index when comparing with `LIKE` except if the operand starts with a
wildcard."* PostgreSQL has the same broad limitation, and a way around it that H2 does not have —
a `pg_trgm` GIN index makes a leading-wildcard `LIKE` indexable. So a search feature that performs
acceptably in production because of a trigram index has no equivalent in the test database, and
performance is not the only thing that changes: the trigram operators are not available either.

**★ Full-text search is not a dialect difference, it is a different product.**
*"H2 includes two fulltext search implementations. One is using Apache Lucene, and the other (the
native implementation) stores the index data in special tables in the database."* You initialise it
with `CREATE ALIAS IF NOT EXISTS FT_INIT FOR "org.h2.fulltext.FullText.init"` and query it with
`SELECT * FROM FT_SEARCH('Hello', 0, 0)`. PostgreSQL's is `to_tsvector`, `plainto_tsquery`, the
`@@` operator and `ts_rank` over a GIN index. Different query language, different tokenisation,
different stemming, different ranking function. There is no sense in which a relevance assertion on
one is evidence about the other.

**★ Stemming and stop words are configuration, and configuration is not portable either.**
PostgreSQL's text search behaviour depends on the text search *configuration* in use — which
dictionary, which stop-word list, which language. That is a property of the database instance, so
even between two PostgreSQL containers the answer to "does searching for `running` match `runs`"
can differ if they were set up differently. A search test therefore has two requirements, not one:
the right engine, and the right configuration on it.

**★ Escaping in `LIKE` patterns is one of the few places where getting the default wrong is silent.**
H2 documents its default escape character as backslash and offers `ESCAPE ''` to disable escaping
entirely, and it warns that *"Patterns that end with an escape character are invalid and the
expression returns NULL"* — an expression returning `NULL` rather than raising is the definition of
a silent failure, because a `NULL` in a `WHERE` clause is simply not-matched. User-supplied search
terms containing `%`, `_` or a backslash are the input that finds this, and no fixture contains
them.

## Interview questions

**★ Is `ILIKE` portable between H2 and PostgreSQL?**
Yes. H2's grammar has `ILIKE` and documents it as a case-insensitive compare. It is worth using
this as the canonical example of why you check the grammar rather than reasoning from vibes: the
constructs people *assume* are PostgreSQL-only include several that are not — `ILIKE`,
`DISTINCT ON`, `SKIP LOCKED`, the whole window-function set — while several they assume are shared
are not: `RETURNING`, `LATERAL`, `ON CONFLICT DO UPDATE`, `generate_series`, `string_agg`. The
intuition is unreliable in both directions, and the grammar pages are short.

**★ You need to test a full-text search feature. What is the minimum honest setup?**
The real engine, and the real text search configuration on it. PostgreSQL's answer depends on the
dictionary and stop-word list in use, so the container has to be configured the way production is,
not merely be PostgreSQL. H2 cannot participate at all: its full-text search is a bolt-on with a
different query language (`FT_SEARCH`), a different index and a different ranking function, so a
relevance assertion there is a measurement of Lucene or of H2's native implementation, not of
`ts_rank`. And even with the right container, be careful what you assert — exact ranking scores are
brittle; assert on result *membership* and relative order.

**★ Why is a regular expression inside a `CHECK` constraint a particularly bad thing to test on H2?**
Because a check constraint is one of the few pieces of business logic that lives entirely in the
database, so a repository test is the *only* thing that can verify it — and the regular-expression
dialect is precisely the part that does not transfer. H2's regex functions are patched three ways
by PostgreSQL mode just to make one function behave similarly, and PostgreSQL's operator forms
(`~`, `~*`) have no H2 spelling. So the constraint you tested is not the constraint that will run,
and the specific inputs that distinguish them — the ones with back-references, greedy quantifiers
or character-class edge cases — are exactly the inputs a fixture does not contain.

**★ A search feature is fast in production and slow in the test suite, or vice versa. What would you look at?**
Which index exists in each place. PostgreSQL can make a leading-wildcard `LIKE` indexable with a
`pg_trgm` GIN index and can serve full-text search from a GIN index over a `tsvector`; H2 has
neither, and its own documentation notes it uses an index for `LIKE` only when the pattern does not
start with a wildcard. But the more important observation is that timing differences between a test
database and production are almost never informative — different data volume, different statistics,
different index set. The reason to care here is not the timing; it is that the *index does not
exist*, which means the query being tested is a different query plan and, for the trigram
operators, a different query entirely.

{/* FOOTER */}
