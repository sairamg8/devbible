---
title: "Structural sharing is why a query polling every five seconds does not re-render its subtree every five seconds — each response is walked against the previous cached value and every deeply-equal sub-tree keeps its old reference, node by node"
sidebar_label: "01g · Structural sharing"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Render Optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations) (fetched this session) and [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) (banked verbatim by the 2026-09-06 pass). The Important Defaults sentence on JSON-compatible values is carried from that bank and is also quoted on [06 · 01b](../06-background-refetching/01b-refetch-render-cost.md). Documentation-validated, **no sandbox run, no timings, no profiler numbers**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session bc194850

# 🧬 Structural Sharing: The Deep-Equality Pass That Keeps Your References Alive

**Every response your `queryFn` resolves is a brand-new object graph — `JSON.parse` cannot hand you anything else. Left alone, that would make `data` a new reference on every poll, every window focus and every reconnect, busting every `useMemo`, every `useEffect` dependency array and every `React.memo` beneath it. TanStack Query's default behaviour is to walk the incoming value against the one already in the cache and keep the old reference for every sub-tree that is deeply equal — not just for the root, but for each node independently. That is why a five-second poll over unchanged data costs a network round-trip and zero renders, and it is completely invisible until a `new Date()` in a response mapper turns it off.**

## 1. The sentence this whole page unpacks

Important Defaults, on what the library does with a result before it reaches you:

> *"Query results by default are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged"*

The Render Optimizations guide states the same mechanism with the crucial extra clause — what happens when *part* of the payload changed:

> *"React Query uses a technique called 'structural sharing' to ensure that as many references as possible will be kept intact between re-renders."*

> *"If data is fetched over the network, usually, you'll get a completely new reference by json parsing the response. However, React Query will keep the original reference if _nothing_ changed in the data. If a subset changed, React Query will keep the unchanged parts and only replace the changed parts."*

"Keep the unchanged parts" is the load-bearing phrase. This is not a single top-level equality check that either preserves `data` wholesale or throws it away wholesale. It is per-node.

## 2. The walk, node by node

Conceptually the library holds two trees — the value already in the cache and the value just parsed off the wire — and produces a third that reuses as much of the first as it legally can.

```text
cached value                          incoming JSON.parse() result
{ items: [A, B, C], meta: M }         { items: [A', B', C'], meta: M' }
       │                                        │
       └──────── deep-equality walk, both trees together ────────┘
                              │
            A deep-equal A' ──────► keep A   (the OLD object)
            B differs       ──────► take B'  (the NEW object)
            C deep-equal C' ──────► keep C   (the OLD object)
            M deep-equal M' ──────► keep M   (the OLD object)
                              │
      result: { items: [A, B', C], meta: M }
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   `data` is a NEW object and `data.items` is a NEW array — one child changed,
   so every ancestor on the path to it must change. But A, C and `meta` are the
   SAME references the component rendered last time.
```

Two rules fall out of that picture, and both matter more than the headline:

1. **A change propagates upward, never sideways.** If `items[1]` changed, `items` and `data` are new references — an ancestor cannot keep its identity when a descendant moved. Siblings are untouched.
2. **If nothing changed anywhere, the root itself is preserved**, so `data === previousData` holds literally, and a `useEffect(..., [data])` does not fire.

That per-node preservation is the entire reason `React.memo` on a row component works in this library without you writing a comparator. A refetch of a 400-row table where one row changed re-renders one row.

## 3. Why this controls re-render count

A `useQuery` subscriber is woken when something it reads changes. `data` is compared by reference — nothing walks your payload a second time at render, so an unchanged reference is indistinguishable from "no update" to every consumer downstream:

```tsx
const Row = React.memo(function Row({ incident }: { incident: Incident }) {
  return <li>{incident.title}</li>;
});

function IncidentList() {
  const { data } = useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    refetchInterval: 5000,
  });

  // Runs only when `data` is a NEW reference — i.e. when something actually changed.
  const open = useMemo(() => data?.filter((i) => i.status === 'open') ?? [], [data]);

  return <ul>{open.map((i) => <Row key={i.id} incident={i} />)}</ul>;
}
```

With structural sharing intact, a poll that returns byte-identical JSON produces: no new `data`, no `useMemo` recompute, no `Row` re-render. A poll where one incident's title changed produces: a new `data`, one `useMemo` recompute, and exactly one `Row` re-render — because the other 399 `incident` props are the same objects `React.memo` saw last time.

Without it, the same two polls both produce: a new `data`, a `useMemo` recompute, and 400 `Row` re-renders. Every twelve seconds a minute. The network cost is identical in both worlds; the render cost differs by two orders of magnitude.

🔴 **This is also why "my component did not re-render, so the refetch failed" is a false inference.** It is the most common misreading of a devtools session, and it is covered from the panel's side in [11 · 01d](../11-devtools/01d-stale-fresh-inactive-and-eviction.md). Judge a fetch by the query's own activity and `dataUpdatedAt`, never by a render.

## 4. The precondition: JSON-compatible data

Structural sharing is not a general-purpose deep clone. Render Optimizations states its precondition flatly:

> *"This optimization only works if the `queryFn` returns JSON compatible data."*

Important Defaults says the same thing from the failure side, and this is the sentence to memorise:

> *"Structural sharing only works with JSON-compatible values, any other value types will always be considered as changed."*

So the risk surface is anything a `JSON.parse` result cannot contain: `Date`, `Map`, `Set`, `BigInt`, functions, and class instances produced by a mapper or a client SDK. **The single most common way a codebase loses structural sharing is a response mapper that revives timestamps:**

```ts
// ❌ Every poll now produces a brand-new `data` reference, changed or not.
const useIncidents = () =>
  useQuery({
    queryKey: ['incidents'],
    refetchInterval: 5000,
    queryFn: async (): Promise<Incident[]> => {
      const res = await fetch('/api/incidents');
      const rows: IncidentDto[] = await res.json();
      return rows.map((r) => ({ ...r, openedAt: new Date(r.openedAt) }));
    },
  });
```

The fix is to keep the *cached* value JSON-shaped and move the non-serialisable construction to the edge that needs it — a formatter at render time, or a stable `select`:

```ts
// ✅ The cache holds exactly what the wire sent; `openedAt` stays an ISO string.
const useIncidents = () =>
  useQuery({
    queryKey: ['incidents'],
    refetchInterval: 5000,
    queryFn: async (): Promise<IncidentDto[]> => {
      const res = await fetch('/api/incidents');
      return res.json();
    },
  });

// Render-time formatting: no Date ever enters the cache.
const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const openedLabel = (dto: IncidentDto) => fmt.format(Date.parse(dto.openedAt));
```

⚠️ **The two sources state the precondition and the classification — "will always be considered as changed" — but neither states the mechanics of what happens to a non-JSON value inside the walk** (whether the whole payload is replaced, or only the sub-tree containing it, and whether a `Date` nested three levels down poisons its siblings). I could not confirm that from the documentation; design as if any non-JSON value gives you a fresh reference for at least its own sub-tree, and verify against the version you install if you need the finer answer.

`Date` is worth calling out separately because it fails *quietly on both sides of the wire*: it is not JSON-compatible for structural sharing, and it is not stable under `JSON.stringify` round-tripping either. The same serialisability constraint governs query keys — *"As long as the query key is serializable using `JSON.stringify`, and unique to the query's data, you can use it!"* — which is the same discipline applied to a different part of the same library.

## 5. How to actually observe it

There is no flag in the devtools that says "this reference was preserved". The panel shows the query's state, its `dataUpdatedAt` and its fetch activity, none of which distinguishes a preserved reference from a replaced one — see [11 · 01-react-query-devtools](../11-devtools/01-react-query-devtools.md) for what the panel does show. Reference identity is a JavaScript question, so answer it in JavaScript:

```tsx
/** Dev-only. Warns when `value` changes identity, and says which top-level child moved. */
function useIdentityProbe(value: unknown, label: string) {
  const previous = useRef<unknown>(undefined);
  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before === undefined || before === value) return;

    console.warn(`[identity] ${label}: root reference changed`);
    if (
      before !== null && value !== null &&
      typeof before === 'object' && typeof value === 'object'
    ) {
      for (const key of Object.keys(value as object)) {
        const a = (before as Record<string, unknown>)[key];
        const b = (value as Record<string, unknown>)[key];
        if (a !== b) console.warn(`[identity]   └─ .${key} changed`);
      }
    }
  });
}

// Usage inside the component under investigation:
const { data } = useQuery({ queryKey: ['incidents'], queryFn: fetchIncidents });
useIdentityProbe(data, 'incidents');
```

Read the result like this. **Root changes on every poll while the payload is visibly identical** → structural sharing is not applying; look for a non-JSON value in the `queryFn` or a `structuralSharing: false` in a default you forgot about. **Root changes and exactly the keys that really changed are listed** → it is working, and your re-renders are coming from somewhere else. **Nothing logs at all across many polls** → it is working perfectly and the component is not your problem.

🔴 **Do not ship this probe.** Wrap it in `if (process.env.NODE_ENV !== 'production')` at the call site or delete it when you are done; it holds a reference to every value it has seen.

## 6. The other re-render lever, and how to tell the two apart

Structural sharing decides whether `data` *changed*. Tracked properties decide whether a component that read some *other* field is woken at all:

> *"React Query will only trigger a re-render if one of the properties returned from `useQuery` is actually 'used'."*

> *"This avoids a lot of unnecessary re-renders, e.g. because properties like `isFetching` or `isStale` might change often, but are not used in the component."*

> *"You can customize this feature by setting `notifyOnChangeProps` manually globally or on a per-query basis."* … *"If you want to turn that feature off, you can set `notifyOnChangeProps: 'all'`."*

They fail differently and the fixes are unrelated. A component re-rendering on every refetch **despite** unchanged data is usually reading `isFetching` — often by accident, through object rest destructuring — and structural sharing has nothing to do with it. A component re-rendering on every refetch and whose `data` identity also moved is a structural-sharing failure. Run the probe above before you touch `notifyOnChangeProps`; the full tracked-properties treatment, including the three separate ways the Proxy is defeated, is in [06 · 01b](../06-background-refetching/01b-refetch-render-cost.md).

The option that controls the pass itself — `structuralSharing: false`, a custom comparator, the `isDataEqual` it replaced in v5, and how it interacts with `select`, `setQueryData`, `placeholderData` and infinite pages — is [01g2](./01g2-structuralsharing-option-and-interactions.md).

## Gotchas

**★ Symptom: a five-second poll re-renders a large table every five seconds, and the payload never changes.** Cause: the `queryFn` returns something that is not JSON-compatible — nearly always a `Date` revived in a response mapper, sometimes a `Map` keyed by id, sometimes class instances from a generated API client. *"Structural sharing only works with JSON-compatible values, any other value types will always be considered as changed."* Fix: return the parsed JSON unchanged from the `queryFn` and construct the `Date`/`Map` where it is consumed, as in §4. If the shape genuinely must live in the cache, you have not fixed structural sharing — see the custom comparator in [01g2](./01g2-structuralsharing-option-and-interactions.md).

**★ Symptom: `data` is a new reference after a refetch even though "only one field changed", and you conclude structural sharing is broken.** Cause: it is working exactly as documented. A change to any descendant forces every ancestor on the path to it — including the root — to be a new reference. Fix: stop asserting on `data` identity and assert on the sub-tree you care about. `data.items[3] === previousItems[3]` is the property structural sharing gives you; `data === previousData` is only true when *nothing* changed.

**★ Symptom: you mutate the cached value in place and nothing re-renders, then you blame structural sharing.** Cause: an in-place mutation means the old and the new value are the *same object*, so there is no "new" value to compare against anything — the notification never happens for reasons that precede this pass. Fix: write through `setQueryData` with a new reference at every level you changed; the full rule and the `getQueryData`-returns-a-live-reference trap are in [01e](./01e-direct-cache-access.md).

**★ Symptom: an `useEffect` keyed on `[data]` fires on every window focus in one app and never in another, with the same code.** Cause: one of them has a non-JSON value in the payload and the other does not. This is a data-shape bug that presents as a lifecycle bug, and it will follow a single new field added by the backend. Fix: run the identity probe from §5 on both, and treat "the API started returning a `Date`-shaped mapper output" as a reviewable change.

**★ Symptom: a `React.memo`'d child re-renders on every refetch even though its own prop is unchanged.** Cause: you are passing the *result object* down, not the payload — `<Panel query={result} />`. The object `useQuery` returns is a fresh object every render and structural sharing says nothing about it; it applies to `data`. Fix: pass `data`, or the specific slice, and never the whole result.

**★ Symptom: `dataUpdatedAt` moves but the UI does not, and a bug report says "the refresh button does nothing".** Cause: the response was identical, so the reference was preserved and nothing re-rendered — which is correct. Fix: this is a UX problem, not a cache problem. Render the fetch state (a spinner or a subtle timestamp) rather than relying on content movement as feedback; the devtools version of this misreading is in [11 · 01e](../11-devtools/01e-panel-actions-and-cache-effects.md).

**★ Symptom: a test asserts `expect(result.current.data).not.toBe(previous)` after a refetch and fails intermittently.** Cause: the mock returned deep-equal data, so the reference was preserved by design. Fix: assert on values, not identity — or, when identity *is* the thing under test, make the second mock response genuinely different and assert the preserved siblings instead: change one element and assert the others are `toBe` their previous selves. That test actually documents the behaviour; the identity-inequality one documents nothing.

**★ Symptom: the payload is huge and every refetch stalls the main thread even though nothing re-renders.** Cause: the deep-equality walk is not free — it visits the incoming tree, and on a multi-megabyte response it can cost more than the render it saved. Fix: this is the legitimate case for turning it off, and it is a measurement, not a guess — see the decision procedure in [01g2](./01g2-structuralsharing-option-and-interactions.md).

## Interview questions

**★ Why does a component subscribed to a query that polls every five seconds not re-render every five seconds?**
Because query results are structurally shared: *"Query results by default are structurally shared to detect if data has actually changed and if not, the data reference remains unchanged."* The `queryFn` genuinely produces a brand-new object graph each time — `JSON.parse` cannot do otherwise — but before that value reaches an observer it is walked against the cached one, and any sub-tree that is deeply equal keeps the reference the component already rendered with. When nothing changed at all, `data` is literally the same object, and an unchanged reference is not an update. The consequence for debugging is that a re-render is a bad proxy for a fetch, in both directions.

**★ What exactly is preserved — the whole `data` object, or parts of it?**
Parts of it, independently, which is what makes the feature worth anything. The guide says *"if a subset changed, React Query will keep the unchanged parts and only replace the changed parts."* If one element of a 400-element array changed, you get a new `data` and a new array — an ancestor cannot keep its identity when a descendant moved — but the other 399 elements are the same objects as before. That is precisely the property `React.memo` on a row component needs, and it is why you get row-level render granularity in this library without writing a single custom comparator.

**★ What kinds of data silently defeat it, and why is `Date` the usual culprit?**
Anything a JSON document cannot contain. Render Optimizations: *"This optimization only works if the `queryFn` returns JSON compatible data"*; Important Defaults: *"Structural sharing only works with JSON-compatible values, any other value types will always be considered as changed."* So `Date`, `Map`, `Set`, `BigInt`, functions and class instances are all risk. `Date` dominates because reviving timestamps in a response mapper is a completely ordinary thing to do, it is invisible in a code review, it produces no error, and it converts every background refetch into a full subtree re-render. The fix is to keep the cached value wire-shaped and build the `Date` where it is formatted.

**★ A component re-renders on every background refetch. How do you work out whether structural sharing or tracked properties is responsible?**
Check reference identity first, because it is cheap and unambiguous: hold the previous `data` in a `useRef` and log when it changes. If `data` identity moves on every poll while the payload is visibly unchanged, structural sharing is not applying and you have a non-JSON value in the `queryFn` or an inherited `structuralSharing: false`. If `data` identity is stable and the component still re-renders, the component is reading a property that genuinely changes — `isFetching` flips twice per refetch — often through an object rest destructure that marks every property as read. Those two diagnoses have nothing in common and neither fix helps the other case.

**★ Does structural sharing reduce network traffic?**
No, and confusing the two is a real design error. The request still goes out, the body is still downloaded, and it is still parsed; structural sharing operates entirely after that, on the parsed value. What it reduces is *render* work and the cascade of invalidated memoisation below it. If the problem is traffic, the levers are `staleTime`, the `refetchOn*` family and the polling interval — see [01f](./01f-staletime-vs-gctime.md).

**★ Why is a change to a leaf node enough to give you a new root reference, and is that a flaw?**
It is a necessity of immutable data, not a flaw. If `items[1]` is a different object, the array containing it must be a different array — the old array still points at the old object — and the object containing that array must likewise be new. Identity propagates up the path from the change to the root and stops there. It is not a flaw because nothing useful hangs off root identity alone; the memoisation you actually depend on is keyed on the sub-tree a component renders, and those siblings are exactly what is preserved.

**★ Someone proposes asserting `data === previousData` in production code to detect "no change". Is that sound?**
It is sound as an observation and unsound as a contract. The behaviour is documented, so the identity does hold for a refetch returning identical JSON — but it is a rendering optimisation, it is switchable per query and globally by an option somebody else may set, and it stops applying the moment a non-JSON value enters the payload. Any logic whose correctness depends on it becomes a bug the day a mapper is added. Depend on it for `useMemo` dependencies and `React.memo`, where a false "changed" costs a render and nothing else; never for business decisions such as "did the server change this record" — use `dataUpdatedAt` or a version field from the server for that.

---

← [`staleTime` vs `gcTime`](./01f-staletime-vs-gctime.md) · [Topic index](../README.md) · Next → [The `structuralSharing` option and its interactions](./01g2-structuralsharing-option-and-interactions.md)
