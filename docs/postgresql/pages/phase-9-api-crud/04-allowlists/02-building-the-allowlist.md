---
title: "Building the allowlist"
sidebar_label: "02 · Building the allowlist"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex5-filter-sort.mjs`.

**Chapter 2 of [Sort and filter allowlists](README.md).** Chapter 1 showed that an
identifier can neither be a parameter nor be concatenated. This is what to do
instead.

## The fix: a map from request keys to SQL you wrote

An allowlist is not validation. Do not sanitise the user's string, do not regex it
for suspicious characters, do not check it against `information_schema`. **Use it
as a key into an object whose values are SQL text you authored.** The user's input
never reaches the query at all.

```js
const SORTABLE = {
  name:    'name',
  price:   'price',
  created: 'created_at',   // API name deliberately differs from the column
};

function orderClause(sortKey = 'created', dir = 'asc') {
  const col = SORTABLE[sortKey];
  if (!col) {
    throw Object.assign(new Error(`unsortable field: ${sortKey}`), {status: 400});
  }
  const order = dir === 'desc' ? 'DESC' : 'ASC';
  return `ORDER BY ${col} ${order}, id ASC`;   // id is the stable tiebreaker
}
```

```console
=== 6. allowlist ===
sort=price asc  → fig, apple, cherry, Elderberry
sort=name desc  → fig, date, cherry, apple
sort=<payload>  → rejected before SQL: 400 unsortable field: name; DROP TABLE fs_items; --
```

The properties that make this safe, each of which matters:

- **The value is a lookup, not a transformation.** `SORTABLE[sortKey]` either
  returns a string you typed into the source file, or `undefined`. There is no
  input-dependent path that reaches the SQL.
- **Direction is a ternary, never interpolated.** `dir === 'desc' ? 'DESC' : 'ASC'`
  yields one of two literals. Interpolating `${dir}` after checking it "looks like"
  a direction is the same class of bug in miniature.
- **The map is also your API contract.** Keys are the names clients send, values
  are the columns — so renaming a column is a one-line change, and internal column
  names are not leaked to the API.
- **A tiebreaker is appended unconditionally.** Without it, pagination over a
  non-unique sort column silently duplicates and drops rows — measured in
  [`list` with filtering, sorting and pagination](../02-list-endpoint.md).

Use a `Map`, or a `null`-prototype object, if the keys can be arbitrary user
strings — a plain object literal will happily resolve `?sort=constructor` or
`?sort=__proto__` to something truthy that is not a column.

```js
const SORTABLE = Object.assign(Object.create(null), {name: 'name', price: 'price'});
// or: const SORTABLE = new Map([['name', 'name'], ['price', 'price']]);
```

## Filters need the same treatment

Sorting is where this is famous, but any endpoint accepting a *field name* has the
identical hole — `?filter[status]=active`, `?groupBy=owner`, `?fields=id,name`.

```js
const FILTERABLE = Object.assign(Object.create(null), {
  status:   {col: 'status', op: '='},
  owner:    {col: 'owner',  op: '='},
  minPrice: {col: 'price',  op: '>='},
});

function buildWhere(query) {
  const where = [];
  const params = [];
  for (const [key, raw] of Object.entries(query)) {
    const spec = FILTERABLE[key];
    if (!spec) continue;                       // unknown filter: ignore or 400
    params.push(raw);
    where.push(`${spec.col} ${spec.op} $${params.length}`);   // col and op from the map
    }
  return {where, params};
}
```

Both halves come from the map: the column *and* the operator. Letting the client
choose an operator string (`?op=>=`) is the same vulnerability wearing a different
hat.

## The escape hatch: `quote_ident` and `format('%I')`

Occasionally an identifier is genuinely dynamic — a table name per tenant, a
migration tool, a column discovered from the catalog. PostgreSQL has a correct
quoting function; use it *in addition to* an allowlist, never instead of one.

```js
const {rows} = await pool.query(
  `SELECT quote_ident($1) AS a, quote_ident($2) AS b, format('ORDER BY %I', $2) AS c`,
  ['name', 'name; DROP TABLE fs_items; --'],
);
```

```console
=== 7. format/quote_ident for a genuinely dynamic identifier ===
{
  a: 'name',
  b: '"name; DROP TABLE fs_items; --"',
  c: 'ORDER BY "name; DROP TABLE fs_items; --"'
}
```

The payload is neutralised — wrapped in double quotes, it is now a single
identifier, and the `;` and `--` are just characters inside a name. The statement
will fail with `42703 column … does not exist` rather than dropping anything.

Note what quoting does **not** do: it does not check that the column exists, that
the caller may see it, or that sorting by it is sensible. An attacker can still
name any column that does exist — including one you never meant to expose ordering
on, which is an information leak (sort by `password_hash` and read the ordering).
`pg.escapeIdentifier(str)` does the same job in JavaScript when you need the text
before sending it.

`%I` in `format()` is the identifier placeholder; `%L` is the literal one. Mixing
them up is how a "safe" dynamic query becomes injectable, since `%s` is plain
substitution with no quoting at all.
## Trade-off

An allowlist costs you a maintained map: every new sortable column is a code
change, and clients cannot sort by arbitrary fields. That is the entire point —
the set of sortable columns is a deliberate API decision, and it is also the set
of columns you have agreed to index. An endpoint that sorts by anything is an
endpoint that sequentially scans on anything.

The generic alternative — reflecting over `information_schema` to decide what is
sortable — removes the maintenance but re-adds the information leak, exposes
internal column names as API surface, and still needs quoting. It is the right
answer only for genuinely generic tools (an admin table browser), and those should
be behind authorization strong enough that the leak does not matter.

## Gotchas

**Symptom:** `?sort=constructor` or `?sort=__proto__` returns rows instead of 400
**Cause:** Prototype keys resolve to truthy values on a plain object literal.
**Fix:** `Object.create(null)`, a `Map`, or `Object.hasOwn(SORTABLE, key)`.

**Symptom:** Sorting by an unexpected column reveals data
**Cause:** Quoting was used without an allowlist, so any real column is sortable.
**Fix:** `quote_ident` is a quoting function, not an authorization check. Allowlist
first.

**Symptom:** A `format()`-built query is injectable
**Cause:** `%s` (plain substitution) used where `%I` (identifier) or `%L` (literal)
was needed.
**Fix:** `%I` for identifiers, `%L` for values; never `%s` for anything
user-influenced.

**Symptom:** A sortable column makes the endpoint slow
**Cause:** The allowlist grew a column with no matching index.
**Fix:** Treat the allowlist as the list of columns you have promised to index.

## Interview questions

**★ How do you implement `?sort=` safely?**
A map from request keys to SQL text you wrote, plus a ternary for the direction.
The user's string is only ever used as a lookup key; an unknown key is a 400. Never
sanitise-and-interpolate — use the input to *select* SQL, never to *build* it.
Append a unique tiebreaker so pagination stays stable.

**★ Isn't `quote_ident` enough on its own?**
No. It guarantees the string is treated as one identifier, so it stops the stacked
statement — but it does not check that the column exists, that the caller is
allowed to see it, or that it is indexed. An attacker can still order by any real
column, which leaks information about columns you never exposed. Quoting is for
identifiers you have already decided are legitimate.

**★ What is the difference between `%I`, `%L` and `%s` in `format()`?**
`%I` quotes as an identifier (double quotes, doubling internal ones), `%L` quotes
as a literal (single quotes, handling NULL as the unquoted `NULL`), and `%s` is
plain substitution with no quoting. `%s` on user-influenced input is injection.

**Why do filter field names need an allowlist too, not just sort?**
Any request parameter that becomes an *identifier* has the same hole — `groupBy`,
`fields`, `filter[column]`. So does letting the client pick the *operator*: a query
string that supplies `>=` as text is building SQL from input just as surely as one
supplying a column name. Both the column and the operator come from the map.

---

← [The two failure modes](01-two-failure-modes.md) · Next → [Transactions in a request](../05-transactions-request.md)
