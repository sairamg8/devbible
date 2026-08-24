---
title: "SQL injection dies at the protocol layer, not at the escaping function"
sidebar_label: "5 · `PreparedStatement` and injection"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.PreparedStatement`
> and `java.sql.Statement`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the pgJDBC
> documentation *Issuing a Query and Processing the Result* and
> *Server Prepared Statements* (jdbc.postgresql.org/documentation/query/,
> .../server-prepare/). JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**Everyone knows the rule — use `PreparedStatement`, never concatenate. Far fewer
people can say *why it works*, and that gap is where the remaining injection bugs
live. It is not that JDBC escapes your string better than you would. It is that a
parameterized statement never puts your value into the SQL text at all: the query
and the parameters travel to PostgreSQL as **separate messages in the wire
protocol**, the server parses and plans the SQL before it has ever seen a
parameter value, and by the time your string arrives the grammar is already
decided. A quote inside the value cannot terminate a literal because there is no
literal — there is a placeholder and a typed value bound to it. That distinction
is what makes the defence total rather than probabilistic, and it is also what
tells you exactly where the defence *stops*, which is the more useful half of this
chunk and the subject of [chunk 6](07-what-a-parameter-can-be.md).**

## The vulnerable code, and what an attacker sends

Here is the bug, in the form it actually appears — not a contrived example, a
plausible search endpoint:

```java
// ❌ every one of these is a vulnerability
String sql = "SELECT id, email FROM customers WHERE email = '" + email + "'";
try (Statement st = c.createStatement();
     ResultSet rs = st.executeQuery(sql)) { ... }
```

Now the input. If `email` is `alice@example.com`, the SQL is fine. If it is:

```
' OR '1'='1
```

the string the server receives is:

```sql
SELECT id, email FROM customers WHERE email = '' OR '1'='1'
```

which is a syntactically valid query returning **every customer**. The attacker
did not break anything; they supplied text that closed the literal and continued
the expression, and the concatenation obediently built exactly the query they
wrote.

The escalation from there is not subtle. With this input:

```
'; UPDATE customers SET email = 'attacker@evil.test' WHERE id = 1; --
```

pgJDBC's `Statement.execute` on a simple-protocol path will happily send multiple
statements separated by semicolons, and the trailing `--` comments out whatever
your code appended. And this one:

```
' UNION SELECT id, password_hash FROM users --
```

turns a customer search into a credential dump, because a `UNION` only needs the
column count and compatible types to match — which an attacker discovers by
probing, one error message at a time.

🔴 **Note what the attacker never needed:** a database account, a stack trace, or
knowledge of your schema beyond what error messages leaked. The concatenation did
all the work.

## The fix, and the mechanism

```java
// ✅
String sql = "SELECT id, email FROM customers WHERE email = ?";
try (PreparedStatement ps = c.prepareStatement(sql)) {
    ps.setString(1, email);
    try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) { ... }
    }
}
```

Now send `' OR '1'='1` as `email`. The result is not a syntax error and not a
bypass — it is **zero rows**, because the query means "find the customer whose
email address is the eleven-character string `' OR '1'='1`", and no such customer
exists. The value was never SQL. It was a parameter.

What happens on the wire, in pgJDBC's default *extended query protocol*:

| Message | Contains | When |
|---|---|---|
| **Parse** | the SQL text with `$1` placeholders | before any value is known |
| **Bind** | the parameter values, typed, length-prefixed, as binary or text | after the statement is parsed |
| **Describe / Execute** | run it | — |

🔴 **Parsing and planning happen at Parse time, before Bind.** The parse tree is
fixed before the server has seen your string. A value cannot alter the shape of a
statement that has already been parsed, and there is no re-parse step that would
give it a second chance. That is the whole argument, and it is why this is a
structural defence rather than a filtering one.

Contrast that with escaping. An escaping function has to be correct for the
server's current `standard_conforming_strings` setting, the client encoding, the
`E''` escape-string syntax, dollar-quoting, and every context the value might
land in. It is a function that must be right every time against an adversary who
only needs it to be wrong once. Parameter binding does not participate in that
game at all.

## What people reach for instead, and why each is wrong

| Attempted fix | Why it fails |
|---|---|
| A hand-written `escape()` that doubles single quotes | must be correct for every encoding, quoting mode and context; one gap is total |
| A blocklist of `'`, `--`, `;`, `UNION` | rejects legitimate input (`O'Brien`) and misses encodings, comments and case games |
| `String.format` / text blocks with `%s` | identical to concatenation with nicer syntax |
| An ORM, on the assumption it is automatic | true for generated SQL, false the moment someone concatenates into a native query or a JPQL string |
| Input validation alone | necessary and good, but it is a business-rules layer, not an injection defence |

🔴 **Validation and parameterization are different jobs.** Validate because an
email should look like an email; parameterize because the database must never
interpret user text as syntax. Doing the first is not doing the second.

## Where the defence genuinely stops

Parameter binding protects *values*. It cannot protect anything the parser needs
to know before Bind: table names, column names, the sort column, `ASC`/`DESC`,
operators, whole clauses. `ORDER BY ?` does not do what you want, and
`FROM ?` does not work at all. Those are real requirements with a real answer,
and the answer is an allow-list — which is exactly why
[chunk 6](07-what-a-parameter-can-be.md) exists rather than being a paragraph
here.

## Gotchas

**⚠️ A `PreparedStatement` with the value concatenated in anyway**
**Symptom:** a code review passes because the class name is right.
**Cause:** `prepareStatement("... WHERE email = '" + email + "'")` is a
`PreparedStatement` and is fully vulnerable. The type is not the defence; the
placeholder is.
**Fix:** grep for string concatenation inside `prepareStatement(` arguments. That
grep finds real bugs in real codebases.

**⚠️ "It's an internal admin tool, the input is trusted"**
**Symptom:** the injection is reachable through an internal page that later gets
exposed, or through a value that came from a webhook, a CSV import, or another
service's database.
**Cause:** trust boundaries move; the concatenation does not.
**Fix:** parameterize unconditionally. There is no input cheap enough to be worth
the exception.

**⚠️ Leaking the database error message to the caller**
**Symptom:** an attacker probes column counts and types using your 500 responses.
**Cause:** the `SQLException` message reaching the HTTP response body.
**Fix:** log it, do not return it —
[Phase 5's exception translation](../../phase-5-exceptions/04-custom-exceptions-translation.md)
is the shape, and [chunk 21](21-sqlexception.md) is the JDBC-specific version.

## Interview questions

**★ Why does `PreparedStatement` prevent SQL injection? Answer at the protocol
level.**
Because the SQL text and the parameter values are sent as separate protocol
messages, and the server parses and plans the statement before it has seen any
value. In PostgreSQL's extended query protocol a Parse message carries the SQL
with `$n` placeholders, and a later Bind message carries the typed values. Once
Parse has produced a parse tree, nothing in a value can change the shape of the
statement, because there is no re-parse. So a quote in a value cannot terminate a
literal — there is no literal, there is a placeholder. This is why the defence is
structural rather than probabilistic: it does not depend on an escaping function
being correct for the current encoding and quoting mode, it depends on the value
never being part of the SQL grammar at all.

**★ Is a `PreparedStatement` automatically safe?**
No. It is safe with respect to the values you bind, and completely unsafe with
respect to anything you concatenated into the SQL string before calling
`prepareStatement`. `prepareStatement("SELECT * FROM t WHERE x = '" + v + "'")` is
a `PreparedStatement` and is exactly as vulnerable as the `Statement` version.
The defence is the placeholder, not the class. It also does not extend to
identifiers — table names, column names, sort direction — which cannot be
parameters at all, and which need an allow-list instead.

**★ An attacker sends `' OR '1'='1` to a parameterized query. What happens?**
Nothing interesting: the query returns zero rows. The parameter is bound as the
eleven-character string `' OR '1'='1`, and the query asks for the row whose column
equals that exact string. There is no customer with that email address, so there
are no results. That non-event is the entire point — the input is data, and data
that happens to look like SQL is still data. Against the concatenated version the
same input produces a `WHERE` clause that is always true and returns the whole
table.

**★ Why not just write a good escaping function?**
Because it has to be right against an adversary who only needs it to be wrong
once, and its correctness depends on server and client state you do not control
from the escaping function — `standard_conforming_strings`, the client encoding,
whether the value lands inside a normal literal or an `E''` escape string or a
dollar-quoted block or an identifier. Multi-byte encodings have historically
produced escapes that were correct byte-wise and wrong character-wise. Parameter
binding sidesteps the entire class: there is no context to get right because the
value never enters the SQL text. The only situation where you write escaping code
is quoting an *identifier*, and even there the right answer is usually an
allow-list rather than quoting.

**★ Does using an ORM mean you are safe from injection?**
For the SQL the ORM generates, yes — it parameterizes. But every ORM has an escape
hatch for native queries and dynamic JPQL, and that is where the injections are.
A `@Query` with a concatenated fragment, a `Criteria` API misused to inject an
order-by, a native query built with `String.format` — all of these are ordinary
injection bugs wearing a framework. The ORM also does not solve the identifier
problem: dynamic sorting and dynamic filtering by column name are exactly the
requirements people reach for string building to satisfy, and they need the same
allow-list they would need with raw JDBC.

**★ How would you find injection bugs in an existing codebase?**
Grep first, then reason. The high-yield patterns are string concatenation or
`String.format` inside the argument to `createStatement().executeQuery(`,
`prepareStatement(`, `@Query(`, or a native-query builder; anything appending to
a `StringBuilder` that is later executed; and any method whose parameter name is
`orderBy`, `sortBy`, `column`, `table` or `filter`, because those signal an
identifier flowing through. Then look at the query builders specifically, since a
half-fixed builder that parameterizes values and concatenates identifiers is the
most common surviving instance. Static analysis helps, but the map-of-filters
pattern defeats most taint tracking, so read the builders by hand.

---

← Prev: [A `Connection` is expensive](04-connection-is-expensive.md) · Index: [JDBC](README.md) · Next → [The `PreparedStatement` API](06-the-preparedstatement-api.md)
