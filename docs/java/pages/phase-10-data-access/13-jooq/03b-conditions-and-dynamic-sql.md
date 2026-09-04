---
title: "A Condition is a value you can build, store and combine, which turns dynamic filtering from string surgery into ordinary Java — provided you use noCondition rather than an empty predicate"
sidebar_label: "03b · Conditions and dynamic SQL"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Conditional expressions*
> ([sql-building/conditional-expressions](https://www.jooq.org/doc/latest/manual/sql-building/conditional-expressions/)),
> *TRUE, FALSE and NO condition*
> ([true-false-no-condition](https://www.jooq.org/doc/latest/manual/sql-building/conditional-expressions/true-false-no-condition/))
> and *Dynamic SQL — the NO condition*
> ([dynamic-sql/no-condition](https://www.jooq.org/doc/latest/manual/sql-building/dynamic-sql/no-condition/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**The single most common thing a repository method has to do is build a query whose `WHERE`
clause depends on which parameters arrived. In a string API that is concatenation, a running
`List<Object>` of bind values, and a leading `1=1` that everyone is faintly embarrassed by. In
jOOQ a predicate is an `org.jooq.Condition` — a value with a type — so the whole problem collapses
into building a collection and reducing it. The one trap is the empty case, and jOOQ has a
purpose-built answer for it that behaves in a way you must read carefully.**

## Predicates are built off fields

Every generated column is an `org.jooq.Field<T>`, and the comparison methods live on it. The
type parameter is what makes the API refuse nonsense:

```java
ORDER.STATUS.eq("SHIPPED")                       // Condition
ORDER.TOTAL.gt(new BigDecimal("100.00"))
ORDER.PLACED_AT.between(from).and(to)
ORDER.CUSTOMER_ID.in(1L, 2L, 3L)
ORDER.CANCELLED_AT.isNull()
CUSTOMER.EMAIL.likeIgnoreCase("%@example.com")
ORDER.STATUS.notIn(statuses)
```

`ORDER.TOTAL.eq("SHIPPED")` does not compile, because `TOTAL` is a `Field<BigDecimal>`. That is
the same guarantee **[01 · What jOOQ is](01-what-jooq-is.md)** made about column names, extended
to the values you compare them against.

**`in(...)` takes a collection as well as varargs**, which matters because the collection form is
what a dynamic filter actually has. And `isNull()` / `isNotNull()` exist as methods for the
reason every SQL tutorial gives: `= NULL` is not a thing, and jOOQ will not let you pretend it
is by accident.

## Combining them

`Condition` has `and`, `or` and `not`, and each returns a new `Condition`:

```java
Condition c = ORDER.STATUS.eq("SHIPPED")
        .and(ORDER.TOTAL.gt(BigDecimal.TEN))
        .and(ORDER.CANCELLED_AT.isNull().or(ORDER.REFUNDED.isTrue()));
```

🔴 **jOOQ parenthesises for you, and this is worth trusting rather than second-guessing.**
Because the condition is a tree rather than text, `a.and(b.or(c))` renders with the brackets that
make the tree true. The classic SQL bug where someone mixes `AND` and `OR` in a concatenated
string and gets the wrong precedence cannot happen — the structure was decided in Java, not by a
parser reading your spaces.

There are also static forms on `DSL` for when you have a collection rather than a chain:

```java
import static org.jooq.impl.DSL.*;

Condition c = and(conditions);   // conditions is a Collection<Condition>
Condition d = or(conditions);
```

## The dynamic filter, done properly

The shape everyone needs:

```java
public List<OrderSummary> search(String status, BigDecimal minTotal, Long customerId) {

    Condition where = DSL.noCondition();

    if (status != null)     where = where.and(ORDER.STATUS.eq(status));
    if (minTotal != null)   where = where.and(ORDER.TOTAL.ge(minTotal));
    if (customerId != null) where = where.and(ORDER.CUSTOMER_ID.eq(customerId));

    return create.select(ORDER.ID, ORDER.STATUS, ORDER.TOTAL)
                 .from(ORDER)
                 .where(where)
                 .fetchInto(OrderSummary.class);
}
```

No `1=1`. No `StringBuilder`. No parallel list of bind values that has to stay in step with the
`?` count. The `if` blocks are ordinary Java and can be extracted, tested and reused, because
`where` is just a variable.

### What `noCondition()` actually does — read this twice

The manual defines it as *"a pseudo-identity for both AND and OR, not generating any SQL, except
if the reduction produces nothing (from an empty set), in case of which it will behave like
TRUE"*.

⚠️ **And it carries its own warning, which is the part people miss:** *"noCondition() does not act
as an identity! If your noCondition() is the only predicate left in a WHERE clause, there will not
be any WHERE clause, regardless if you work with AND predicates or OR predicates."*

Unpack that, because both halves matter:

- **With at least one real predicate**, `noCondition()` disappears and you get exactly the
  predicates you added — which is what you wanted.
- **With no real predicates at all**, there is **no `WHERE` clause**. For a chain of `AND`s that
  is correct: no filters means every row. For a chain of `OR`s it is **not** what the algebra
  says — `OR` over an empty set should be false, and jOOQ gives you everything.

🔴 **So `noCondition()` is safe as the seed of an `AND` chain and dangerous as the seed of an `OR`
chain.** For `OR`, seed with `DSL.falseCondition()`, which is the true identity of `OR`. For a
strict `AND` seed, `DSL.trueCondition()` is the identity — it renders `true`, which is a real
predicate and therefore leaves a `WHERE true` in the SQL.

| Seed | Renders when alone | Correct for |
|---|---|---|
| `noCondition()` | nothing — the clause vanishes | `AND` chains, when "no filters" means "all rows" |
| `trueCondition()` | `true` | `AND` chains, when you want a `WHERE` clause to exist |
| `falseCondition()` | `false` | `OR` chains — the identity of `OR` |

**The unguarded case is worth naming explicitly.** A search endpoint that seeds an `OR` chain with
`noCondition()` and receives no parameters returns the entire table. That is a full scan, a
pagination-less response and, on a table with any access control expressed as a predicate, a data
leak. It is a two-character fix and an easy one to never notice.

## When the DSL does not have your expression

jOOQ's DSL is wide, but PostgreSQL is wider, and sooner or later you want an operator or a
function jOOQ does not model. The documented escape hatch is **plain SQL templating**:

```java
Condition c = condition("{0} <@ {1}", ORDER.TAGS, DSL.val(wanted));
Field<String> f = field("upper({0} || {1})", String.class, CUSTOMER.FIRST, CUSTOMER.LAST);
Table<?> t = table("generate_series({0}, {1})", DSL.val(1), DSL.val(10));
```

The rules, from the manual:

- **Placeholders are `{0}`, `{1}`, …** — zero-based, and a placeholder may be repeated to use the
  same argument twice.
- **The arguments are `QueryPart`s**, so a `Field`, a bind value from `DSL.val(...)` or another
  condition. They render and bind exactly as they would anywhere else.
- **`DSL.list(QueryPart...)` wraps a comma-separated list as one argument** — the manual's own
  example is `condition("my_column IN ({0})", list(a, b, c))`.
- **The templating engine ignores tokens inside string literals, quoted names, comments and JDBC
  escape sequences**, so a literal `{0}` inside a quoted string is left alone.

🔴 **This is the one place jOOQ's injection guarantee stops holding, and it stops holding
completely.** The template string is SQL text. Concatenating a user-supplied value into it is
exactly as dangerous as concatenating it into a JDBC string, and the surrounding jOOQ code makes
it *look* safe. **Every user value goes through a placeholder, never into the template.** That is
the same line **[01c · A tree, not a string](01c-the-dsl-is-a-tree.md)** drew around plain SQL,
and it is worth drawing twice.

⚠️ **Plain SQL is also where dialect portability goes.** A template is raw text; jOOQ cannot
translate it for another database, and it will not warn you.

## Gotchas

**★ Reassigning is the whole trick, and forgetting to is the whole bug.** `Condition` is
immutable: `where.and(x)` returns a new condition and leaves `where` alone. Writing
`where.and(ORDER.STATUS.eq(status));` without the assignment compiles, does nothing, and produces
a query missing one filter. This is the single most common jOOQ dynamic-SQL defect.

**★ `noCondition()` seeding an `OR` chain returns every row when nothing matched.** The manual
says it plainly — with no other predicate there is no `WHERE` clause *"regardless if you work with
AND predicates or OR predicates"*. Seed `OR` chains with `falseCondition()`.

**★ `trueCondition()` and `noCondition()` are not interchangeable.** `trueCondition()` renders
`true` and therefore leaves `WHERE true` in the SQL; `noCondition()` renders nothing. Both are
usually harmless, but a `WHERE true` in a log or an `EXPLAIN` is a question you have to answer in
review, and some tooling treats it as a smell.

**★ `in(collection)` with an empty collection is a documented-behaviour question, not an obvious
one.** Do not assume it renders `false`, and do not assume it renders `1=0`. Guard the empty case
explicitly — skip the predicate, or use `falseCondition()` — so the behaviour is yours rather than
inherited.

**★ A very large `in(...)` list is a PostgreSQL problem, not a jOOQ problem.** jOOQ will happily
build a predicate with ten thousand bind values, and the statement will be enormous, uncacheable
and slow. The fix is an array parameter or a temporary table, and it belongs in the query design,
not in the DSL.

**★ `eq(null)` does not become `IS NULL`.** It becomes a comparison against a null bind value,
which is never true, and it is the classic way a "filter by optional field" method silently
returns nothing. Use `isNull()`, or guard the null before building the predicate.

**★ Extracting a predicate to a method loses its type parameter if you type it as `Condition`
too early.** That is usually fine, but a helper returning `Condition` cannot later be used where a
`Field<Boolean>` is wanted. Return the narrowest useful type.

**★ Static-importing `DSL.and` and `DSL.or` collides with readability, not with the compiler.**
`and(list)` at the top level of a method reads as a mystery until you know the import is there.
Qualifying it as `DSL.and(list)` in shared code costs four characters and saves a question.

**★ Plain SQL templates are not checked by anything.** No compiler, no generator, no dialect
translation. A typo in a template surfaces at execution as a database syntax error, at which point
you have exactly the debugging experience jOOQ was adopted to avoid.

**★ `{0}` in a template is positional, and reordering the arguments silently reassigns them.**
Since arguments are `QueryPart`s of possibly the same type, swapping two of them can still render
valid SQL that means something different.

**★ A condition built from a table you did not add to `FROM` compiles fine.** The type system
checks the *column*, not whether that column's table is in the query. The failure is a database
error about a missing FROM-clause entry, and it happens most often when a predicate helper is
reused across two queries.

**★ Storing a `Condition` in a field or a constant is legal and occasionally a trap.** It is
immutable and safe to share, but a condition holding bind values captured at construction time
holds those values forever. Build per-call unless the predicate is genuinely constant.

## Interview questions

**★ How do you build a `WHERE` clause whose predicates depend on which parameters are non-null?**
Seed a `Condition` with `DSL.noCondition()`, `and(...)` each applicable predicate onto it —
reassigning each time — and pass the result to `.where(...)`. No string building, no `1=1`, no
parallel bind-value list.

**★ What exactly does `noCondition()` do?** The manual calls it a pseudo-identity for both `AND`
and `OR` that generates no SQL, except that if the reduction produces nothing it behaves like
`TRUE`. In practice: with other predicates present it vanishes; alone, it removes the `WHERE`
clause entirely.

**★ Why is `noCondition()` dangerous as the seed of an `OR` chain?** Because with no other
predicate there is no `WHERE` clause at all — the manual says so explicitly, for `AND` and `OR`
alike. The algebraic identity of `OR` is false, so an unfiltered `OR` search should return
nothing and instead returns everything. Seed with `falseCondition()`.

**★ What is the difference between `trueCondition()` and `noCondition()`?** `trueCondition()` is a
real predicate that renders `true` and leaves a `WHERE true` behind. `noCondition()` renders
nothing at all. `trueCondition()` is the identity of `AND`; `noCondition()` is a convenience that
disappears.

**★ Why can't jOOQ get `AND`/`OR` precedence wrong?** Because the condition is a tree built in
Java, not text parsed by a database. jOOQ renders whatever parentheses the tree requires. The
mixed-precedence bug is a property of string concatenation, and there is no string.

**★ What is the most common bug in jOOQ dynamic SQL?** Forgetting to reassign.
`where.and(predicate);` returns a new condition and discards it, because `Condition` is immutable.
It compiles, it runs, and the filter is simply absent.

**★ How do you use a PostgreSQL operator jOOQ does not model?** Plain SQL templating —
`DSL.condition("{0} <@ {1}", a, b)`, `DSL.field(...)`, `DSL.table(...)` — with zero-based `{0}`
placeholders bound to `QueryPart` arguments, and `DSL.list(...)` when one argument is a
comma-separated list.

**★ What do you lose when you reach for plain SQL templating?** The compiler's check, dialect
translation, and — if you concatenate rather than parameterise — the injection guarantee. The
surrounding jOOQ code makes it look safer than it is.

**★ Is `DSL.condition("status = '" + status + "'")` safe because it is jOOQ?** No. That is string
concatenation into SQL text and is exactly as injectable as the JDBC equivalent. Values go through
placeholders; only structure goes in the template.

**★ Why does `ORDER.CANCELLED_AT.eq(null)` not do what people expect?** It compares against a null
bind value, which is never true in SQL, rather than rendering `IS NULL`. The method for the latter
is `isNull()`, and the mistake typically shows up as a filter that returns zero rows.

**★ How would you handle an `in(...)` whose collection may be empty?** Decide explicitly. Skip the
predicate when "no values" means "no filter", or use `falseCondition()` when it means "match
nothing". Relying on an assumed rendering for the empty case is how the two meanings get confused.

**★ A predicate helper is reused in two queries and one of them fails with an error about a
missing FROM entry. Why?** Because the type system checks that the column exists and has the right
type, not that its table is in this query's `FROM`. A shared helper referencing `CUSTOMER.EMAIL`
compiles in a query that only selects from `ORDER`.

{/* FOOTER */}
