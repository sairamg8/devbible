---
title: "The panel identifies every row by its serialised query key, and a key that looks right on screen can still be a different cache entry — object property order is irrelevant, array item order is not, and that asymmetry is where the duplicate rows come from"
sidebar_label: "01c · Reading a query key"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries). Documentation-validated, **no sandbox run**; the hashing *function* is not printed in the documentation, so claims about it are marked below as inference and not asserted. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**Every row in the devtools is a cache entry, and what identifies a cache entry is not the array you typed — it is the deterministic hash of that array. The panel prints the serialised key, which is the closest thing you get to seeing the hash, and this is the reason it is worth reading character by character: two rows whose keys look the same to a human are, by definition, not the same to the cache. The single most productive habit in this whole topic is to stop asking "why is my query not updating" and start asking "which of these rows is my component actually subscribed to".**

## The key is hashed, not compared by identity

The Query Keys guide states it flatly:

> *"Query Keys are hashed deterministically!"*

*Deterministically* is doing real work in that sentence. It means the hash is a function of the **values** in the key, not of the objects' identity. A brand-new array literal, created fresh on every render, with the same contents, produces the same hash and therefore the same cache entry:

```tsx
// Both of these subscribe to the SAME cache entry, on every render, forever.
useQuery({ queryKey: ['todos', { page: 1, status: 'open' }], queryFn: fetchTodos })
useQuery({ queryKey: ['todos', { status: 'open', page: 1 }], queryFn: fetchTodos })
```

That is not an accident of the example — it is documented:

> *"no matter the order of keys in objects, all of the following queries are considered equal"*

🔴 **This kills the most popular wrong theory about duplicate rows.** "My key object is recreated on every render, so React Query makes a new entry" is false. Referential instability of the key is a non-issue. If you are seeing a second row, something in the key's *value* differs.

## …except for arrays, where order is significant

The very next rule in the same guide reverses:

> *"Array item order matters!"*

```tsx
// THREE different cache entries. Three rows in the panel.
useQuery({ queryKey: ['todos', status, page], queryFn: fetchTodos })
useQuery({ queryKey: ['todos', page, status], queryFn: fetchTodos })
useQuery({ queryKey: [status, 'todos', page], queryFn: fetchTodos })
```

The asymmetry is defensible — an array is an ordered structure and an object is not — but it is exactly the sort of rule that is obvious once stated and invisible when you are debugging at speed. It also produces a specific, wasteful failure: someone sees two rows, assumes ordering is the problem, sorts the *object* properties, changes nothing, and concludes the cache is broken.

## What a key is allowed to contain

> *"As long as the query key is serializable using `JSON.stringify`, and unique to the query's data, you can use it!"*

Read both halves as constraints on what you will see in the panel:

- **Serialisable** rules out functions, symbols, class instances with private state, `Map`, `Set`, and anything whose meaning lives outside its own enumerable properties. Two structurally different values of those kinds can serialise to the same text and therefore *collide into one row*.
- **Unique to the query's data** is the design rule that makes the panel readable at all. If two conceptually different requests share a key, they share an entry, and each one overwrites the other's data. In the panel that reads as a row whose data keeps changing shape for no reason.

⚠️ **The documentation does not print the hashing function**, so I will not assert exactly how it treats `undefined`, a `Date`, or a `BigInt`. What is safe to say: `JSON.stringify` is the stated serialisation contract, `JSON.stringify` drops object properties whose value is `undefined`, and a `Date` becomes a string. If a key of yours contains any of those, **read the serialised key in the panel and believe what it prints** rather than what you assume — that is precisely the question the panel answers cheaply and reasoning answers badly.

## Keys are hierarchical, and that is what invalidation matches on

Query filters match on a key **prefix**, which is why the convention is to build keys from most general to most specific:

```ts
// src/queries/keys.ts — a key factory, so the panel and your code agree
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: { status: string; page: number }) =>
    [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: string) => [...todoKeys.details(), id] as const,
}
```

With that shape, invalidating `todoKeys.all` reaches every list and every detail, and you can *watch* it happen: the rows sharing the `todos` prefix change together. The invalidation guide describes what "invalidated" means for each match:

> *"It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*

> *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*

So a correct invalidation looks like *several* rows flipping to stale and the *observed* ones going on to fetch. If exactly one row reacts when you expected five, your keys are not sharing the prefix you think they are — the classic version being a singular/plural mismatch, where `['todo', id]` is not under the `['todos']` prefix at all and never was.

A key factory is worth the ceremony for one devtools-specific reason: it makes the serialised keys in the panel a stable, greppable vocabulary. When every list key is `["todos","list",{…}]`, an unexpected row shaped `["todos",{…}]` announces itself as a call site that bypassed the factory.

## Reading a row against your source

The panel prints the key in its serialised form, not in the form you typed. Practical consequences when you are hunting:

- A template literal, a `String(id)`, and a numeric id all look identical in your editor and different in the panel — `["todo","1"]` and `["todo",1]` are two rows.
- A key built from router params is a string even when the value is conceptually a number, because URL params are strings. Mixing a router-derived key with a key built from a fetched object's numeric `id` is the most common way to get exactly two rows for one entity.
- A key with a filter object shows every property, including the ones defaulted in by a helper. If the panel shows a property you did not pass, something upstream is adding it — and that is your duplicate.

## Gotchas

**★ Two rows in the panel for what is unmistakably one query, and one of them never updates.** Cause: the keys differ by value somewhere — most often a number where the other call site has a string. Fix: compare the two serialised keys character by character rather than comparing the source expressions; the panel is showing you the truth and your source is showing you the intent. Then normalise at one place, ideally a key factory, so the coercion cannot drift again.

**★ You "fixed" a duplicate by sorting the properties of the filter object in the key, and nothing changed.** Cause: object property order is explicitly irrelevant — *"no matter the order of keys in objects, all of the following queries are considered equal"*. You changed nothing the hash can see. Fix: look for a differing *value*, or for array item order, which is the axis that does matter.

**★ Swapping two variables in the key array "for readability" silently orphaned the cache.** Cause: *"Array item order matters!"* — the reordered key hashes differently, so every existing entry is unreachable and every consumer cold-loads. Fix: treat key array order as part of the public contract of a query, change it deliberately, and centralise it in a factory so a reorder is one edit rather than a search-and-replace across call sites.

**★ New rows accumulate on every keystroke in a search box.** Cause: the search term is in the key, so each distinct term is a distinct query — which is correct behaviour, not a leak. Fix: nothing is broken, but debounce the value that goes into the key if you do not want a request per character. The abandoned entries become inactive and are garbage collected on the documented schedule, which is [01d](./01d-stale-fresh-inactive-and-eviction.md)'s subject.

**★ A row's key refetches endlessly and its serialised key is slightly different every time.** Cause: something non-constant is inside the key — `new Date()`, `Date.now()`, `Math.random()`, or an object whose property is derived from a timestamp. Every render produces a new value, so a new entry, so a new cold fetch, forever. Fix: this is the one duplicate-row bug that referential stability *does* solve, because the underlying problem is that the value changes; hoist the constant, or round the timestamp to the granularity you actually key on.

**★ You expected two rows for two different users and the panel shows one.** Cause: a key property whose value is `undefined` — `JSON.stringify` does not emit object properties set to `undefined`, so `{ userId: undefined }` and `{}` are not distinguishable in the serialised form the docs name as the contract. Fix: check the printed key for the missing property, and guard the query with `enabled` until the id exists rather than letting `undefined` into the key at all. A query keyed on a missing id is the `pending` + `idle` cell from [01b](./01b-status-and-fetchstatus-matrix.md).

**★ A key containing a class instance or a `Map` behaves as though all instances are the same query.** Cause: the guide's requirement is serialisability under `JSON.stringify`, and those types do not round-trip — a `Map` serialises to an empty object, so two different maps produce the same text. Fix: put the plain data in the key, not the container; convert to an array of entries or to the primitive fields the request actually varies on.

**★ Invalidating the parent key updated nothing, and the panel shows every row still fresh.** Cause: the rows do not share the prefix you assumed. `['todo', id]` is not under `['todos']`; a key factory built by string concatenation rather than array spreading can also produce `['todos-list']` where you meant `['todos', 'list']`. Fix: read the serialised keys of the rows you *want* to hit and confirm they literally begin with the array you are invalidating.

**★ Everything looks right, and one component still shows old data while a neighbouring one is current.** Cause: the two components are subscribed to two entries, and the write (`setQueryData`, or the mutation's cache update) landed on only one of them. Fix: this is the diagnosis the panel is best at — find the row whose data is correct, find the row whose data is stale, and compare their keys. The write target is nearly always the one built inline at the mutation site while the reader uses the factory.

## Interview questions

**★ Are query keys compared by reference or by value, and what practical difference does it make?**
By value — the docs say *"Query Keys are hashed deterministically!"*, and the hash is over the contents. Practically this means you never need to memoise a query key: an array literal with an inline filter object, recreated on every single render, addresses the same cache entry every time. That is the opposite of the rule you internalise for `useEffect` dependency arrays or React context values, which is why experienced React developers routinely wrap query keys in `useMemo` for no benefit. It also redirects debugging: when you see duplicate cache entries, referential instability is definitionally not the cause, so you go looking for a differing value instead — and that search actually succeeds.

**★ Object property order does not affect the key, but array item order does. Why, and where does that bite?**
An object has no defined ordering of its properties, so treating `{ page: 1, status: 'open' }` and `{ status: 'open', page: 1 }` as different keys would make cache identity depend on how someone happened to type the literal. An array *is* ordered, and the library uses that ordering as the hierarchy that filters match on — a prefix match over `['todos', 'list', filters]` is only meaningful if position is significant. It bites when someone reorders a key array for readability, or when two call sites build the same conceptual key with the arguments in a different order: both produce a second, silent cache entry with no error and no warning, and in the panel it looks like the app is simply fetching twice.

**★ What makes a key legal, and what is the failure mode of an illegal one?**
The stated contract is *"As long as the query key is serializable using `JSON.stringify`, and unique to the query's data, you can use it!"* — two conditions, and each fails differently. Break serialisability, with a `Map`, a `Set`, a class instance or a function, and distinct values can serialise identically, so genuinely different queries **collide** into one entry and overwrite each other's data. Break uniqueness, by leaving out a parameter the request actually varies on, and you get the same collision by a different route: page 2 fetched under the key for page 1. Both look like "the data is randomly wrong", which is the hardest class of bug to reason about from the UI and the easiest to spot in the panel, because one row will visibly change shape.

**★ How would you use the panel to prove that an invalidation is hitting the right queries?**
Look at the set of rows sharing the prefix before you act, then invalidate and watch which rows change. The documented semantics give you two observable effects: every match *"is marked as stale"*, overriding any `staleTime`, and every match currently rendered by a hook *"will also be refetched in the background"*. So the correct picture is several rows going stale and the observed subset going on to fetch. If exactly one row reacts, your keys are not hierarchical in the way you assumed; if every row in the app reacts, you invalidated with a prefix that is shorter than you intended, or with no filter at all.

**★ Why is a key factory worth the boilerplate, argued from the devtools rather than from tidiness?**
Because it makes the panel legible. With ad-hoc keys, every call site invents its own serialised shape, and reading the panel becomes an exercise in reverse-engineering which component produced which row. With a factory, the vocabulary is closed: you know that every list is `["todos","list",…]`, so a row that does not match the pattern is immediately identifiable as a bypassing call site, and prefix invalidation is provably correct because the prefixes are constructed by spreading rather than retyped. It also removes the two most common duplicate-row causes at the source — inconsistent coercion of ids, and array order drift — since both are now decided in exactly one file.

---

← [status and fetchStatus](./01b-status-and-fetchstatus-matrix.md) · [Topic index](../README.md) · Next → [Stale, fresh, inactive](./01d-stale-fresh-inactive-and-eviction.md)
