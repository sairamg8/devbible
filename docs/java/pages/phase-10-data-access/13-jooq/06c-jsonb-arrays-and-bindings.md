---
title: "jOOQ treats jsonb as an opaque typed value rather than a parsed document, arrays as a value constructor, and everything JDBC cannot represent at all as a custom Binding registered once in the generator"
sidebar_label: "06c · JSONB, arrays and bindings"
sidebar_position: 23
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *JSONB data type*
> ([data-type-jsonb](https://www.jooq.org/doc/latest/manual/sql-building/data-types/built-in-data-types/data-type-jsonb/)),
> *JSON functions*
> ([column-expressions/json-functions](https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/json-functions/)),
> *ARRAY value constructor*
> ([array-value-constructor](https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/array-value-constructor/))
> and *Custom data type bindings*
> ([custom-data-type-bindings](http://www.jooq.org/doc/latest/manual/code-generation/custom-data-type-bindings/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**PostgreSQL's interesting column types are exactly the ones JDBC has no opinion about. `jsonb`
is, in the manual's words, a *"pre-processed, binary-stored JSON document"* that *"has no direct
representation in JDBC"*; arrays are a type modifier rather than a type; and `hstore` and PostGIS
geometries are not in the standard at all. jOOQ's answer is three mechanisms of increasing weight —
a built-in type, a value constructor, and a `Binding` you write once — and knowing which one a
column needs saves a lot of guessing.**

## `jsonb` — a typed value, not a parsed document

jOOQ models it as `org.jooq.JSONB`, with `SQLDataType.JSONB` as the type. **`JSONB` is a wrapper
around the document's text.** jOOQ does not parse it, does not give you a tree, and does not care
what is inside — which is exactly right for a database type whose contents are the application's
business.

**So mapping `jsonb` onto a domain object is a converter's job**, not a jOOQ feature: a
`Converter` between `JSONB` and your type, registered as a forced type so every query gets it —
**[04c · Mappers and converters](04c-record-mappers-and-converters.md)** and
**[02c · Shaping the generated API](02c-shaping-the-generated-api.md)**. That is a deliberate
division of labour: jOOQ moves the document, your serialiser interprets it.

### Reaching inside the document, in SQL

The manual's JSON function set is substantial, and *"most functions are overloaded with a `JSON`
and `JSONB` variant"*:

| Purpose | Functions |
|---|---|
| Attribute access | `JSON_GET_ATTRIBUTE`, `JSON_GET_ATTRIBUTE_AS_TEXT` |
| Element access | `JSON_GET_ELEMENT`, `JSON_GET_ELEMENT_AS_TEXT` |
| Inspection | `JSON_KEYS`, `JSON_KEY_EXISTS`, `JSON_ARRAY_LENGTH` |
| Extraction | `JSON_VALUE`, `JSON_QUERY` |
| Construction | `JSON_OBJECT`, `JSON_ARRAY`, `JSON_ARRAY` from a query |
| Modification | `JSON_SET`, `JSON_INSERT`, `JSON_REPLACE`, `JSON_REMOVE` |

🔴 **The two attribute-access forms are PostgreSQL's `->` and `->>` and the distinction is the one
that trips people.** `JSON_GET_ATTRIBUTE` renders `->` and gives you **JSON**; the `_AS_TEXT`
variant renders `->>` and gives you **text**. Comparing the first against a string compares a JSON
value with a quoted JSON string, and the predicate quietly matches nothing.

**Filtering on a `jsonb` attribute in SQL is the point of storing it as `jsonb` rather than
`text`.** It is also what a GIN index makes fast, and none of that is available if the document is
parsed in Java after the rows arrive.

## Arrays

jOOQ has an **`ARRAY` value constructor**, described as collecting *"the results of a
single-column, non scalar subquery into a single nested collection value with `ARRAY` data type
semantics"*. The manual's own example:

```java
array(
    selectDistinct(BOOK.language().CD)
    .from(BOOK)
    .where(BOOK.AUTHOR_ID.eq(AUTHOR.ID))
).as("books")
```

**Note what that example also demonstrates** — `BOOK.language().CD` is an implicit path join from
**[03d · Implicit joins](03d-implicit-joins.md)**, inside an array constructor, inside a
correlated subquery. The pieces compose.

**`array(...)` versus `multiset(...)`:** an array holds **one column**; a multiset holds **whole
records**. If the nested collection is a list of ids, tags or codes, the array is simpler and the
value arrives as a Java array. If it is a list of objects, you want
**[04b · Nested collections with MULTISET](04b-nested-collections-with-multiset.md)**.

⚠️ **ARRAY is not in the manual's built-in data type list**, because it is a modifier on another
type rather than a type of its own. That is worth stating plainly rather than implying jOOQ has a
dedicated array chapter it does not have.

## Custom bindings — for what JDBC cannot represent at all

`hstore`, PostGIS `geometry`, a custom `CREATE TYPE`: JDBC has no mapping, so neither converters
nor built-in types help. The mechanism is an **`org.jooq.Binding`**, registered as a forced type
in the generator.

A `Binding` sits lower than a `Converter`. A converter transforms a value jOOQ already knows how
to read and write; a binding decides **how the value is read from and written to JDBC in the first
place** — the SQL rendered for the bind variable, how the parameter is set on the
`PreparedStatement`, and how the value is retrieved from the `ResultSet`.

```xml
<forcedType>
  <userType>org.locationtech.jts.geom.Geometry</userType>
  <binding>com.example.db.PostgisGeometryBinding</binding>
  <includeTypes>geometry</includeTypes>
</forcedType>
```

**Once registered, the generated column is typed as your class**, everywhere, and no query has to
know the type was unusual. That is the payoff, and it is why a binding is worth the ceremony for a
type the schema uses widely.

**The decision, in one line:** built-in type if jOOQ has one · converter if JDBC can carry it and
you want a different Java type · binding if JDBC cannot carry it at all.

## Gotchas

**★ `->` and `->>` are not interchangeable, and the mistake is silent.**
`JSON_GET_ATTRIBUTE` yields JSON; the `_AS_TEXT` form yields text. Compare a JSON result against a
Java `String` and you are comparing `"value"` — quotes included — with `value`.

**★ `JSONB` is opaque, so jOOQ cannot validate the document.** Storing malformed JSON fails at the
database, not in Java, and the error arrives at execution.

**★ A converter over `jsonb` runs per row and can throw mid-fetch.** Deserialising a document whose
shape changed in an old row takes the whole query down — the per-row conversion failure from
**[04c · Mappers and converters](04c-record-mappers-and-converters.md)**.

**★ Filtering in Java after fetching `jsonb` throws away the reason you chose `jsonb`.** The
predicate belongs in SQL, where an index can serve it. Fetching every document and filtering in a
stream is a full scan with extra steps.

**★ `jsonb` reorders keys and drops duplicates; `json` preserves the text.** That is PostgreSQL's
behaviour, not jOOQ's, and it surprises people who round-trip a document and compare strings.

**★ `array(...)` collects one column only.** Reaching for it with a two-column subquery is a
compile-time or render-time failure, and the answer is `multiset`.

**★ An array column's Java type is an array, with all that implies.** `equals`, `hashCode` and
`toString` on Java arrays are identity-based. A DTO holding one and relying on value equality is
quietly wrong.

**★ A `Binding` is a real class you must maintain.** It has to handle rendering, binding,
registering an out parameter and reading a result. Writing one for a type used in two columns is
usually not worth it; a converter or plain SQL is.

**★ Forced types match by pattern, so a binding can capture more columns than intended.**
`<includeTypes>geometry</includeTypes>` catches every `geometry` column in the schema, which is
usually right and is worth checking against the generation log the first time.

**★ Bindings and converters are configured in the same place and are not the same thing.** Both
appear as `<forcedType>` children. Picking `<converter>` where a `<binding>` was needed produces a
JDBC-level error that does not mention either.

**★ A PostGIS or `hstore` binding pins you to PostgreSQL.** So does most of this page. That is a
fine choice made deliberately and an unpleasant surprise made by accident.

**★ jOOQ's JSON API is described as *"PostgreSQL inspired"*, which is not the same as
PostgreSQL-identical.** Some functions are emulated on other dialects, and the emulation's
semantics are the dialect's. Verify anything load-bearing against the function's own manual page
rather than against PostgreSQL's documentation.

## Interview questions

**★ How does jOOQ represent a `jsonb` column?** As `org.jooq.JSONB`, an opaque wrapper around the
document's text. jOOQ does not parse it — the manual notes that a `jsonb` is a pre-processed,
binary-stored document with no direct representation in JDBC.

**★ So how do you get a domain object out of a `jsonb` column?** With a converter between `JSONB`
and your type — typically running your JSON library — registered as a forced type so every query
inherits it.

**★ What is the difference between `JSON_GET_ATTRIBUTE` and `JSON_GET_ATTRIBUTE_AS_TEXT`?** The
first renders PostgreSQL's `->` and returns JSON; the second renders `->>` and returns text.
Comparing the JSON form against a Java string compares a quoted JSON string with a bare one, and
matches nothing.

**★ Why filter on a `jsonb` attribute in SQL rather than in Java?** Because that is what the type
is for — the database can evaluate the predicate, and a GIN index can serve it. Fetching every
document to filter in a stream is a full scan.

**★ What does the `ARRAY` value constructor do?** Collects the results of a single-column,
non-scalar subquery into one array-typed value, via `DSL.array(...)`.

**★ When do you use `array(...)` and when `multiset(...)`?** `array` for a nested collection of one
column — ids, codes, tags. `multiset` for a nested collection of whole records.

**★ What is a `Binding`, and how does it differ from a `Converter`?** A converter transforms a value
jOOQ already knows how to read and write. A binding defines how the value is read from and written
to JDBC in the first place — the rendered SQL, the `PreparedStatement` parameter, the `ResultSet`
retrieval. Bindings are for types JDBC cannot carry, like PostGIS geometries or `hstore`.

**★ Where is a binding registered?** As a `<binding>` inside a `<forcedType>` in the generator
configuration, matched against a type or a column pattern. After that the generated column carries
your Java type everywhere.

**★ How do you choose between the three mechanisms?** Built-in type when jOOQ has one; converter
when JDBC can carry the value but you want a different Java type; binding when JDBC cannot carry
it at all.

**★ What is the risk of a pattern-matched forced type?** It matches more than you meant.
`<includeTypes>geometry</includeTypes>` claims every `geometry` column in the schema — usually
intended, and worth verifying against the generation output the first time.

**★ Does using these features cost you portability?** Yes, and deliberately. `jsonb`, PostGIS and
`hstore` are PostgreSQL. The value of jOOQ here is not dialect independence — it is having the
PostgreSQL feature available with the columns and types still checked.

**★ Is jOOQ's JSON API the same as PostgreSQL's?** The manual calls it *"PostgreSQL inspired"*.
Several functions are emulated on other dialects, and emulated semantics follow the dialect. For a
load-bearing claim, read the function's own manual page rather than assuming PostgreSQL's
behaviour carries.

{/* FOOTER */}
