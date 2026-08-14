---
title: "$regex"
sidebar_label: "04 · $regex"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [`$regex`](https://www.mongodb.com/docs/manual/reference/operator/query/regex/): the syntax
> forms and `$options` (`i` case-insensitive, `m` multiline anchors, `x` extended, `s` dot
> matches newline, `u` unicode — noted as redundant since UTF is enabled by default); that *"for
> case sensitive regular expression queries, if an index exists for the field, then MongoDB
> matches the regular expression for the values in the index. This can be faster than a
> collection scan"*; that **prefix expressions** starting with `^` or `\A` let MongoDB construct
> a range from the prefix, with `/^a/` able to *"stop scanning after matching the prefix"* while
> `/^a.*/` and `/^a.*$/` are *"slower"* despite using an index; and 🔴 *"case-insensitive indexes
> do not improve performance for `$regex` queries, as the `$regex` operator is not
> collation-aware and therefore cannot take advantage of such indexes"*.
> **Documentation-validated; no console blocks.**

```js
db.products.find({ name: { $regex: /^kettle/i } });
db.products.find({ name: /^kettle/ });                    // equivalent shorthand
db.products.find({ name: { $regex: "^kettle", $options: "i" } });
```

Three ways to write the same thing. The interesting question is not the syntax — it is **which
of these can use an index**, because the difference is between a seek and reading every
document.

## The index rules

**1 · Case-sensitive regex on an indexed field can use the index.** MongoDB matches the pattern
against the values *in the index*, which the Manual notes *"can be faster than a collection
scan"* — but note what that is: scanning index entries, not seeking to them.

**2 · A prefix expression is the good case.** A pattern anchored with `^` (or `\A`) followed by
simple characters lets MongoDB **construct a range** from that prefix and examine only that
part of the index:

```js
/^kettle/      // ✅ bounded range in the index
/kettle/       // ✗ every index entry (or every document) must be tested
```

The Manual is precise even within the good case: `/^a/` can *"stop scanning after matching the
prefix"*, while `/^a.*/` and `/^a.*$/` are *"slower"* although all three use an index. **Write
the simplest anchored pattern that expresses the requirement** — the trailing `.*` costs you
something for nothing.

**3 · 🔴 Case-insensitive is the one that surprises people.** *"Case-insensitive indexes do not
improve performance for `$regex` queries, as the `$regex` operator is not collation-aware and
therefore cannot take advantage of such indexes."*

So the natural instinct — create a case-insensitive index with a collation and use `/^kettle/i`
— **does not work**. The index exists and `$regex` cannot benefit from it.

## What to do about case-insensitive search

Three real options, in order of how often they are right:

**1 · Store a normalised field.** Write a lowercased copy at insert time and query it exactly:

```js
{ name: "Kettle 1.7L", nameLower: "kettle 1.7l" }
db.products.createIndex({ nameLower: 1 });
db.products.find({ nameLower: { $regex: /^kettle/ } });   // anchored, case-sensitive, indexed
```

Boring, and it turns the query back into the good case. The cost is one derived field kept in
step with its source ([Phase 3](../phase-3-schema-design/06-extended-reference.md)).

**2 · Use a collation on the index *and* the query** — for **equality and sorting**, not for
`$regex`. A collation with `strength: 2` gives case-insensitive equality that indexes properly.
The query must specify the same collation for the index to be used.

**3 · Use a real search index** — a text index, or Atlas Search — when the requirement is
actually "search", with stemming, ranking and multiple fields. A regex is a pattern matcher, not
a search engine, and past a certain point that difference is the whole problem.

## The options

| Option | Effect |
|---|---|
| `i` | case-insensitive — and the reason index use is lost |
| `m` | `^` and `$` match at line boundaries within the string |
| `x` | extended: whitespace and `#` comments in the pattern are ignored |
| `s` | `.` matches newlines |
| `u` | unicode — documented as redundant, since UTF is enabled by default |

## Two practical warnings

⚠️ **Escape user input.** A search box wired straight into `$regex` lets a user submit a pattern
with catastrophic backtracking, and the server evaluates it against every candidate value. Escape
regex metacharacters in anything that came from outside, or reject patterns entirely and match a
literal prefix.

⚠️ **A regex is a scan in disguise unless it is anchored.** On a large collection, an unanchored
`$regex` on a field with no index is a collection scan, and with an index it is still every index
entry. `explain()` will show it ([Phase 2](../phase-2-mongosh/04-explain.md)) — look at
`totalKeysExamined` against `nReturned`, which is where the cost is visible.

## Gotchas

**Symptom:** a case-insensitive search is slow no matter what index is created.
**Cause:** `$regex` is not collation-aware, so a case-insensitive index does not help it.
**Fix:** a normalised lowercase field with an anchored case-sensitive regex, a collation for
equality queries, or a real search index.

**Symptom:** `/kettle/` is far slower than `/^kettle/`.
**Cause:** only an anchored prefix can be turned into an index range; an unanchored pattern must
test every entry.
**Fix:** anchor it, or restructure the requirement — "contains" is a search problem.

**Symptom:** `/^a.*/` is slower than `/^a/` although both use the index.
**Cause:** documented — the simple prefix can stop scanning once the prefix stops matching.
**Fix:** drop the trailing `.*`.

**Symptom:** a user's search input hangs the server.
**Cause:** unescaped input evaluated as a pattern.
**Fix:** escape metacharacters, or match a literal prefix built from the input.

**Symptom:** a pattern with a `$` anchor behaves unexpectedly on multi-line values.
**Cause:** the `m` option changes what `^` and `$` mean.
**Fix:** set the options deliberately rather than copying a pattern from elsewhere.

**Symptom:** `$regex` matches nothing on a field that clearly contains the text.
**Cause:** the field holds an array, or the values are not strings — regex applies to string
values ([topic 03](./03-element-operators.md)).
**Fix:** check with `$type` first.

## Interview questions

**★ When can a `$regex` query use an index?**
When it is case-sensitive and anchored at the start. A prefix expression beginning with `^`
lets MongoDB build a range from the prefix and examine only that part of the index; the Manual
notes that `/^a/` can stop scanning once the prefix no longer matches, while `/^a.*/` is slower
even though it also uses the index. An unanchored pattern must be tested against every index
entry — a scan by another name.

**★ Why doesn't a case-insensitive index help a case-insensitive regex?**
Because, as the Manual states, `$regex` is not collation-aware and so cannot take advantage of
case-insensitive indexes. That is the trap: the index gets created, the query looks reasonable,
and performance never improves. The practical fixes are a normalised lowercase field queried
with an anchored case-sensitive pattern, a collation for equality-style matching, or a proper
text or Atlas Search index.

**★ How would you implement a "starts with" search box efficiently?**
Store a lowercased copy of the field, index it, escape the user's input, and query it with an
anchored case-sensitive regex built from that input. That keeps the query in the prefix case
which the index can serve, and it removes the user's ability to submit an expensive pattern.

**What are the risks of putting user input into `$regex`?**
An attacker can submit a pattern with catastrophic backtracking and have it evaluated against
every candidate value, which is a denial-of-service with no unusual privileges required. Escape
the metacharacters, or do not accept patterns at all.

**When should you stop using regex and use a text index?**
When the requirement is really search — matching words rather than character patterns, with
stemming, multiple fields or relevance ranking. A regex answers "does this string contain these
characters", which is a different question, and forcing it to behave like search is where the
performance goes.

---

← Prev: [Element operators — `$exists` and `$type`](./03-element-operators.md) ·
Index: [Phase 5](./README.md) ·
Next → [`$expr`](./05-expr.md)
