---
title: "`initialData` is a cache write and `placeholderData` is not — every other difference between the two options is a consequence of that one sentence"
sidebar_label: "01e · initialData vs placeholderData"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data), [Placeholder Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🌱 `initialData` Is a Cache Write. `placeholderData` Is Not.

**Two options, one sentence between them, and it is the sentence most people do not have when they choose.** `initialData` is written into the cache entry for that key, so from that moment it is indistinguishable from data the `queryFn` returned: it is what `getQueryData` gives back, it is what every other observer of the key renders, it participates in `staleTime`, and — the part that surprises people — **if it is considered fresh it suppresses the fetch entirely.** `placeholderData` is displayed and nothing else: `data` is populated for this observer only, `isPlaceholderData` is `true`, the cache entry stays empty, and the fetch always happens. [`01b`](./01b-enabled-and-skiptoken.md) already noted the sharp edge of that — `initialData` is written even behind `enabled: false`, because a cache write is not a fetch. This page is why that is true and what else follows from it.

## 1. The one sentence, and the nine things it decides

> *"`initialData` is persisted to the cache, so it is not recommended to provide placeholder, partial or incomplete data."*

> *"Placeholder data allows a query to behave as if it already has data, similar to the `initialData` option, but **the data is not persisted to the cache**."*

Everything in this table is downstream of those two clauses. None of it is a separate rule to memorise.

| Question | `initialData` | `placeholderData` |
|---|---|---|
| Written to the `QueryCache` entry? | **Yes** | **No** |
| `queryClient.getQueryData(key)` returns it? | Yes | No — `undefined` |
| Other components observing the same key see it? | Yes, all of them | No — this observer only |
| Initial `status` | `'success'` | `'success'` |
| `isPlaceholderData` | `false` | **`true`** until real data lands |
| Participates in `staleTime`? | **Yes** | No — there is nothing cached to be fresh |
| Can it stop the fetch? | **Yes**, when it counts as fresh | Never |
| Survives unmount/remount of the component? | Yes, until `gcTime` collects the entry | No — the placeholder is recomputed |
| Survives `invalidateQueries`? | The entry does; it is marked stale and refetched | N/A |

The two `'success'` cells are why the pair looks interchangeable at a glance. Both remove the spinner. Only one of them changes what the library **believes**.

## 2. What "persisted to the cache" actually costs

A cache write has three consequences that a render-time value cannot have, and each one has bitten somebody.

**It is global to the key.** Cache entries are keyed, not scoped to a component. The moment `useQuery({ queryKey: ['invoices', customerId], initialData: [] })` mounts anywhere, `['invoices', customerId]` holds an empty array, and a sidebar counter, a badge and a `getQueryData` call in a mutation's `onMutate` all read *this customer has no invoices*.

**It is indistinguishable from fetched data afterwards.** There is no `isInitialData` flag — deliberately, because from the cache's point of view there is nothing to distinguish. `placeholderData` gets `isPlaceholderData` precisely because it *is* distinguishable: the cache is empty and the library knows the value came from your option.

**🔴 It can cancel the network request.** This is the one people do not see coming, and it is entirely mechanical: freshness is computed from the entry's timestamp against `staleTime`, and `initialData` creates an entry with a timestamp.

> *"`initialData` is treated as totally fresh, as if it were just fetched."*

With the default `staleTime: 0` the query *"will immediately refetch when it mounts"*, so nothing goes wrong and the trap survives review. Add the non-zero `staleTime` that is the entire reason people configure caching, and you have told the library your seed is authoritative for that window. It obeys you.

```tsx
// 🔴 the empty state is now a cached fact, and no request is made for five minutes
useQuery({
  queryKey: ['invoices', customerId],
  queryFn: () => fetchInvoices(customerId),
  initialData: [],
  staleTime: 5 * 60_000,
});

// ✅ identical pixels, nothing persisted, and the fetch always happens
useQuery({
  queryKey: ['invoices', customerId],
  queryFn: () => fetchInvoices(customerId),
  placeholderData: [],
  staleTime: 5 * 60_000,
});
```

The mechanics of `staleTime` itself belong to [`01c`](./01c-staletime-and-the-refetchon-family.md) and [`04/01f`](../04-caching-and-invalidation/01f-staletime-vs-gctime.md); what is new here is that `initialData` is a way to *start* that clock without a network round trip having happened.

## 3. 🔴 `initialDataUpdatedAt` — the option that makes `initialData` honest

This is the highest-value paragraph on the page and the least-used option in the pair.

`initialData` alone gives the library a value with no provenance, so it assumes the only thing it can: the value is current. `initialDataUpdatedAt` takes a **JS millisecond timestamp** — `Date.now()`-shaped, or a function returning one — and declares when the data was *really* produced. Freshness is then computed from that instant instead of from now, so a seed older than `staleTime` is stale on arrival and the query refetches on mount exactly as it would have with an empty cache. The guide's framing:

> *"Use `initialDataUpdatedAt` (a JS timestamp) when your initial data isn't current, allowing the query to decide for itself whether the data needs to be refetched."*

```tsx
// data embedded in the HTML document at render time on the server
declare const bootstrap: { todos: Todo[]; generatedAt: number };

function TodoList() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    initialData: bootstrap.todos,
    // 🔴 without this line, a document cached by a CDN for an hour still claims "just fetched"
    initialDataUpdatedAt: bootstrap.generatedAt,
    staleTime: 60_000,
  });
}
```

Read the three cases off it:

- `initialDataUpdatedAt` omitted → the seed is fresh for the full `staleTime`, measured from mount. A page served from an edge cache renders hour-old data and refuses to check.
- `initialDataUpdatedAt` within `staleTime` → the seed is used and the remaining fraction of the window is honoured. Zero requests, correctly.
- `initialDataUpdatedAt` older than `staleTime` → the seed renders instantly *and* a background refetch starts. This is the best of both, and it is unreachable without the option.

The pairing to internalise is: **any `initialData` that did not come into existence in this tick needs an `initialDataUpdatedAt`.** Data from a server render, from `localStorage`, from a persisted cache, from a list fetched three screens ago — all of it has an age, and the option is the only place to declare it.

## 4. `initialData` as a function, and when it runs

If computing the seed costs anything — a `find` over a thousand-row list, a `JSON.parse` of a `localStorage` blob — pass a function rather than a value.

> *"This function will be executed only once when the query is initialized."*

```tsx
useQuery({
  queryKey: ['todo', todoId],
  queryFn: () => fetchTodo(todoId),
  initialData: () => JSON.parse(localStorage.getItem(`todo:${todoId}`) ?? 'null') ?? undefined,
  initialDataUpdatedAt: () => Number(localStorage.getItem(`todo:${todoId}:at`)) || undefined,
});
```

Two consequences worth stating explicitly:

- **Returning `undefined` from the function means "no seed".** That is how you make `initialData` conditional — there is no `enabled`-style switch for it. A function that returns `undefined` leaves the entry empty and the query goes to `pending` normally.
- **A key change is a new query, so the function runs again for the new key.** ⚠️ The guide says *"only once when the query is initialized"* and does not spell out the key-change case; treating each key as its own query is the derivation, not a quoted sentence. It matches how every other per-key behaviour in the library works, but verify against the version you install if you are depending on it.

`placeholderData` also has a function form, and it is not lazy in the same sense — see §6.

## 5. `placeholderData`: shown, never stored

> *"our Query will not be in a `pending` state - it will start out as being in `success` state, because we have `data` to display"*

That status move is the entire mechanism, and it is why the flag exists. The result carries *"the `isPlaceholderData` flag set to `true`"* while the placeholder is what you are looking at. A component that sets `placeholderData` and never reads `isPlaceholderData` has quietly promoted a guess to a fact for the duration of the request, with no visual difference from real data.

```tsx
function InvoiceTable({ customerId }: { customerId: string }) {
  const invoices = useQuery({
    queryKey: ['invoices', customerId],
    queryFn: () => fetchInvoices(customerId),
    placeholderData: [],
    staleTime: 5 * 60_000,
  });

  return (
    <div aria-busy={invoices.isPlaceholderData}>
      {/* dim it, disable sorting, hide the "0 invoices" empty-state copy — but render the shell */}
      <Table rows={invoices.data} className={invoices.isPlaceholderData ? 'opacity-50' : undefined} />
      {!invoices.isPlaceholderData && invoices.data.length === 0 && <NoInvoices />}
    </div>
  );
}
```

`isPlaceholderData` is the honest replacement for the `isPending` branch the placeholder just deleted. Use it for the three things people actually want: dimming, disabling pagination controls, and **suppressing empty-state copy** — "You have no invoices" rendered over a placeholder empty array is the same lie as `initialData: []`, just a shorter-lived one.

Because nothing is persisted, the query fetches unconditionally. `staleTime` has no entry to evaluate. That is the property that makes `placeholderData` safe by default: it changes what the user sees and nothing else.

## 6. The v5 function form, and `keepPreviousData` as an import

> *"`placeholderData` can also be a function, where you can get access to the data and Query meta information of a 'previous' successful Query."*

The signature is `(previousData, previousQuery) => TData | undefined`. Returning the previous data keeps the last successful result on screen while the new key loads — a table that does not collapse to a spinner between page 1 and page 2.

🔴 **This is a v5 breaking change, and it is one of the ones that compiles in JavaScript.** The migration guide removed the `keepPreviousData` option and the `isPreviousData` flag; `placeholderData` now receives the previous data as an argument and the flag is `isPlaceholderData`. A v4 codebase that passed `keepPreviousData: true` in v5 is passing an unknown option — silently ignored, and the table flashes empty on every page change with nothing in the console.

```tsx
import { useQuery, keepPreviousData } from '@tanstack/react-query';

// the identity function, exported so you do not have to write it
useQuery({
  queryKey: ['todos', page],
  queryFn: () => fetchTodos(page),
  placeholderData: keepPreviousData,
});

// equivalent, and the form to use when you want to transform or filter the carried-over value
useQuery({
  queryKey: ['todos', page],
  queryFn: () => fetchTodos(page),
  placeholderData: (previousData, previousQuery) => previousData,
});
```

⚠️ **`keepPreviousData` the helper is right for pagination and wrong for an identity switch.** "Previous query" means the previous *key*, and if the key encodes which customer you are looking at, the previous key is a different customer. The dependent-chain treatment of exactly this is [`08/01g`](../08-dependent-and-parallel-queries/01g-placeholderdata-in-a-chain.md); the option-level rule is that `keepPreviousData` is safe when a key change means *more of the same thing* and dangerous when it means *a different thing*.

## Gotchas

**★ Symptom: an empty state that never resolves — the table says "no results" and no request is ever made.** Cause: `initialData: []` combined with a non-zero `staleTime`. The empty array was persisted to the cache and *"treated as totally fresh, as if it were just fetched"*, so for the whole `staleTime` window the library has an authoritative answer and no reason to ask the server. Fix: one word — `placeholderData: []` renders the identical empty table, persists nothing, and the fetch always happens. If you genuinely want the write, pair it with `initialDataUpdatedAt`.

**★ Symptom: it works in development and shows stale data in production.** Cause: the seed came from a server-rendered document or an edge-cached HTML response, and `initialDataUpdatedAt` was omitted. In development the document is regenerated on every request so "fetched just now" is true; behind a CDN it is hours old and the same code claims freshness. Fix: emit a timestamp alongside the data and pass it — `initialDataUpdatedAt: bootstrap.generatedAt`.

**★ Symptom: a component you did not touch starts rendering wrong data.** Cause: somebody added `initialData` to one hook, and cache entries are per key, not per component. Every other observer of that key now reads the seed. Fix: if the value is a guess, it belongs in `placeholderData`, which is scoped to the observer that declared it. If it is real data, the sharing is the point — but then it needs to be complete and correctly aged.

**★ Symptom: `TypeError: Cannot read properties of undefined` thrown during render, only on a deep link.** Cause: an `initialData` function doing `queryClient.getQueryData(['todos']).find(...)` with no optional chaining. The list is absent on a cold load and *"If the query is not utilized by a query hook within the default `gcTime`, the query will be garbage collected"* — five minutes of an unused list is enough. Fix: `getQueryData<Todo[]>(['todos'])?.find(...)`, and let `undefined` mean "no seed". The chain-specific version of this is [`08/01f`](../08-dependent-and-parallel-queries/01f-placeholder-and-initial-data-in-a-chain.md).

**★ Symptom: the pagination table flashes empty between pages after a v4 → v5 upgrade.** Cause: `keepPreviousData: true` is no longer an option — it and `isPreviousData` were removed. In TypeScript this is a compile error; in JavaScript the unknown key is ignored and the only symptom is the flash. Fix: `import { keepPreviousData } from '@tanstack/react-query'` and pass it as `placeholderData`, and rename every `isPreviousData` read to `isPlaceholderData`.

**★ Symptom: pagination "next" buttons stay enabled and the user double-pages past the end.** Cause: the controls are gated on `isPending`, and a query with `placeholderData` is never `pending` — *"it will start out as being in `success` state"*. Fix: gate them on `isPlaceholderData` (or `isFetching`) instead. This is the general form of the bug: any branch you wrote against `isPending` is dead code the moment you add a placeholder.

**★ Symptom: an "empty" message renders for a moment on every navigation.** Cause: `placeholderData: []` plus an unconditional `data.length === 0 && <NoResults />`. The placeholder is a real empty array and your empty-state check cannot tell it from a real one. Fix: `!isPlaceholderData && data.length === 0`. The flag exists for exactly this.

**★ Symptom: adding `initialData` to a gated query made it stop fetching when the gate opened.** Cause: two mechanics stacking. The seed was written despite `enabled: false` — a cache write is not a fetch, as [`01b`](./01b-enabled-and-skiptoken.md) sets out — and then, when the gate opened, the entry was still inside `staleTime` and therefore fresh, so opening the gate was a cache hit. Fix: `initialDataUpdatedAt`, so the seed's real age decides; or `placeholderData`, so there is no entry to be fresh.

**★ Symptom: an `initialData` function shows up in a profile as a hot path.** Cause: it is not the function form that is slow — it is that somebody wrote `initialData: expensiveComputation()` (a call, evaluated on every render) rather than `initialData: () => expensiveComputation()` (a reference, run once at initialisation). One character of difference, no type error, because both produce a valid value. Fix: pass the function. *"This function will be executed only once when the query is initialized."*

**★ Symptom: `getQueryData` returns `undefined` for a key that is visibly rendering data.** Cause: that data is placeholder data, which is never persisted. The component has a value; the cache does not. Fix: nothing is broken — but do not write mutation code that reads the cache to build an optimistic update while a placeholder is on screen, because there is nothing there to read. Branch on `isPlaceholderData` before offering the action.

**★ Symptom: a reviewer asks "why is there no `isInitialData` flag?" and the answer sounds evasive.** Cause: it feels like an omission and it is not one. Once `initialData` is in the cache it *is* the query's data; there is no second class of value to flag. The asymmetry with `isPlaceholderData` is the clearest single proof of the thesis: the library can flag a placeholder because the placeholder never entered the cache. Fix: if you need to know whether a value was seeded, you need it in the cache *and* distinguishable — which means putting a field in your own data shape, not looking for a library flag.

## Interview questions

**★ `initialData` or `placeholderData` — what is the actual decision rule?**
Ask whether the value is data or a guess. `initialData` is *"persisted to the cache"*, so it becomes the answer for that key for every observer, for `getQueryData`, and for the staleness calculation — the guide says outright it is *"not recommended to provide placeholder, partial or incomplete data"* through it. Use it only when you genuinely have the real value and putting it in the shared cache is a benefit rather than a side effect. `placeholderData` is *"not persisted to the cache"*; it is a value for this render, it flags itself through `isPlaceholderData`, and the fetch happens regardless. Anything you are inventing to avoid a spinner — an empty array, a skeleton row, the previous page — is `placeholderData`.

**★ Why is `initialData` with a non-zero `staleTime` the classic production bug?**
Because it silently removes the network request. `initialData` is *"treated as totally fresh, as if it were just fetched"*, so the staleness clock starts when you supplied the value rather than when the value was produced. With the default `staleTime: 0` the query refetches on mount and nobody notices the flaw. With `staleTime: 5 * 60_000` — an ordinary, sensible setting — you have told the library the seed is good for five minutes and it will not check. If the seed was a guess, the user reads the guess as fact for five minutes; if the seed was hour-old server-rendered HTML, they read that. The bug is invisible in development, where seeds tend to be genuinely fresh.

**★ What does `initialDataUpdatedAt` change, precisely?**
It changes which instant `staleTime` is measured from. Without it, freshness is computed from the moment you handed the value over. With it, freshness is computed from the millisecond timestamp you declare, so the library can *"decide for itself whether the data needs to be refetched"*. The behaviour you unlock is the one you actually wanted: a seed older than `staleTime` renders immediately **and** triggers a background refetch, so the user sees content instantly and correct content shortly after. Omitting it turns any long-lived seed into a lie the library is obliged to believe.

**★ You add `placeholderData` to a query. Which existing branches in the component are now dead?**
Every branch on `isPending`, and by extension `isLoading` — which v5 defines as *"`isPending && isFetching`"*. A query with placeholder data *"will not be in a `pending` state - it will start out as being in `success` state"*, so the skeleton never renders, the disabled state never applies, and an early `if (isPending) return null` is unreachable. The replacement is `isPlaceholderData` for "this is provisional" and `isFetching` for "a request is in flight". Empty-state copy is the branch people forget, because a placeholder empty array satisfies `data.length === 0` exactly as a real one does.

**★ Two components mount with the same key and pass different `initialData`. What happens?**
The cache entry is shared, so there is one value, not two — the option is documented as prepopulating the cache *if empty*, which makes the first observer to mount the one whose seed lands and the second one's a no-op. That is already a design smell: two components disagreeing about a key's initial value means at least one of them is guessing, and guesses belong in `placeholderData`, where they are per-observer and can legitimately differ. ⚠️ I could not find a sentence in the guides that states the second-observer case explicitly; it follows from "prepopulate its cache if empty" rather than being quoted, so verify against the version you install before depending on the ordering.

**★ What replaced `keepPreviousData` in v5, and what breaks quietly during the upgrade?**
The option and the `isPreviousData` flag were both removed. `placeholderData` now receives the previous data as an argument, and the library exports a `keepPreviousData` **function** you pass as `placeholderData` to get the old behaviour. What breaks quietly is a JavaScript codebase: `keepPreviousData: true` is an unrecognised key, so it is ignored with no error, and the only symptom is that paginated tables flash empty between pages. TypeScript catches it; JavaScript does not, and neither does any test that only asserts on final data.

**★ Does `placeholderData` ever prevent a fetch?**
No, and this is the cleanest way to remember the whole distinction. Preventing a fetch requires a cache entry that `staleTime` can call fresh, and `placeholderData` never creates one. So `placeholderData` is purely presentational: the request goes out exactly as it would have. `initialData` can prevent a fetch, because it does create an entry and that entry is *"treated as totally fresh"*. One option changes what the user sees; the other changes what the library believes it knows.

**★ When is `initialData` unambiguously the right choice?**
When the value is real, complete and you can state its age. Three cases qualify. Server-rendered bootstrap data threaded into a specific hook, with `initialDataUpdatedAt` set to the render timestamp. A detail record you already hold in full — not a list row that happens to share some fields, which is the trap covered in [`01e2`](./01e2-seeding-hydration-and-suspense.md). And a persisted cache read where you also stored the write time. In all three, the fact that other observers of the key benefit from the write is a feature, which is the test: if you would be unhappy for another component to render this value, it does not belong in the cache.

---

← [`retry` & `throwOnError`](./01d-retry-retrydelay-and-throwonerror.md) · [Topic index](../README.md) · Next → [Seeding, hydration & suspense](./01e2-seeding-hydration-and-suspense.md)
