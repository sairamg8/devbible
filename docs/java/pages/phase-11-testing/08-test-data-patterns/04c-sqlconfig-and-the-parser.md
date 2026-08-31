---
title: "Spring parses your fixture script itself before the database ever sees it — splitting on semicolons, stripping comments and guessing the encoding — so a script that runs perfectly in psql can still fail under @Sql, and @SqlConfig is the set of dials that exist because that parser has to be told the truth"
sidebar_label: "04c · @SqlConfig and the parser"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Executing SQL Scripts*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)),
> and the javadoc for
> [`SqlConfig`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/SqlConfig.html)
> and
> [`ScriptUtils`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/datasource/init/ScriptUtils.html).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8.
> ⚠️ **No database and no sandbox on this machine** — Java source, SQL and documented
> behaviour only, never the output of a run.

**The most surprising fact about `@Sql` is that the database never sees your file. Spring
reads it, splits it into statements, strips the comments, and sends the pieces one at a
time through JDBC. Every attribute of `@SqlConfig` other than the two transaction ones
exists because that parser has defaults, and your script may not match them. This chunk is
about what the parser does, what each dial changes, and how global and local configuration
combine; [04c2](04c2-error-modes-and-half-failed-scripts.md) takes it from there to what
happens when a statement fails.**

## The parser, and why "it works in `psql`" proves nothing

`ScriptUtils` is the class doing the work, and its documented behaviour is unambiguous:
statement separators and comments are **removed** before the individual statements are
executed. The separator is resolved in a fixed priority order:

1. a custom separator, if `@SqlConfig(separator = …)` supplied one;
2. otherwise `ScriptUtils.DEFAULT_STATEMENT_SEPARATOR`, which is `";"`;
3. otherwise `ScriptUtils.FALLBACK_STATEMENT_SEPARATOR`, `"\n"` — used, per the javadoc,
   *"if neither a custom separator nor the `DEFAULT_STATEMENT_SEPARATOR` is present in a
   given script"*.

That third rule is worth stopping on. A script with **no semicolon anywhere** is not
treated as one statement; it is split **on newlines**. A prettily wrapped single `INSERT`
with no trailing semicolon therefore becomes several broken fragments, each sent to the
driver on its own.

The escape hatch is a sentinel value:

> `ScriptUtils.EOF_STATEMENT_SEPARATOR` = `"^^^ END OF SCRIPT ^^^"` — *"End of file (EOF)
> SQL statement separator. May be supplied to denote that an SQL script contains a single
> statement (potentially spanning multiple lines) with no explicit statement separator."*

```java
@Sql(scripts = "/db/one-big-statement.sql",
     config  = @SqlConfig(separator = ScriptUtils.EOF_STATEMENT_SEPARATOR))
```

The classic failure this parser produces on PostgreSQL is a function body:

```sql
CREATE FUNCTION account_balance(bigint) RETURNS numeric AS $$
BEGIN
    RETURN (SELECT balance FROM account WHERE id = $1);
END;
$$ LANGUAGE plpgsql;
```

`ScriptUtils` splits on `;`, and there are semicolons **inside** the dollar-quoted body. The
statement the driver receives is truncated at the first one and is not valid SQL. It runs
in `psql` because `psql` understands dollar quoting; it fails under `@Sql` because Spring's
splitter is a simple scanner and does not. The fixes, in order of preference: put the
function in a real migration instead of a test fixture; or give the script its own `@Sql`
with `separator = "@@"` and end each statement with `@@`; or use
`EOF_STATEMENT_SEPARATOR` if it really is one statement.

Comments are stripped by prefix, not by parsing, with the same consequence: a `--` inside a
string literal is a comment as far as the parser is concerned.

## Every attribute, with its real default

`@SqlConfig` attributes carry a placeholder default, and the reference explains why:

> *"Due to the rules defined for annotation attributes in the Java Language Specification,
> it is, unfortunately, not possible to assign a value of `null` to an annotation
> attribute. Thus, in order to support overrides of inherited global configuration,
> `@SqlConfig` attributes have an explicit default value of either `""` (for Strings), `{}`
> (for arrays), or `DEFAULT` (for enumerations)."*

So the declared default and the effective default are different things:

| Attribute | Declared | Effective |
|---|---|---|
| `separator` | `""` | `";"`, falling back to `"\n"` |
| `commentPrefix` / `commentPrefixes` | `""` / `{}` | `"--"` / `["--"]` |
| `blockCommentStartDelimiter` | `""` | `"/*"` |
| `blockCommentEndDelimiter` | `""` | `"*/"` |
| `encoding` | `""` | the **platform** encoding |
| `errorMode` | `DEFAULT` | `FAIL_ON_ERROR` |
| `transactionMode` | `DEFAULT` | `INFERRED` — see [05a3](05a3-truncating-and-deleting.md) |
| `dataSource` | `""` | discovered by convention |
| `transactionManager` | `""` | discovered by convention |

Two of those deserve more than a table row.

**`encoding` defaults to the platform encoding, not to UTF-8.** JDK 18 made
`file.encoding` default to UTF-8 for file I/O, which removes most of this problem on a
modern JDK — but the attribute still says *"if different from the platform encoding"*, and
a build that sets `-Dfile.encoding` explicitly, or a container image with a `POSIX` locale,
can still put you somewhere else. A fixture containing an accented name or a currency
symbol is the thing that finds out. If your fixtures contain any non-ASCII data at all,
write `encoding = "UTF-8"` and stop thinking about it.

**`commentPrefix` and `commentPrefixes` are mutually exclusive.** The javadoc says the
singular *"may **not** be used in conjunction with `commentPrefixes()`, but it may be used
instead of"* it. Use the plural when a script mixes `--` and `#`.

## Global versus local `@SqlConfig`

`@SqlConfig` can be declared in two places, and the reference names them:

> *"When declared as a class-level annotation on an integration test class, `@SqlConfig`
> serves as global configuration for all SQL scripts within the test class hierarchy. When
> declared directly via the `config` attribute of the `@Sql` annotation, `@SqlConfig`
> serves as local configuration for the SQL scripts declared within the enclosing `@Sql`
> annotation."*

and the merge rule is per-attribute, not per-annotation:

> *"Global `@SqlConfig` attributes are inherited whenever local `@SqlConfig` attributes do
> not supply an explicit value other than `""`, `{}`, or `DEFAULT`. Explicit local
> configuration, therefore, overrides global configuration."*

```java
@JdbcTest
@SqlConfig(encoding = "UTF-8", errorMode = FAIL_ON_ERROR)   // global, whole hierarchy
class LedgerTest {

    @Test
    @Sql(scripts = "/db/functions.sql",
         config  = @SqlConfig(separator = "@@"))            // local: separator only
    void createsTheFunction() { }                           // encoding still UTF-8
}
```

This is the one place in `@Sql` where the defaults behave the way people *expect* merging
to behave — and it is worth noticing that `@SqlMergeMode`, which governs the `@Sql`
declarations themselves, does the opposite. Attribute-level inheritance for `@SqlConfig`;
whole-declaration override for `@Sql`. Two different rules on the same annotation family.

Class-level `@SqlConfig` is the right home for `encoding`, and usually for
`transactionMode` when you have decided the suite's cleanup strategy once.

## `dataSource` and `transactionManager`: only needed when the convention runs out

Both default to `""`, and the javadoc lists exactly when that is enough. For `dataSource`,
the empty default requires that one of the following is true: an explicit bean name is
defined in a global `@SqlConfig`; the data source can be retrieved from the transaction
manager by reflectively invoking a public `getDataSource()` on it; there is only one bean
of type `DataSource` in the context; or the `DataSource` to use is named `"dataSource"`.
The rules for `transactionManager` are the same shape, with the addition that implementing
`TransactionManagementConfigurer` also settles it.

The practical reading: **you only set these in a multi-datasource application**, and in
that case you must set them, because "there is only one" and "it is named `dataSource`"
have both stopped being true and the listener will pick whichever it finds — or fail.


## Where this connects

- Where the script comes from: [04 · Fixtures in the database](04-fixtures-in-the-database.md).
- Why `config` being per-`@Sql` forces separate declarations:
  [04b2 · Groups and merge mode](04b2-groups-and-merge-mode.md).
- Error modes, half-failed scripts and how to see what actually ran:
  [04c2 · Error modes and half-failed scripts](04c2-error-modes-and-half-failed-scripts.md).
- `transactionMode`, and why a cleanup script vanishes:
  [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- Whether the fixture should be SQL at all:
  [04d · SQL versus repository fixtures](04d-sql-versus-repository-fixtures.md).
- Engine differences that make a fixture script portable-looking and not portable:
  [07 · Testcontainers → 01c](../07-testcontainers/01c-what-h2-gets-wrong.md).

## Gotchas

**★ Spring splits the script, so valid SQL can still fail.**
`ScriptUtils` scans for the separator and strips comments; it does not parse SQL.
Dollar-quoted PL/pgSQL bodies, `BEGIN … END;` blocks and any statement containing a literal
semicolon are cut in the wrong place. Use `separator = "@@"` for that script, or
`ScriptUtils.EOF_STATEMENT_SEPARATOR` if it is a single statement, or move the DDL into a
real migration where the migration tool's own parser handles it.

**★ A script with no semicolons is split on newlines, not treated as one statement.**
The documented fallback separator is `"\n"`, used when the default `";"` does not appear in
the script at all. A single multi-line `INSERT` without a trailing semicolon therefore
arrives at the driver as several fragments, each syntactically invalid. Always terminate
statements, including the last one.

**★ `encoding` defaults to the platform encoding, not UTF-8.**
Modern JDKs default file I/O to UTF-8, which hides this most of the time — but a build that
sets `-Dfile.encoding` explicitly, or a container image with a `POSIX` locale, can still
mangle accented characters in a fixture, and the resulting failure is an assertion about a
name rather than anything mentioning encoding. Set `encoding = "UTF-8"` in a global
`@SqlConfig` once and forget it.

**★ `commentPrefix` and `commentPrefixes` cannot both be set.**
They are mutually exclusive by javadoc — the singular *"may not be used in conjunction
with"* the plural. Setting both is an annotation-configuration error that surfaces at
context bootstrap, pointing at the annotation rather than at the script.

**★ Comment stripping is prefix matching, not parsing.**
A `--` inside a string literal, or a `/*` inside a quoted value, is treated as a comment
delimiter and everything after it on that line — or until the block-comment terminator —
disappears. Fixture data containing SQL-looking text, a URL fragment or a serialised
expression can therefore lose part of a statement, and the resulting error names a syntax
problem at a position that does not correspond to anything you can see in the file.

**★ A local `@SqlConfig` inherits every attribute you did not set from the global one.**
That is the intended design, and it means a class-level `@SqlConfig` added to fix one
script silently applies to every script in the whole class **hierarchy** — including the
subclasses of an abstract base test class, which is where "global" is broader than people
read it.

**★ `dataSource` and `transactionManager` are discovered by convention, and the convention
includes "there is only one".**
Adding a second `DataSource` bean to a test context — a read replica, a second schema, an
extra container — can break every `@Sql` in the suite at once, with an error about
ambiguity rather than about the bean that was added. In a multi-datasource context, name
both explicitly in a global `@SqlConfig`.

**★ Setting `separator` on an `@Sql` that lists several scripts changes it for all of them.**
`config` is per-annotation. Adding `separator = "@@"` because one script needs it turns the
other three into one enormous statement each, which fails with a syntax error nowhere near
the change you made. Give the odd script its own `@Sql`.

## Interview questions

**★ A fixture script runs fine in `psql` and fails under `@Sql`. What is your first hypothesis?**
That Spring's own parsing is the difference. `@Sql` does not hand the file to the database;
`ScriptUtils` splits it on the statement separator — `";"` by default, `"\n"` as a fallback
when no semicolon is present anywhere — and strips comments by prefix, then sends the
statements one at a time over JDBC. So anything the splitter does not understand breaks:
dollar-quoted function bodies, `BEGIN … END;` blocks, semicolons inside literals. I would
turn on DEBUG for `org.springframework.jdbc.datasource.init` to see the statements as sent,
then either set a custom `separator`, use `EOF_STATEMENT_SEPARATOR`, or move the DDL out of
the test fixture into a migration.

**★ Why does every `@SqlConfig` attribute default to an empty string or `DEFAULT` rather than to its real value?**
Because the Java Language Specification does not allow `null` as an annotation attribute
value, and Spring needs to distinguish "not specified" from "specified as the same value
the global declaration happens to use". The empty string, empty array and `DEFAULT` enum
constant are the sentinel for "not specified", which is what makes attribute-level
inheritance from a global `@SqlConfig` possible. The consequence for a reader is that the
declared default in the javadoc is never the effective default: you have to read each
attribute's prose to learn that the separator is really `";"` and the error mode is really
`FAIL_ON_ERROR`.

**★ Where do you put `@SqlConfig` and what changes depending on where?**
Class level makes it global for the whole test class hierarchy; inside `@Sql(config = …)`
makes it local to that one declaration. Merging is per attribute: a local declaration
overrides only the attributes it sets to something other than `""`, `{}` or `DEFAULT`, and
inherits the rest. So `encoding` and `transactionMode` belong at class level as a
suite-wide decision, while `separator` belongs on the one `@Sql` whose script needs it.
Note that this is the opposite of how `@Sql` itself merges, where a method-level
declaration replaces the class-level one wholesale — two different merge rules in one
annotation family, which is worth stating out loud when you explain it to someone.

**★ How would you load a PL/pgSQL function as part of a test fixture?**
Preferably not — a function is schema, and schema belongs in the migrations that also
create it in production, so the test exercises the same definition the application does. If
it genuinely has to be a fixture, give it its own `@Sql` with a `separator` that does not
occur inside the body, such as `"@@"`, and terminate each statement with that separator;
or, if the file contains exactly one statement, use `EOF_STATEMENT_SEPARATOR`. What does
not work is leaving the default `";"`, because the dollar-quoted body contains semicolons
and Spring's splitter does not know about dollar quoting.

**★ When do you have to set `dataSource` or `transactionManager` on `@SqlConfig`?**
When the discovery convention stops being able to decide. For the data source, an empty
value works if a global `@SqlConfig` names one, or the transaction manager exposes a public
`getDataSource()`, or there is exactly one `DataSource` bean, or the one to use is named
`dataSource`. The moment a test context has two — a read replica, a second schema, an extra
container — none of those hold and you must name it. The failure mode when you do not is
that `@Sql` breaks everywhere at once with an ambiguity error, which does not point at the
bean somebody just added.

**★ Your fixture contains a customer named `Zoë` and the assertion fails on an unfamiliar character. Where do you look?**
At `@SqlConfig(encoding = …)`. It defaults to the platform encoding rather than to UTF-8,
so on any JVM or CI image whose default charset is not UTF-8 the file is decoded wrongly
before it ever reaches the driver. Modern JDKs default file I/O to UTF-8, so this is rarer
than it was, but an explicit `-Dfile.encoding` in the build or a `POSIX` locale in a
container image brings it straight back. Setting `encoding = "UTF-8"` in a class-level
`@SqlConfig` removes the whole category.

{/* FOOTER */}
