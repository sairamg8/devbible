---
title: "@Sql is repeatable, its declarations run in source order, and — the default that costs the most afternoons — a method-level declaration replaces the class-level one entirely rather than adding to it, so the natural schema-on-the-class arrangement is broken until you add @SqlMergeMode(MERGE)"
sidebar_label: "04b2 · Groups and merge mode"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Executing SQL Scripts*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)),
> and the javadoc for
> [`Sql`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/Sql.html)
> and
> [`SqlMergeMode`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/SqlMergeMode.html).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No database and no sandbox on this machine** — Java source, SQL and documented
> behaviour only.

**One `@Sql` on a class and one on a method is the arrangement everybody reaches for first:
schema at the top, data on the test. It does not work, because Spring's default is that the
method-level declaration *replaces* the class-level one. The failure is a
relation-does-not-exist error in the tests that added their own fixture, which reads like a
schema problem and sends you to the wrong file. This chunk covers stacking `@Sql`
declarations, the ordering rules between them, `@SqlMergeMode`, and how the whole thing
interacts with inheritance and `@Nested`.**

## Repeatable `@Sql` and `@SqlGroup`

`@Sql` is declared `@Repeatable(SqlGroup.class)`, so the two forms below carry the same
annotation data and the reference presents them as interchangeable:

```java
@Test
@Sql(scripts = "/test-schema.sql", config = @SqlConfig(commentPrefix = "`"))
@Sql("/test-user-data.sql")
void userTest() { }
```

```java
@Test
@SqlGroup({
    @Sql(scripts = "/test-schema.sql", config = @SqlConfig(commentPrefix = "`")),
    @Sql("/test-user-data.sql")
})
void userTest() { }
```

Use the repeatable form. `@SqlGroup` is the container annotation the repeatable mechanism
requires; you write it by hand only when composing a meta-annotation, or when working with
tooling that reads annotations reflectively without repeatable support. Declaring both the
container and a repeated instance on the same element is a compile error, so there is no
way to accidentally combine them.

The reason to write two `@Sql` rather than `@Sql({"a.sql", "b.sql"})` is **per-script
configuration**. `config` applies to the whole `@Sql`, so a script needing a different
comment prefix, statement separator, encoding, error mode or transaction mode has to be its
own declaration. The reference's own example is exactly that: a schema script whose
comments start with a backtick, followed by an ordinary data script.

## Ordering

Three rules, and they compose:

1. Within one `@Sql`, the `scripts` run in array order.
2. Within one `@Sql`, `statements` run **after** all of that annotation's `scripts`.
3. Across several `@Sql` in the same phase, they run in declaration order.

So "schema before data" is expressed as source layout, and nothing verifies it. That is
worth naming as a weakness rather than a feature: annotation order is the kind of thing a
merge resolves arbitrarily and a code formatter has no opinion about preserving. If the
ordering is load-bearing, make it structural instead — schema in `BEFORE_TEST_CLASS`, data
in the method phase (see [04b](04b-phases-and-the-lifecycle.md)) — or put both in one
script where the order is inside the file.

## `@SqlMergeMode`, and the default that bites

From the javadoc of `SqlMergeMode.MergeMode`:

> **`MERGE`** — *"Merges method-level `@Sql` declarations with class-level `@Sql`
> declarations."*

> **`OVERRIDE`** — *"Method-level `@Sql` declarations override class-level `@Sql`
> declarations. This is the default behavior when `@SqlMergeMode` is not declared."*

So this class is broken:

```java
@JdbcTest
@Sql("/db/schema.sql")            // class level: creates the tables
class AccountQueryTest {

    @Test
    void emptyTableReturnsNothing() { }        // schema.sql runs — fine

    @Test
    @Sql("/db/one-account.sql")                // 🔴 schema.sql does NOT run
    void findsTheAccount() { }
}
```

The second test runs `one-account.sql` **only**, against a database with no tables. What
makes this expensive is not the failure, it is the shape of the failure: the first test
passes, so the suite reports that some tests work and the ones with extra data do not,
which reads as a data problem. The obvious first move — open `schema.sql` — leads nowhere,
because `schema.sql` is correct. Nothing in the error mentions `@Sql`, merge modes, or the
class-level annotation that was skipped.

Three fixes, and they are not equivalent:

```java
@JdbcTest
@Sql("/db/schema.sql")
@SqlMergeMode(MERGE)                       // class-level: applies to every method
class AccountQueryTest { … }
```

```java
@Test
@Sql({"/db/schema.sql", "/db/one-account.sql"})   // repeat the schema explicitly
void findsTheAccount() { }
```

```java
@JdbcTest
@Sql(scripts = "/db/schema.sql", executionPhase = BEFORE_TEST_CLASS)  // not overridable
class AccountQueryTest { … }
```

- **`@SqlMergeMode(MERGE)`** is the right default for almost every suite. You then switch a
  single method back with `@SqlMergeMode(OVERRIDE)` on that method when it genuinely needs
  a different schema — which is rare, and being rare is the point: the exception is now
  visible at the exception.
- **Repeating the schema path in every method** is the version that rots. It works until
  someone adds an eleventh test method and forgets, and then you are back to the same
  confusing failure with the additional handicap that ten other methods look fine.
- **The class-phase version** is the most robust and the most restrictive: the schema is
  created once per class and cannot be varied per method at all. If two methods in the
  class need different DDL, they need different classes.

`@SqlMergeMode` is `@Inherited` and targets both `TYPE` and `METHOD`, so a base test class
can set `MERGE` once for a whole hierarchy. It has existed since Framework 5.2, so there is
no version excuse for not using it.

## The class-phase exception

There is a documented carve-out, and it is exactly why the third fix works without `MERGE`:

> *"However, this does not apply to class-level declarations configured for the
> `BEFORE_TEST_CLASS` or `AFTER_TEST_CLASS` execution phases. Such declarations cannot be
> overridden, and the corresponding scripts and statements will be executed once per class
> in addition to any method-level scripts and statements."*

State it as two rules, because it is easier to hold that way:

- A class-level script in a **class** phase is unconditional.
- A class-level script in the default **method** phase is overridable, and by default
  overridden.

## Inheritance and `@Nested`

`@Sql` is `@Inherited`, so a class-level declaration on an abstract base test class applies
to every subclass. And per the javadoc it is *"inherited from an enclosing test class by
default"*, meaning a `@Nested` class picks up the outer class's `@Sql` unless
`@NestedTestConfiguration` says otherwise.

That is convenient, and it is also how a suite ends up running a 300-row seed script for a
nested class that needed two rows. The rule from [01b](01b-what-the-fix-is-not.md) —
*inheritance moves setup out of sight without reducing it* — applies exactly as much to SQL
fixtures as to `@BeforeEach` methods, with one aggravating factor: the base class's fixture
is a filename, so finding out what a subclass's data actually is means opening a file the
subclass never mentions, in a directory the subclass has no relationship with.

The two rules also interact. Inheritance decides what the class-level set *is*; merge mode
decides whether the method-level set replaces it. A `@Nested` class can therefore inherit
an outer fixture and then cancel it with its own method-level `@Sql`, in one test. Reason
about the two separately or you will not get the right answer.

## Where this connects

- Execution phases and the lifecycle interleaving:
  [04b · Phases and the lifecycle](04b-phases-and-the-lifecycle.md).
- Where the script comes from: [04 · Fixtures in the database](04-fixtures-in-the-database.md).
- `config` — the attribute that makes per-script declarations necessary:
  [04c · `@SqlConfig` and the parser](04c-sqlconfig-and-the-parser.md).
- Inherited `@BeforeEach` as the same problem in Java rather than SQL:
  [01b · What the fix is not](01b-what-the-fix-is-not.md).
- `@Nested` lifecycle rules in general:
  [01 · JUnit 5 → 06c](../01-junit-5/06c-nesting-lifecycle-and-limits.md).

## Gotchas

**★ A method-level `@Sql` silently cancels the class-level one.**
`OVERRIDE` is the default and there is no warning. The symptom is a missing-table or
missing-row error in exactly the tests that added their own fixture, which reads like a
schema bug. Fix it with `@SqlMergeMode(MERGE)` on the class, or move the schema script to
`executionPhase = BEFORE_TEST_CLASS` where the documentation says it cannot be overridden.

**★ `@SqlMergeMode(MERGE)` merges declarations, not scripts — so you can run the same
script twice.**
With `MERGE` on the class and a method that also lists the schema script (because someone
added it back when `OVERRIDE` was in force), the schema script runs twice. Whether that is
harmless depends entirely on whether the script is idempotent; `CREATE TABLE` without
`IF NOT EXISTS` is not, and neither is an `INSERT` of a fixed primary key.

**★ Adding `@SqlMergeMode(MERGE)` to an existing class is not a safe refactor.**
Every method that had been quietly *relying* on `OVERRIDE` to skip the class-level fixture
now gets it. If the class-level script inserts a row and a method's assertion counts rows,
that method breaks. Adding `MERGE` should be done together with reading every method's
assertions, not as a blanket cleanup commit.

**★ Two `@Sql` in the same phase run in declaration order — real ordering expressed as
source layout.**
Nothing enforces that schema precedes data, and nothing stops a merge or a reformat from
reordering annotations. If order is load-bearing, encode it structurally with phases, or
put both statements in one script.

**★ A `@Nested` class inherits the outer class's `@Sql` *and* is still subject to the
`OVERRIDE` rule.**
So an outer fixture can be inherited and then cancelled by a method-level `@Sql` inside the
nested class, in the same test. The two rules are independent, and people conflate them
into a single wrong intuition about "the innermost annotation wins".

**★ `@SqlGroup` and repeated `@Sql` cannot both be declared on the same element.**
Java's repeatable-annotation rules forbid it and it is a compile error, which is the
merciful outcome. The trap is only in reading: a codebase that uses `@SqlGroup` in some
places and repeated `@Sql` in others looks like it has two mechanisms when it has one.

**★ `config` is per-`@Sql`, not per-script, so one odd script forces a separate
declaration.**
A team that discovers a script needs `separator = "@@"` and adds it to an existing `@Sql`
that also lists three normal scripts has just changed the separator for all four. The
symptom is that the other three scripts execute as one enormous statement, which either
fails with a syntax error or — with a permissive parser — does something unexpected.

**★ Inherited class-level `@Sql` means a subclass's fixture is a file the subclass never
names.**
Reviewing a test in isolation cannot tell you what data it runs against. If you use base
test classes at all, keep the inherited fixture tiny and read-only, and put anything a test
actually asserts on in the test's own declaration.

## Interview questions

**★ You have a class-level `@Sql("/schema.sql")` and one test also has `@Sql("/data.sql")`. What runs for that test?**
Only `/data.sql`. Method-level `@Sql` overrides class-level `@Sql` by default —
`SqlMergeMode.OVERRIDE` is the documented behaviour when `@SqlMergeMode` is not declared —
so that test runs against a database with no tables and fails with a
relation-does-not-exist error. You fix it with `@SqlMergeMode(MERGE)` on the class, by
listing both scripts in the method annotation, or by moving the schema script to
`executionPhase = BEFORE_TEST_CLASS`, since class-phase declarations are documented as not
overridable and always run once per class in addition to method-level scripts.

**★ Why would you ever write two `@Sql` annotations instead of one with two scripts?**
Because `config` is per-`@Sql`, not per-script. If one script needs a different statement
separator, comment prefix, encoding, error mode or transaction mode, it has to be its own
declaration — the reference's own example does exactly this for a script whose comments
start with a backtick. The other reason is ordering with `statements`: inlined statements
always run after the scripts within the same annotation, so getting statements to run first
requires a separate `@Sql`.

**★ What is `@SqlGroup` for, given that `@Sql` is repeatable?**
It is the container annotation that makes `@Sql` repeatable — `@Sql` is declared
`@Repeatable(SqlGroup.class)`, so the compiler wraps multiple `@Sql` declarations in a
`@SqlGroup` for you. You write it explicitly only when composing a meta-annotation or
working with tooling that reads annotations without repeatable support. Declaring both on
one element is a compile error.

**★ Is `@Sql` inherited?**
Yes, in two directions. It is `@Inherited`, so a class-level declaration on an abstract
base test class applies to subclasses, and it is inherited from an enclosing test class by
default, so `@Nested` classes pick up the outer declaration unless `@NestedTestConfiguration`
changes that. This is convenient and it is also how suites accumulate a large shared seed
script that most classes do not need — the same out-of-sight-not-reduced problem inherited
`@BeforeEach` methods have, made worse because the fixture's contents live in a file the
subclass never names.

**★ How would you arrange schema and data for a class of ten repository tests where three need extra rows?**
Schema once per class in `BEFORE_TEST_CLASS` — or better, from the application's real
migrations — so it cannot be overridden and is not repeated ten times. Common data as a
class-level `@Sql` in the default method phase, with `@SqlMergeMode(MERGE)` on the class so
it runs for every method. The three special methods then add their own method-level `@Sql`
and get both. Without the `MERGE`, those three methods would run only their own script,
which is exactly the bug.

**★ Your team adds `@SqlMergeMode(MERGE)` to a class to fix one failing test and three other tests start failing. What happened?**
Those three were relying on `OVERRIDE` — knowingly or not — to skip the class-level
fixture. With `MERGE` they now get the class-level rows as well as their own, so any
assertion that counts rows, asserts on "the only" row, or inserts a conflicting primary key
breaks. It is a real fix applied without reading the consequences: switching merge mode
changes the input data of every method in the class, so it belongs in a commit where you
have looked at every assertion in the class, not in a blanket cleanup.

{/* FOOTER */}
