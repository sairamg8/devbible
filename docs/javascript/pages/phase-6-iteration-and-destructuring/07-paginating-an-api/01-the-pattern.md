---
title: "07.1 · The pattern"
sidebar_label: "01 · The pattern"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`async function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*), [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) and [`Link`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Link) (RFC 8288). Documentation-validated.

**Paginated endpoints are the canonical async-generator problem**, and the reason is the
shape of the requirement: the caller wants *items*, the API gives *pages*, and nobody
knows how many pages there are until the last one comes back. Every alternative leaks that
detail into the caller.

Here is the whole pattern:

```js
async function* paginate(url) {
  let cursor;
  do {
    const res = await fetch(cursor ?? url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const page = await res.json();
    yield* page.items;                 // hand out ITEMS, not pages
    cursor = page.next;                // whatever "next" means for this API
  } while (cursor);
}

for await (const item of paginate("/api/orders")) {
  if (item.id === wanted) break;       // stops fetching — no further page is requested
}
```

**The caller loops over items and knows nothing about pages.** Page two is fetched only
because the loop asked for an item page one could not supply, and `break` means page three
is never requested at all.

## What it replaces

| Alternative | What goes wrong |
|---|---|
| `fetchAll()` returning an array | Fetches **every** page before the caller sees anything, and holds all of it in memory |
| A callback per page (`onPage`) | Inverted control — the caller cannot `break`, `await` between pages, or `return` a value out |
| The caller managing `cursor` | Paging mechanics spread across every call site, and each one gets the termination check subtly wrong |
| `while (hasMore) { … }` inline | Works, but is rewritten at every call site and cannot be composed |

The generator is the only one of these where **the consumer keeps control** and the
producer keeps the paging details.

## The three paging styles

The loop is the same each time; only "what is the next request" changes.

**Cursor / continuation token** — the API returns an opaque token:

```js
async function* byCursor(base) {
  let cursor = null;
  do {
    const res = await fetch(`${base}?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
    const { items, nextCursor } = await res.json();
    yield* items;
    cursor = nextCursor;                 // null/undefined on the last page
  } while (cursor);
}
```

**Offset / page number** — the API takes `page` or `offset`:

```js
async function* byPage(base, size = 100) {
  for (let page = 1; ; page++) {
    const res = await fetch(`${base}?page=${page}&per_page=${size}`);
    const items = await res.json();
    if (items.length === 0) return;      // empty page = done
    yield* items;
    if (items.length < size) return;     // short page = last page
  }
}
```

**`Link` header** — MDN describes the `Link` header as *"a means for serializing one or
more links in HTTP headers"*, and pagination uses `rel="next"`, `rel="prev"`,
`rel="first"` and `rel="last"`. MDN's example:

```http
Link: <https://api.example.com/issues?page=2>; rel="prev", <https://api.example.com/issues?page=4>; rel="next", <https://api.example.com/issues?page=10>; rel="last", <https://api.example.com/issues?page=1>; rel="first"
```

```js
const nextLink = (res) =>
  res.headers.get("Link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1];

async function* byLinkHeader(url) {
  let next = url;
  while (next) {
    const res = await fetch(next);
    yield* await res.json();
    next = nextLink(res);                // absent on the last page
  }
}
```

**Prefer the server's own `next` link over rebuilding the URL yourself.** It carries
filters, sort order and the cursor already, and it is the one thing guaranteed to stay
correct when the API changes.

## Terminating — get this right, or it never ends

The single most common bug in hand-written paging is a termination condition that is not
actually reachable. Each style has its own:

- **Cursor:** stop when the token is `null`/absent. Do **not** stop on "items is empty" —
  some APIs return an empty page with a valid cursor.
- **Offset:** stop on an empty page **and** on a short page. Checking only "short page"
  breaks when the total is an exact multiple of the page size; checking only "empty"
  costs one extra request every time.
- **`Link`:** stop when there is no `rel="next"`. Never infer the end from `rel="last"`.

And add a guard, because a server bug should not become an infinite loop:

```js
async function* paginate(url, { maxPages = 1000 } = {}) {
  let cursor, seen = new Set(), pages = 0;
  do {
    if (++pages > maxPages) throw new Error(`pagination exceeded ${maxPages} pages`);
    if (cursor && seen.has(cursor)) throw new Error("pagination cursor repeated");
    if (cursor) seen.add(cursor);
    // … fetch, yield*, advance cursor
  } while (cursor);
}
```

**A repeated cursor is the tell for a server that never advances** — a real failure mode,
and one that presents as a hang rather than an error unless you check for it.

## Yield items, not pages — with one exception

`yield* page.items` flattens the paging away, which is what almost every caller wants.
Yield the **page** instead when the caller genuinely needs page-level information:

```js
async function* pages(url) { /* … */ yield page; }          // page-level
async function* items(url) { for await (const p of pages(url)) yield* p.items; }
```

Writing both is cheap and worth it when the caller needs the total count, a page's ETag,
or wants to batch-insert a page at a time. Note the second one is three lines *because*
the first exists — async generators compose exactly like sync ones.

## Collecting it, when you do want everything

`Array.fromAsync` is the built-in collect step. MDN: it *"creates a new, shallow-copied
Array instance from an async iterable, iterable, or array-like object"* and returns *"a new
`Promise` whose fulfillment value is a new `Array` instance"*.

```js
const all = await Array.fromAsync(paginate("/api/orders"));
```

Its laziness note matters here: *"`Array.fromAsync()` iterates the iterable lazily, and
doesn't retrieve the next value until the current one is settled. `Promise.all()` retrieves
all values in advance and awaits them all."* So this still pages **sequentially** — it just
keeps everything. If you are always writing this line, ask whether the generator is buying
you anything; if the answer is "one caller streams and one collects", it is.

## Gotchas

**Symptom:** The loop never ends
**Cause:** A termination condition that cannot be reached — checking only "empty page" on
an API that returns a cursor, or rebuilding a URL that always resolves to page one.
**Fix:** Follow the API's own signal (`nextCursor` absent, no `rel="next"`), and add a
max-pages guard and a repeated-cursor check.

**Symptom:** Every page after the first came back identical
**Cause:** The cursor or page number is not being threaded into the next request.
**Fix:** Use the server's `next` URL verbatim rather than reconstructing it.

**Symptom:** One extra request on every full run
**Cause:** Stopping only when a page comes back empty.
**Fix:** Also stop on a short page — `items.length < size`.

**Symptom:** The last page was skipped
**Cause:** Stopping on a short page **only**, on an API whose final page is exactly full,
or a `do…while` written as a `while` that checks the cursor before the first request.
**Fix:** Check both conditions; make the first request unconditional.

**Symptom:** Memory grew until the tab died
**Cause:** Accumulating every page into an array inside the generator.
**Fix:** `yield*` each page and let the consumer decide; use `Array.fromAsync` only when
the caller really wants all of it.

**Symptom:** Non-2xx responses were silently paged over
**Cause:** `fetch` does not reject on HTTP error status.
**Fix:** Check `res.ok` and throw — the rejection surfaces at the consumer's `await`.

**Symptom:** The consumer `break`ed but requests kept going
**Cause:** Work started outside the pull — prefetching, or a `setInterval`.
**Fix:** Keep every request inside the generator body, and cancel in `finally`
([07.2](./02-making-it-production-worthy.md)).

## Interview questions

**★ Why is an async generator a good fit for a paginated API?**
Because the consumer wants items and the API gives pages. The generator hides the cursor,
yields items lazily, fetches the next page only when the current one runs out, and stops
fetching entirely when the consumer `break`s — none of which a `fetchAll()` or a
callback-per-page can do.

**★ How do you know when to stop?**
Follow the API's own end signal: an absent cursor, no `rel="next"` link, or (for offset
paging) an empty **or** short page. Add a max-page guard and a repeated-cursor check so a
server bug surfaces as an error rather than a hang.

**★ Should the generator yield pages or items?**
Items, by default — that is what removes paging from the call site. Write a page-level
generator underneath when callers need page metadata, and define the item-level one in
terms of it with `yield*`.

**★ What is `Array.fromAsync` and when would you use it?**
It collects an async iterable into an array and returns a promise for it, iterating
**lazily** — unlike `Promise.all`, which retrieves everything up front. Use it when the
caller genuinely wants the whole result; if every caller does, the laziness was not worth
it.

**How is this different from just looping with `while (hasMore)` at the call site?**
Behaviourally it is the same requests; structurally the paging lives in one place, is
testable on its own, composes with `yield*`, and cannot be got subtly wrong by the fifth
call site that copies it.

**Why prefer the server's `next` URL to building the next request yourself?**
It already carries the filters, sort and cursor, and it keeps working when the API changes
how it encodes them. Rebuilding the URL is where "every page came back identical" bugs come
from.

---

[Topic index](./README.md) · Next → [Making it production-worthy](./02-making-it-production-worthy.md)
