---
title: "Before the catalogue: what MODE=PostgreSQL actually promises, and the one divergence that is invisible while Hibernate is writing your SQL for you"
sidebar_label: "01c · What H2 gets wrong (scope)"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **H2 2.x documentation** — *Features → Compatibility*,
> *→ Compatibility Modes*, *→ STRICT Compatibility Mode* and *→ PostgreSQL Compatibility Mode*
> ([features.html](https://www.h2database.com/html/features.html)) and *SQL Grammar → Identifiers*
> ([grammar.html](https://www.h2database.com/html/grammar.html)) — and the **PostgreSQL 18
> manual**, *Lexical Structure → Identifiers and Key Words*
> ([sql-syntax-lexical](https://www.postgresql.org/docs/18/sql-syntax-lexical.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, Testcontainers 2.0.5, **H2 2.4.240**, PostgreSQL JDBC 42.7.11, JUnit Jupiter
> 6.0.3.
> ⚠️ **No Docker, no PostgreSQL and no sandbox on this machine.** Every claim on this page and
> its siblings is read out of documentation or source; nothing here is a query log, a timing or a
> test run.

**[01](01-passed-on-h2-proves-nothing.md) argued that a test which ran on H2 is evidence about
H2. [01b](01b-where-the-line-is.md) drew the line at which tests need a real engine. Neither
listed the disagreements, because the argument does not depend on the list — but your decision
about a specific query does. This page opens the catalogue with the two things you have to settle
before any entry in it makes sense: exactly how much `MODE=PostgreSQL` covers, and the identifier
divergence that stays invisible for as long as Hibernate is the only thing writing SQL.**
## How to read this catalogue

Every entry answers three questions: what PostgreSQL 18 does, what H2 2.4.240 does, and **which
test stays green anyway**. The third one is the only one that matters. A divergence you cannot
connect to a passing test is trivia; a divergence you can is a defect waiting for a user to find
it.

Divergences come in three shapes, and they are not equally dangerous:

1. **It will not parse.** Noisy, immediate, cheap to find — a false red. The damage is indirect:
   somebody "fixes" it by rewriting the production query into the intersection dialect, which is
   the trap [01b](01b-where-the-line-is.md) calls the portable-SQL compromise.
2. **It parses and means something else.** Silent. This is the false-green generator and it is
   where most of this catalogue lives.
3. **It parses, means the same thing, and behaves differently under concurrency or at scale.**
   Invisible to any single-threaded test with a tidy fixture. That is
   [01g](01g-transactional-ddl-and-which-schema.md) through
   [01i](01i-the-planner-and-indexes.md).

## First: exactly what `MODE=PostgreSQL` buys you

Before the catalogue, the thing that makes the catalogue necessary. H2 scopes its whole
compatibility feature in one sentence, and it is more modest than the feature's name:

> *"For certain features, this database can emulate the behavior of specific databases. However,
> only a small subset of the differences between databases are implemented in this way."*

The PostgreSQL mode is that subset, and H2 publishes it in full. Seventeen bullets — twenty
items once the three `REGEXP_REPLACE` sub-clauses are counted — verbatim:

> *"For aliased columns, `ResultSetMetaData.getColumnName()` returns the alias name and
> `getTableName()` returns null."* · *"When converting a floating point number to an integer, the
> fractional digits are not be truncated, but the value is rounded."* · *"The system columns
> `ctid` and `oid` are supported."* · *"`GREATEST` and `LEAST` ignore `NULL` values by default."*
> · *"`LOG(x)` is base 10 in this mode."* · *"`REGEXP_REPLACE()`: uses `\` for back-references;
> does not throw an exception when the flagsString parameter contains a 'g'; replaces only the
> first matched substring in the absence of the 'g' flag in the flagsString parameter."* ·
> *"`LIMIT` / `OFFSET` clauses are supported."* · *"Legacy `SERIAL` and `BIGSERIAL` data types are
> supported."* · *"`ON CONFLICT DO NOTHING` is supported in `INSERT` statements."* · *"Spaces are
> trimmed from the right side of `CHAR` values, but `CHAR` values in result sets are right-padded
> with spaces to the declared length."* · *"`NUMERIC` and `DECIMAL`/`DEC` data types without
> parameters are treated like `DECFLOAT` data type."* · *"`MONEY` data type is treated like
> `NUMERIC(19, 2)` data type."* · *"Datetime value functions return the same value within a
> transaction."* · *"`ARRAY_SLICE()` out of bounds parameters are silently corrected."* ·
> *"`EXTRACT` function with `DOW` field returns (0-6), Sunday is 0."* · *"`UPDATE` with `FROM` is
> partially supported."* · *"`GROUP BY` clause can contain 1-based positions of expressions from
> the `SELECT` list."*

Read that as a **negative space**. Nothing on this page's catalogue appears on that list, which
is precisely why the catalogue exists.

Two more things the list does not tell you, and both are load-bearing. First, H2's own
recommended URL for the mode is three settings, not one:

```
jdbc:h2:~/test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH
```

`MODE=PostgreSQL` does **not** fix identifier folding and does **not** fix null ordering — those
are the other two settings, and you have to know to ask for them. A project that wrote only
`MODE=PostgreSQL` has neither. Second, H2 warns:

> *"Do not change value of `DATABASE_TO_LOWER` after creation of database."*

For an in-memory test database created fresh per JVM that is harmless. For the file-backed H2 a
team has been using for local development since 2019, it means the switch is a migration, not a
URL edit.

## Identifier casing: the divergence nobody sees coming

The two engines fold unquoted identifiers in **opposite directions**, and both say so plainly.

PostgreSQL 18:

> *"Quoting an identifier also makes it case-sensitive, whereas unquoted names are always folded
> to lower case. For example, the identifiers `FOO`, `foo`, and `"foo"` are considered the same
> by PostgreSQL, but `"Foo"` and `"FOO"` are different from these three and each other. (The
> folding of unquoted names to lower case in PostgreSQL is incompatible with the SQL standard,
> which says that unquoted names should be folded to upper case…)"*

H2 2.x:

> *"With default settings unquoted names are converted to upper case."* … *"Identifiers in H2 are
> case sensitive by default. Because unquoted names are converted to upper case, they can be
> written in any case anyway. When both quoted and unquoted names are used for the same
> identifier the quoted names must be written in upper case. Identifiers with lowercase
> characters can be written only as a quoted name, they aren't accessible with unquoted names."*

So `create table app_user (user_id bigint)` produces a column named `user_id` on PostgreSQL and
`USER_ID` on H2. Both engines are then internally consistent, which is exactly why this hides:
JPA never quotes anything by default, so every JPQL query and every `@Column(name = "user_id")`
resolves on both.

It breaks the moment a **quoted** identifier enters, and quoted identifiers enter through native
queries and hand-written migrations:

```java
// Green on PostgreSQL. On H2 the DDL created USER_ID, so "user_id" does not exist.
@Query(value = """
        SELECT u."user_id", u."email"
        FROM app_user u
        WHERE u."email" = :email
        """, nativeQuery = true)
Optional<UserRow> findByEmail(@Param("email") String email);
```

And in the other direction, a camelCase column deliberately created as `"createdAt"` on
PostgreSQL must stay quoted at every reference forever — an unquoted `createdAt` folds to
`createdat` and does not exist. On H2 with default settings the same DDL creates `createdAt`
(quoted names preserve case there too) but an unquoted reference folds to `CREATEDAT`. The
failures rhyme; the fixes do not transfer.

**The test that passes anyway:** all of them, as long as the schema came from Hibernate. Under
`ddl-auto` Hibernate emits the DDL *and* the queries, unquoted, so the two agree by
construction. The first hand-written migration, or the first `nativeQuery = true`, is where the
project discovers that its test database has been folding the other way for two years.


## Where the rest of the catalogue lives

- The types you store objects in — `jsonb` and its operators, arrays, `UUID`, `ENUM`, `INTERVAL`
  and `timestamp with time zone` — are [01d](01d-the-types-you-query-with.md).
- Text, numbers, `NULL` ordering and collation are [01e](01e-text-numbers-and-ordering.md).
- The statement-level dialect — `ON CONFLICT`, `RETURNING`, `LATERAL`, `DISTINCT ON` and the
  aggregate names — is [01f](01f-functions-and-the-dialect.md).
- Pattern matching and search — regular expressions, `ILIKE`, full text — are
  [01f2](01f2-pattern-matching-and-search.md).
- Transactional DDL, and the question of which schema your test ran against at all, are
  [01g](01g-transactional-ddl-and-which-schema.md).
- Isolation levels and locking are [01h](01h-isolation-and-locking.md).
- What a violation or a conflict actually raises — the SQLStates, and the two that are not
  portable — is [01h2](01h2-what-a-violation-raises.md).
- Indexes and the query planner are [01i](01i-the-planner-and-indexes.md).

## Gotchas

**★ `MODE=PostgreSQL` on its own does not fix identifier folding or null ordering.**
H2's own recommended URL is `MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH` —
three settings, of which the mode is one. A project that copied only `MODE=PostgreSQL` from a blog
post still folds identifiers up and still sorts nulls low, and both of those are silent. Read the
URL, not the mode name.

**★ The compatibility mode changes results inside H2, not just syntax.**
`CAST(2.7 AS INT)` is 2 in H2's REGULAR mode and 3 in PostgreSQL mode, because the mode swaps
truncation for rounding: *"the fractional digits are not be truncated, but the value is rounded."*
If a switch in a JDBC URL can change an arithmetic answer, "the mode handles the dialect gap" was
never the right mental model — and it means two H2 test suites in the same repository with
different URLs can legitimately disagree.

**★ A native query with quoted identifiers is engine-specific by construction.**
PostgreSQL folds unquoted names down, H2 folds them up. `"user_id"` resolves on PostgreSQL and
does not exist on default H2, where the column is `USER_ID`. Either quote nothing anywhere — the
advice PostgreSQL's own manual gives, *"you are advised to always quote a particular name or never
quote it"* — or accept that the query has an engine and test it on that engine.

**★ `MODE=STRICT` is a linter, and H2 says explicitly that it is not a validator.**
It exists for exactly this problem — *"If your application or library uses only the H2 or it
generates different SQL for different database systems it is recommended to use this compatibility
mode in unit tests to reduce possibility of accidental misuse of such features"* — and it disables
H2-isms like `TOP`, `MINUS`, `AUTO_INCREMENT`, `SERIAL` and the empty `IN` predicate. But H2 adds
*"This mode cannot be used as SQL validator, however."* It narrows the set of H2-only constructs
you can accidentally use; it says nothing about whether the remaining SQL means the same thing on
PostgreSQL.

**★ H2 supports `DISTINCT ON` and `SKIP LOCKED`. Repeating that it does not gets the real problems dismissed.**
Both are in the 2.4.240 `SELECT` grammar. The problems with them are semantic, not syntactic, and
they are in [01f](01f-functions-and-the-dialect.md) and
[01h](01h-isolation-and-locking.md). Check the grammar before you put a feature on a
"not portable" list — a list with one wrong entry gets the whole list treated as folklore, and
then the genuine divergences go unchallenged too.

**★ `ctid` and `oid` parse under PostgreSQL mode, which is not the same as working.**
The compatibility list says *"The system columns `ctid` and `oid` are supported."* On PostgreSQL
`ctid` is the physical location of a row version — it changes on every `UPDATE` and after a
`VACUUM FULL`. Any code that reads it is coupled to storage internals of one specific engine, and
the fact that the statement now parses on H2 tells you nothing about whether the two engines mean
the same thing by it. Treat "H2 accepts this token" and "H2 implements this concept" as unrelated
facts throughout this catalogue.

## Interview questions

**★ What exactly does `MODE=PostgreSQL` do?**
It applies a documented list of seventeen bullets — twenty items counting the three
`REGEXP_REPLACE` sub-clauses. Result-set metadata for aliased columns, rounding instead of
truncation on float-to-integer conversion, `ctid` and `oid` as system columns, `GREATEST`/`LEAST`
ignoring `NULL`, base-10 `LOG`, three `REGEXP_REPLACE` adjustments, `LIMIT`/`OFFSET`, legacy
`SERIAL`, `ON CONFLICT DO NOTHING` only, `CHAR` padding, unparameterised `NUMERIC` becoming
`DECFLOAT`, `MONEY` as `NUMERIC(19,2)`, stable datetime functions inside a transaction,
`ARRAY_SLICE` bounds correction, `EXTRACT(DOW)` as 0–6, partial `UPDATE … FROM`, and positional
`GROUP BY`. H2 frames the whole feature as *"only a small subset of the differences between
databases"*. It is an enumeration, not an equivalence claim — and it does not include identifier
folding or null ordering, which are separate URL settings you have to know to ask for.

**★ Why does identifier case folding almost never break a Spring Data JPA project — until it does, catastrophically?**
Because Hibernate quotes nothing by default and, on an embedded database, usually generated the
schema itself. Unquoted DDL and unquoted queries fold the same way on each engine, so each engine
is internally consistent and the tests pass. The break arrives with the first thing that is not
Hibernate-generated: a hand-written migration, or a `nativeQuery = true` with a quoted column
name. `"user_id"` is a real column on PostgreSQL and does not exist on default H2, where the
column is `USER_ID`. PostgreSQL's manual gives the only durable advice — always quote a name or
never quote it — and note that the advice is about *your* consistency, not about portability,
because the two engines fold in opposite directions regardless.

**★ Name the divergences between H2 and PostgreSQL that produce a *passing* test rather than a failing one.**
The silent ones cluster in four places. Identifier folding is silent while everything is
Hibernate-generated, and breaks at the first quoted native query. Null ordering is silent until
the data contains a `NULL` the fixture did not have — H2 sorts nulls low, PostgreSQL sorts them
high, so `ORDER BY x LIMIT 1` picks a different row
([01e](01e-text-numbers-and-ordering.md)). `timestamp with time zone` is silent because H2 keeps
the offset and PostgreSQL discards it, so a round-trip assertion with `isEqualTo` is green on H2
and engine-dependent on PostgreSQL ([01d](01d-the-types-you-query-with.md)). And the whole
transactional-DDL and isolation family is silent because a single-threaded test with one
connection cannot observe any of it ([01g](01g-transactional-ddl-and-which-schema.md),
[01h](01h-isolation-and-locking.md)). The loud divergences — `jsonb` operators,
`text[]`, `RETURNING`, `LATERAL`, `ON CONFLICT DO UPDATE` — are cheap by comparison; they announce
themselves.

**★ Someone shows you a query using `DISTINCT ON` and says "we can't use that, H2 doesn't support it." Are they right?**
No, and it is worth being precise rather than just correcting them. H2 2.4.240 has `DISTINCT ON`
in its `SELECT` grammar. The real issue is semantic: both engines document that without an
`ORDER BY`, which row survives each group is undefined, so the two can legitimately pick different
rows and the H2 test freezes whichever one H2 happened to pick. The correct response is to add the
`ORDER BY`, not to abandon the clause. Getting this right matters beyond the one query — a
portability list with a wrong entry on it gets the whole list dismissed, and after that the
divergences that really do bite go unargued.

**★ Would running the H2 tests in `MODE=STRICT` be a reasonable safety net?**
Partially, and H2 tells you the limit. STRICT mode disables H2's own deprecated extensions — the
empty `IN` predicate, `TOP`, `MINUS` for `EXCEPT`, `IDENTITY` as a data type, `AUTO_INCREMENT`,
`SERIAL`/`BIGSERIAL` — and H2 explicitly recommends it *"in unit tests to reduce possibility of
accidental misuse of such features"*. So it stops you accidentally writing H2-only syntax. What it
does not do is stated just as plainly: *"This mode cannot be used as SQL validator, however."* It
narrows the syntax you can use; it makes no claim about semantics, so every divergence in this
catalogue that is about meaning rather than spelling survives it untouched. H2 also warns against
enabling it in published libraries, because the mode may become more restrictive in later
releases.

**★ Why is it more useful to say "H2 is a different implementation" than "H2 is a subset of PostgreSQL"?**
Because "subset" predicts a direction of failure that does not hold. A subset would only ever
produce false reds — things PostgreSQL can do that H2 cannot. In practice H2 has features
PostgreSQL lacks (`QUALIFY`, `VARCHAR_IGNORECASE`, a database-wide `IGNORECASE=TRUE`, a `SNAPSHOT`
isolation level), and it has features with the same *name* and different *behaviour*
(`REPEATABLE READ`, `SERIALIZABLE`, `timestamp with time zone`, default null ordering, SQLState
`40001`). Those overlapping-but-different cases are where every false green in this catalogue
comes from, and the subset mental model has no room for them at all.

{/* FOOTER */}
