---
title: "The `structuralSharing` option is a three-state switch — `true`, `false`, or a comparator you own end to end — and turning it into a comparator hands you back the all-or-nothing root identity that the built-in pass was doing per node"
sidebar_label: "01g2 · The structuralSharing option"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations) (fetched this session) and the v5 removal list in [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) (banked verbatim 2026-09-06). The `structuralSharing` TSDoc sentence is carried from the corpus bank as quoted on [06 · 01b](../06-background-refetching/01b-refetch-render-cost.md). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🎚️ `structuralSharing`: The Switch, The Comparator, And Four Interactions Nobody Documents

**[01g](./01g-structural-sharing.md) argued that the deep-equality pass is what keeps your references alive. This page is the option that controls it — what `false` really costs, what a custom comparator obliges you to reimplement, the v4 `isDataEqual` it replaced and how that port goes wrong in JavaScript without a single error, and the four places people assume structural sharing applies where the documentation does not say so: the result of `select`, a manual `setQueryData` write, `placeholderData`, and an infinite query's page array. Two of those four I could not settle from the docs, and they are marked as such rather than guessed.**

## 1. The three states

Render Optimizations, on the switch itself: the optimisation *"can be disabled via `structuralSharing: false` globally or per-query, or customized by passing a function to it."* The option's TSDoc, as banked in this corpus:

> *"Set this to `false` to disable structural sharing between query results. Set this to a function which accepts the old and new data and returns resolved data of the same type to implement custom structural sharing logic. Defaults to `true`."*

```ts
// Per query.
useQuery({ queryKey: ['telemetry'], queryFn: fetchTelemetry, structuralSharing: false });

// Globally — 🔴 this is the one that gets forgotten and then blamed on the library.
const queryClient = new QueryClient({
  defaultOptions: { queries: { structuralSharing: false } },
});
```

Three states, three very different contracts:

| Value | What you get | What you owe |
|---|---|---|
| `true` (default) | per-node reference preservation across a whole JSON tree | keep the payload JSON-compatible |
| `false` | every result is a new reference, always | every memo below it re-runs on every fetch |
| a function | exactly what your function returns, as `data` | the *entire* comparison, including any per-node preservation you still want |

🔴 **The third row is the trap.** A comparator is not a hook into the built-in walk; it *replaces* it. Whatever you return becomes `data` verbatim. The common one-liner below preserves the root when the whole payload is equal and otherwise takes the new value wholesale — so `items[3]` gets a new reference even when only `items[0]` changed, and the row-level `React.memo` granularity from [01g](./01g-structural-sharing.md) §2 is gone.

```ts
// Coarse but honest: root identity only, no per-node preservation.
structuralSharing: (oldData, newData) =>
  JSON.stringify(oldData) === JSON.stringify(newData) ? (oldData as typeof newData) : newData,
```

⚠️ **That comparator is exactly wrong for the payload people reach for it with.** `JSON.stringify(new Map([['a', 1]]))` is `"{}"`, and so is the stringification of any other `Map` — so a comparator like this declares every `Map` payload equal to every other and pins the *first* response in the cache forever. `Set` behaves the same way. `Date` does survive, because it serialises to its ISO string. If your payload is not JSON-shaped, a JSON-based comparator is not a fix, it is a data-loss bug with a clean-looking diff.

## 2. Writing a comparator that is worth the risk

The safe use of a comparator is a **cheap, explicit equality signal** the server already gives you — an ETag, a version, an `updatedAt` — not a deep walk you reimplemented.

```ts
type Telemetry = { version: number; series: SeriesPoint[] };

useQuery({
  queryKey: ['telemetry', deviceId],
  queryFn: fetchTelemetry,
  // Cheap: one integer comparison instead of walking 50k points.
  structuralSharing: (oldData, newData) => {
    const prev = oldData as Telemetry | undefined;
    const next = newData as Telemetry;
    return prev !== undefined && prev.version === next.version ? prev : next;
  },
});
```

Two contract details that TypeScript will not enforce for you:

- **Both parameters arrive as `unknown`** (noted alongside the TSDoc on [06 · 01b](../06-background-refetching/01b-refetch-render-cost.md)), so nothing stops you returning the wrong type. Whatever you return is stored as `data`. A comparator that accidentally returns a boolean puts `true` in the cache, and the failure surfaces three components away as `data.map is not a function`.
- **`oldData` is `undefined` on the first successful fetch.** A comparator that dereferences it without a guard throws inside the update path, on the happy path, on first load.

## 3. `isDataEqual` was removed in v5 — and the port inverts

The v5 removal list is explicit that this option is gone and names its replacement: *`isDataEqual`* → *a `structuralSharing` function*. That is not a rename. The two have different return types and **opposite** conventions:

```ts
// v4 — return a BOOLEAN meaning "these are equal, keep the old data".
isDataEqual: (oldData, newData) => oldData?.etag === newData.etag,

// v5 — return the DATA you want. Returning the old value is what "keep" means now.
structuralSharing: (oldData, newData) => {
  const prev = oldData as Res | undefined;
  const next = newData as Res;
  return prev !== undefined && prev.etag === next.etag ? prev : next;
},
```

🔴 **Both failure modes of a careless port are silent in JavaScript.** Leaving `isDataEqual` in place: unknown options are ignored, so your equality check simply stops being called and every response becomes a new reference — a performance regression with no error. Renaming the key but keeping the boolean body: the comparator returns `true` or `false`, and *that* becomes `data`. TypeScript catches the first as an unknown property and will not necessarily catch the second, because the parameters and the return are `unknown`. The mechanical-versus-semantic split this belongs to is in [16 · 01f](../16-migration-recipes/01f-v4-to-v5-mechanical-versus-semantic.md).

## 4. When turning it off is the right answer

Two cases, and only two.

**A payload large enough that the walk costs more than the render it prevents.** The walk is O(size of the response); the render it saves is O(size of the subtree). For a 50 k-point telemetry series rendered into one canvas, the walk is the expensive half and the render is nearly free — `structuralSharing: false`, or better, the version comparator in §2, which is O(1). Decide this by profiling your own application, not by a rule of thumb: if the component tree under the query is small or already memo-free, you are paying for an optimisation with no beneficiary.

**A payload that is not JSON-compatible anyway.** *"Structural sharing only works with JSON-compatible values, any other value types will always be considered as changed."* If your `queryFn` genuinely must return a `Map`, the pass cannot help and you are paying its cost for a guaranteed miss. Turn it off explicitly so the next reader knows it was a decision, and add a comment naming the non-JSON value.

⛔ **Neither case is "we have a lot of queries."** Structural sharing is per query and proportional to the payload, not to the cache; disabling it globally to "reduce overhead" trades an unmeasured cost for a measurable one, and every `useMemo` in the application is the counterparty.

## 5. `select` — what is settled, and what is not

Settled, from Render Optimizations:

> *"The `select` function will only re-run if: the `select` function itself changed referentially [or] `data` changed"*

> *"This means that an inlined `select` function, as shown above, will run on every render."*

Those two sentences interact with this page directly. Structural sharing keeps `data` referentially stable across an unchanged refetch, which is what stops `select` from re-running — but only if the `select` reference is *also* stable. An inline arrow is a new function on every render, so it re-runs every render regardless of how well structural sharing did upstream, and every render produces a fresh return value if that value is an object.

```ts
// ❌ New function reference every render → `select` runs every render.
useQuery({ queryKey: ['todos'], queryFn: fetchTodos, select: (d) => d.filter((t) => !t.done) });

// ✅ Module-level: one stable reference for the lifetime of the module.
const selectOpen = (todos: Todo[]) => todos.filter((t) => !t.done);
useQuery({ queryKey: ['todos'], queryFn: fetchTodos, select: selectOpen });

// ✅ When it must close over props, stabilise it.
const selectByOwner = useCallback((todos: Todo[]) => todos.filter((t) => t.owner === owner), [owner]);
```

⚠️ **I could not confirm whether the *result* of `select` is itself passed through structural sharing.** The guide states that a `select` returning `data.length` gives you a component that *"will only re-render if the length of the todos changes. It will **not** re-render if e.g. the name of a todo changed"* — but that example returns a number, and a number needs no structural sharing to compare equal, so it does not settle the question for an object or array result. Do not build on it. The engineering rule that holds either way: **have `select` return a primitive or the narrowest slice you can, keep the function reference stable, and treat a fresh object out of `select` as a fresh reference.** The `select` option itself is owned by [`01f` of topic 02](../02-usequery-deep-dive/01f-select.md), which carries the same open marker on the same question — the two pages agree that it is unsettled rather than each guessing a different way.

## 6. `setQueryData`, `placeholderData`, and infinite pages

**`setQueryData`.** ⚠️ The documentation describes structural sharing in terms of what the `queryFn` returns; **I could not confirm whether a manual write is passed through the same comparison.** Write code that does not care, which is the rule [01e](./01e-direct-cache-access.md) already gives you for other reasons: produce a new reference for everything you changed and reuse the old references for everything you did not, so the outcome is correct whether or not anything compares it afterwards.

```ts
// Correct regardless of whether setQueryData applies structural sharing:
// changed rows are new objects, unchanged rows are the SAME objects.
queryClient.setQueryData<Todo[]>(['todos'], (old) =>
  old?.map((t) => (t.id === id ? { ...t, done: true } : t))
);
```

🔴 **Do not use "the reference did not change" as evidence that a `setQueryData` did nothing.** Under the default, writing a deeply-equal value is indistinguishable from writing nothing at all, from the component's point of view — which is a feature for an optimistic update that the server later confirms verbatim, and a very confusing hour for anyone debugging a write with a `console.log` on a render.

**`placeholderData`.** In v5, `keepPreviousData` and `isPreviousData` are gone and *"`placeholderData` now receives the previous data as an argument"*, with the flag renamed to `isPlaceholderData`. The identity behaviour of the standard idiom needs no library machinery at all — the function hands back the very object it was given, so the reference is trivially stable across the key change:

```ts
useQuery({
  queryKey: ['projects', page],
  queryFn: () => fetchProjects(page),
  placeholderData: (previousData) => previousData, // literally the same object
});
```

A placeholder built fresh instead — `placeholderData: () => ({ items: [] })` — is a **new** reference on every evaluation, so a memo keyed on `data` busts each time a placeholder is produced. Hoist it to a module constant if that matters.

**Infinite queries.** An infinite query's data is a `{ pages, pageParams }` container. ⚠️ **The guides do not call out infinite queries in the structural-sharing discussion,** so treat what follows as the design consequence of the general rule rather than a documented guarantee: fetching a next page necessarily produces a new `pages` array (it has one more element), so `data` and `data.pages` always change identity on `fetchNextPage`, and only the already-loaded page objects can be preserved. The practical consequences are the ones topic 07 already teaches: never flatten in the render body, memoise the flatten on `[data]`, and key rows by id so that a preserved page object is worth something — [07 · 01c](../07-pagination-and-infinite-queries/01c-rendering-and-concurrency.md).

## Gotchas

**★ Symptom: after adding a custom `structuralSharing`, a fine-grained table went back to re-rendering every row on any change.** Cause: a comparator replaces the built-in walk rather than extending it, so the coarse "equal → old, otherwise new" one-liner gives you root identity and nothing below it. Fix: either accept it (correct when the whole payload is rendered as one unit) or preserve the levels you care about yourself — compare and reuse per element, not per payload. If per-node preservation is what you wanted, the default `true` already does it and the comparator is a downgrade.

**★ Symptom: a `Map`-shaped payload never updates again after the first successful fetch.** Cause: a `JSON.stringify`-based comparator. `JSON.stringify` of any `Map` or `Set` is `"{}"`, so every response compares equal to every other and the comparator keeps returning `oldData` forever. Fix: compare on a real signal — a version or ETag field as in §2 — or convert the payload to an array of entries in the `queryFn` so it is JSON-shaped and the default pass works.

**★ Symptom: `data.map is not a function` in a component that never touched the fetch layer.** Cause: an `isDataEqual` body ported to `structuralSharing` without changing the return type, so the comparator returns a boolean and the boolean is stored as `data`. Both parameters and the return are `unknown`, so this compiles. Fix: return `oldData` to mean "keep", `newData` to mean "replace", and never a boolean — §3 shows the corrected port.

**★ Symptom: after the v5 upgrade a heavy query became noticeably jankier, with no error anywhere.** Cause: `isDataEqual` was left in the options object. It was removed in v5, unknown options are ignored, and in JavaScript nothing complains — the cheap equality check you relied on simply stopped running. Fix: grep the codebase for `isDataEqual` as part of the upgrade audit; it is on the removals list in [16 · 01f](../16-migration-recipes/01f-v4-to-v5-mechanical-versus-semantic.md), and removals are the class that is loud in TypeScript and silent in JavaScript.

**★ Symptom: a comparator throws on the very first successful fetch.** Cause: `oldData` is `undefined` before there is anything cached, and the comparator dereferenced it. Fix: guard it — `prev !== undefined && prev.version === next.version ? prev : next`. This is on the happy path, so it fails for every user on first load and never in a warm-cache test.

**★ Symptom: `structuralSharing: false` was set globally "for performance" and now every memo in the application recomputes on every window focus.** Cause: the option was applied to the whole `QueryClient` for the sake of one large query. It is a per-query cost proportional to payload size, not a global overhead. Fix: move it to the one query that justified it, or replace it there with an O(1) comparator; leave the client default alone.

**★ Symptom: an inline `select` makes a component re-render on every parent render even though the query is idle.** Cause: an inline arrow is a new reference each render, and *"the `select` function will only re-run if: the `select` function itself changed referentially [or] `data` changed"* — so it re-runs, and if it returns an object that is a new reference every time. Fix: hoist it to module scope or wrap it in `useCallback`, and prefer returning a primitive.

**★ Symptom: paginating with `placeholderData` re-renders the whole page shell between pages.** Cause: the placeholder is being constructed rather than passed through — `() => ({ items: [] })` is a new object every evaluation. Fix: use `(previousData) => previousData` when you want the previous page to stay on screen, or hoist a constant empty placeholder to module scope when you genuinely want an empty shell.

## Interview questions

**★ What are the three states of `structuralSharing`, and which one is a bigger decision than it looks?**
`true`, the default, walks the incoming value against the cached one and preserves every deeply-equal sub-tree. `false` disables it, so every result is a new reference. A function replaces it: *"Set this to a function which accepts the old and new data and returns resolved data of the same type to implement custom structural sharing logic."* The function is the bigger decision, because people reach for it expecting a hook into the built-in walk and instead get full ownership of the comparison. Whatever it returns becomes `data`, and the typical one-line implementation gives you root identity only — no per-element preservation — which is often a net loss for a list.

**★ `isDataEqual` was removed in v5. What is the exact difference between it and its replacement, and why is the port dangerous in JavaScript?**
`isDataEqual` returned a boolean meaning "these are equal, keep the old data". `structuralSharing` returns the *data* you want to keep, so "keep" is expressed by returning `oldData`. The port is dangerous because both mistakes are silent in JavaScript: leaving the old key in place means an unknown option that is ignored, so your equality check never runs and you get a quiet performance regression; changing the key but keeping the boolean body means `true` or `false` is stored as `data`, and the failure appears far away as a type error at render. TypeScript catches the first and does not reliably catch the second, since both parameters and the return are `unknown`.

**★ When would you actually turn structural sharing off?**
When the walk costs more than the render it prevents, or when it cannot work at all. The first is a very large payload feeding a small render surface — a 50 k-point series drawn onto one canvas — where you are paying an O(payload) comparison to avoid an O(nothing) re-render; the honest fix there is usually an O(1) comparator on a server-supplied version rather than a flat `false`. The second is a payload that is not JSON-compatible, where *"any other value types will always be considered as changed"* and you are paying the walk for a guaranteed miss. What is never a reason is "we have many queries" — the cost is per query and per payload, not global.

**★ Does structural sharing apply to the value your `select` returns?**
I would not claim either way from the documentation. What it does say is when `select` runs: *"The `select` function will only re-run if: the `select` function itself changed referentially [or] `data` changed"*, and that an inline `select` therefore runs on every render. The illustrative example in the guide returns `data.length`, a number, so the fact that the component only re-renders when the length changes is explained by ordinary value equality and does not settle the object case. The safe engineering position is to make `select` stable and cheap and to return the narrowest thing you can, so that the answer stops mattering.

**★ If you write a deeply-equal value with `setQueryData`, does the component re-render?**
The documentation frames structural sharing around `queryFn` results, and does not state whether a manual write goes through the same comparison — so I would not assert it. The behaviour to design for is that it might: a write producing a value indistinguishable from the current one may be indistinguishable from no write at all to a subscriber. That is desirable for an optimistic update the server confirms verbatim, and it is a trap for anyone using a re-render as proof that a write landed. Either way, the correct write is the one that is right under both regimes — new references for what changed, old references for what did not.

**★ Why does `data` identity always change when you call `fetchNextPage` on an infinite query, and does that make structural sharing useless there?**
Because the new page array has one more element than the old one, so it cannot be the same array, and the `{ pages, pageParams }` container above it cannot be the same object either. It does not make the feature useless: the already-loaded page objects can still be preserved, so a memoised page or row component beneath does not re-render just because a later page arrived. It does mean that any memo keyed on `data` or `data.pages` recomputes on every page fetch — which is fine for a flatten you memoise once, and expensive for anything heavier. The guides do not discuss infinite queries in this context, so treat that as the design consequence of the general rule rather than a stated guarantee.

**★ Two engineers disagree: one says structural sharing "prevents unnecessary re-renders", the other says tracked properties do. Who is right?**
Both, about different halves. Structural sharing decides whether the *value* changed — it is what makes an unchanged refetch produce the same `data` reference. Tracked properties decide whether the component is *notified* at all: *"React Query will only trigger a re-render if one of the properties returned from `useQuery` is actually 'used'."* A component that reads only `data` is protected by the first; a component that also reads `isFetching` is re-rendered twice per refetch by design and no amount of structural sharing changes that. Diagnosing a re-render means asking which of the two is in play, and the reference probe in [01g](./01g-structural-sharing.md) §5 answers it in about a minute.

---

← [Structural sharing](./01g-structural-sharing.md) · [Topic index](../README.md) · Next → [Query key factories](./01h-query-key-factories.md)
