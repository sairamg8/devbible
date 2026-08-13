---
title: "tsvector and tsquery"
sidebar_label: "01 · tsvector and tsquery"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex45-search.mjs`.

**A document becomes a `tsvector`, a search becomes a `tsquery`, and `@@` asks
whether they match.** Both conversions are lossy and configurable, and almost
every full-text bug is a mismatch between how the two sides were converted.

## What `to_tsvector` produces

```console
$ node ex45-search.mjs
=== 1. what to_tsvector actually produces ===
english : 'dog':3 'fox':10 'jump':6 'lazi':9 'quick':5 'run':2
simple  : 'dogs':3 'foxes':10 'jumping':6 'lazy':9 'over':7 'quickly':5 'running':2 'the':1,8 'were':4
↑ english stems (running→run, foxes→fox) and drops stop words (the, were, over)
  simple lowercases and keeps everything, including "the"
```

Input: `The running dogs were quickly jumping over the lazy foxes`.

A `tsvector` is a **sorted set of lexemes with their positions**. Read the two
lines against each other and you can see everything the configuration does:

- **Stemming.** `running` → `run`, `foxes` → `fox`, `lazy` → `lazi`. That last one
  is not a typo — stems are not words, they are normalised forms, and `lazi` is
  what both `lazy` and `laziness` reduce to.
- **Stop words removed.** `the`, `were`, `over` are gone from `english`. They
  carry no search signal and would match everything.
- **Positions kept.** `'the':1,8` in the `simple` output — position is what makes
  phrase search possible.
- **Order is lexeme order, not document order.** The vector is a set.

`simple` does neither stemming nor stop-word removal. It is the right choice for
identifiers, product codes and tags — anything where `routers` must not match
`router`.

**The configuration is part of the data.** A document indexed as `english` and a
query parsed as `simple` will not match, because one side says `run` and the other
says `running`. Both sides must use the same configuration, every time.

```console
default_text_search_config = pg_catalog.english
```

That default is a **session setting**, which is why the one-argument
`to_tsvector(body)` exists and why it cannot be indexed — see
[the next chunk](02-indexing-and-ranking.md).

## The four query parsers

This is the decision that matters most for a real search box:

```console
=== 2. the four query parsers, on the same user input ===
to_tsquery             → 42601 syntax error in tsquery: "running foxes"
plainto_tsquery        'running foxes' → 'run' & 'fox'
phraseto_tsquery       'running foxes' → 'run' <-> 'fox'
websearch_to_tsquery   'running foxes' → 'run' & 'fox'
```

| Parser | Input it expects | Behaviour on user text |
|---|---|---|
| `to_tsquery` | **tsquery syntax** — `&`, `\|`, `!`, `<->` | **raises `42601`** |
| `plainto_tsquery` | plain words | ANDs them together |
| `phraseto_tsquery` | plain words | requires them adjacent (`<->`) |
| `websearch_to_tsquery` | search-engine syntax | never raises |

**`to_tsquery` must never receive raw user input.** It is a parser for a query
language, not for prose:

```console
to_tsquery             "fox & dog"              → 'fox' & 'dog'
websearch_to_tsquery   "fox & dog"              → 'fox' & 'dog'
to_tsquery             "fox dog"                → 42601 syntax error in tsquery: "fox dog"
websearch_to_tsquery   "fox dog"                → 'fox' & 'dog'
to_tsquery             "cheap \"red shoes\" -blue" → 42601 syntax error in tsquery: "cheap "red shoes" -blue"
websearch_to_tsquery   "cheap \"red shoes\" -blue" → 'cheap' & 'red' <-> 'shoe' & !'blue'
to_tsquery             "it's a fox!"            → 42601 syntax error in tsquery: "it's a fox!"
websearch_to_tsquery   "it's a fox!"            → 'fox'
↑ to_tsquery raises on ordinary user text; websearch_to_tsquery never does
```

Two spaces between words is enough to make `to_tsquery` throw. An apostrophe is
enough. A search box wired to `to_tsquery` is a 500 waiting for its first
ordinary query — and sanitising the input to make it safe means writing a query
parser, which is what `websearch_to_tsquery` already is.

### Use `websearch_to_tsquery`

It implements the syntax users already know from search engines, and the last
example shows the whole grammar:

```
cheap "red shoes" -blue   →   'cheap' & 'red' <-> 'shoe' & !'blue'
```

- unquoted words are ANDed;
- `"quoted text"` becomes a phrase (`<->`, adjacency);
- `-word` becomes negation (`!`);
- `or` between words becomes `|`;
- **anything it cannot parse is discarded rather than raised** — `it's a fox!`
  became just `'fox'`.

That last property is the point: it always returns a valid `tsquery`. The cost is
that it silently ignores input, so a user's malformed query returns results for
whatever survived rather than an error explaining the problem.

`plainto_tsquery` remains reasonable when you are not exposing a search syntax at
all and want every word required. `phraseto_tsquery` is for "this exact phrase"
without asking the user to quote it.

## Matching with `@@`

```sql
WHERE to_tsvector('english', body) @@ websearch_to_tsquery('english', $1)
```

`@@` takes a `tsvector` on one side and a `tsquery` on the other and returns
boolean. Both arguments name the configuration explicitly — that is not
decoration, it is what keeps the two sides consistent and what makes the
expression indexable.

## Prefix matching

Full-text search matches **whole lexemes**. A prefix is not a lexeme:

```console
=== 9. what full-text search cannot do ===
exact word           'router' → 13335 rows
stemmed variant      'routers' → 13335 rows
misspelling          'routr' → 1 rows
prefix of a word     'rout' → 0 rows
prefix query 'rout:*'  → 13336 rows  ← :* is how prefixes are done
```

`router` and `routers` return **the same 13 335 rows** — stemming means the
query's plural and the document's singular meet at the same lexeme. That is
full-text search working exactly as intended.

`rout` returns **nothing**, because `rout` is its own lexeme and no document
contains it. To match prefixes you need the `:*` suffix, which only
`to_tsquery` and `websearch_to_tsquery` understand:

```sql
to_tsquery('english', 'rout:*')          -- 13 336 rows
```

For a type-ahead box this is the mechanism — append `:*` to the last token before
parsing. Note that `13336` is one more than the exact search, because the prefix
also matched the deliberately misspelled `routr` row.

**And `routr` found 1 row** — the document that *is* misspelled. Full-text search
matched it because the misspelling is a lexeme in that document. It will not find
that document when the user spells the word correctly; that is
[pg_trgm's job](../06-pg-trgm.md).

## Trade-off

Choosing `english` buys stemming and stop words, which is what makes a search feel
like search — plurals and tenses match, and common words do not dominate. It costs
you exactness: `simple` would let a user find the literal string they typed, and
`english` will not distinguish `router` from `routers` however hard the user
tries.

For product names, SKUs, tags and codes that exactness is the requirement, and the
usual answer is both — an `english` vector for the description and a `simple` one
(or a plain B-tree index) for the identifier. Trying to serve both from one
configuration produces a search that is slightly wrong for everyone.

## Gotchas

**Symptom:** `42601 syntax error in tsquery`
**Cause:** Raw user input reached `to_tsquery`. Measured: two words, an
apostrophe, or a quote are each enough.
**Fix:** `websearch_to_tsquery`, which never raises.

**Symptom:** A search returns nothing although the word is clearly in the document
**Cause:** The document and the query used different configurations, so one side
stemmed and the other did not.
**Fix:** Name the same configuration explicitly on both sides.

**Symptom:** Searching a prefix returns nothing
**Cause:** Full-text search matches whole lexemes. Measured: `rout` → 0 rows.
**Fix:** `to_tsquery('english','rout:*')` — measured 13 336 rows.

**Symptom:** A search for a product code matches unrelated products
**Cause:** The `english` configuration stemmed the code.
**Fix:** `simple` for identifiers, or a plain equality index.

**Symptom:** A user's query silently returns results for a different search
**Cause:** `websearch_to_tsquery` discards what it cannot parse — `it's a fox!`
became `'fox'`.
**Fix:** Expected behaviour; show the user the interpreted query if that matters.

**Symptom:** Stop words cannot be searched for at all
**Cause:** `english` removes them from documents and queries alike, so `the` is
not searchable.
**Fix:** `simple` for that column, if searching them is genuinely required.

## Interview questions

**★ What does `to_tsvector('english', ...)` do to a sentence?**
It produces a sorted set of lexemes with positions: it lowercases, stems each word
to a normalised form and drops stop words. Measured, `The running dogs were
quickly jumping over the lazy foxes` became `'dog':3 'fox':10 'jump':6 'lazi':9
'quick':5 'run':2` — note `lazi`, a stem rather than a word, and the absence of
`the`, `were` and `over`.

**★ Why must a search box never call `to_tsquery` directly?**
Because it parses tsquery syntax, not prose, and raises `42601` on ordinary input.
Measured: `fox dog`, `it's a fox!` and a quoted phrase all raised. Use
`websearch_to_tsquery`, which implements search-engine syntax — quotes for
phrases, `-` for negation, `or` for alternatives — and never raises.

**★ Why do `router` and `routers` return the same rows?**
Because the `english` configuration stems both to the same lexeme. Measured, both
returned 13 335 rows. That is the feature; if you need them distinguished, use the
`simple` configuration.

**★ How do you implement type-ahead with full-text search?**
Append `:*` to the last token — `to_tsquery('english','rout:*')`. Full-text search
matches whole lexemes, so a bare prefix matches nothing: measured, `rout` returned
0 rows and `rout:*` returned 13 336.

**What happens if the document and the query use different text search configurations?**
They will not match, because one side stems and the other does not — the document
holds `run` and the query asks for `running`. Always name the configuration
explicitly on both sides.

**When would you choose `simple` over `english`?**
For identifiers, SKUs, tags and codes, where stemming actively harms exactness. It
is common to index a description as `english` and an identifier as `simple` in the
same table.

---

← [Topic index](README.md) · Next → [Indexing and ranking](02-indexing-and-ranking.md)
