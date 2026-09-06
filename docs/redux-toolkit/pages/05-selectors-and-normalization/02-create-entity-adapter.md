---
title: "`createEntityAdapter`: Normalized State & Generated CRUD"
sidebar_label: "`createEntityAdapter`"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`createEntityAdapter`](https://redux-toolkit.js.org/api/createEntityAdapter),
> [RTK 2.0 migration](https://redux-toolkit.js.org/usage/migrating-rtk-2).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 `createEntityAdapter`: Normalized State & Generated CRUD

## 1. Under-The-Hood Mechanics

`createEntityAdapter<T>()` generates a standard shape and a set of pure reducer functions for storing collections of same-typed records, replacing hand-written array-manipulation logic (`find`, `findIndex`, `splice`, `map`) with $O(1)$ lookups.

### Why Normalize
Storing entities as a nested array (`state.users = [{...}, {...}]`) means finding/updating one user is an $O(n)$ `.find()`/`.map()` scan, and the same user object often gets duplicated across unrelated parts of the tree (a post's `author` field, a comments list, a mentions widget) — updating one copy doesn't update the others. Normalization stores each entity **once**, keyed by id:

```
{
  ids: ['u_1', 'u_2', 'u_3'],           // ordered array of ids (this IS the sort order)
  entities: {
    'u_1': { id: 'u_1', name: 'Alex' },
    'u_2': { id: 'u_2', name: 'Sam' },
    'u_3': { id: 'u_3', name: 'Jo' },
  }
}
```
Every other part of the app references users by `id` string and looks them up in `entities` — a single source of truth, updated once, read everywhere.

### Generated CRUD Reducer Methods
`usersAdapter.getInitialState()` seeds the `{ ids, entities }` shape (optionally merged with extra custom fields like `status`). The adapter then exposes reducer helper functions to call **inside** your own `createSlice` reducers:

| Method | Behavior |
|---|---|
| `addOne` / `addMany` | Insert new entities (no-op on existing ids unless combined with upsert) |
| `setOne` / `setMany` / `setAll` | Add or fully replace one, several, or the whole collection |
| `upsertOne` / `upsertMany` | Insert if new, shallow-merge if existing |
| `updateOne` / `updateMany` | Partial patch of an existing entity via `{ id, changes }` |
| `removeOne` / `removeMany` / `removeAll` | Delete by id(s) |

### Generated Selectors
`usersAdapter.getSelectors()` returns memoized `selectAll`, `selectById`, `selectIds`, `selectEntities`, `selectTotal` — built with `createSelector` internally, so scanning `selectAll` is memoized against the `{ ids, entities }` reference.

### What RTK 2.0 changed here
`createEntityAdapter` gained an **`Id` generic** — `createEntityAdapter<Comment, string>()` — so the id
type is no longer inferred as `string | number` regardless of what your entity actually uses. In the same
release the exported **`Dictionary` type was removed**; the `entities` map is typed with a plain
`Record` now. Code written against RTK 1.x that imported `Dictionary` will not compile.

### `sortComparer`
Passing `sortComparer: (a, b) => a.name.localeCompare(b.name)` to `createEntityAdapter` keeps the `ids` array maintained in sorted order automatically on every insert/update — `selectAll` always returns entities pre-sorted, with no separate sort step needed at read time.

---

## 2. Real-World Engineering Scenario

**Scenario**: Real-Time Collaborative Document Editor — Thousands of Comment Threads.
A document with thousands of inline comments needs: instant lookup of a specific comment by id (when a user clicks a highlight), an always-sorted-by-timestamp list for the sidebar, and safe partial updates (resolving one comment) without re-rendering the entire sidebar. `createEntityAdapter` with `sortComparer: (a, b) => a.createdAt - b.createdAt` gives $O(1)$ lookup for the click-to-scroll interaction and an always-correct sorted list for the sidebar, using generated `updateOne` for the resolve action so only that one entity's object reference changes.

---

## 3. Production-Grade Code Example

```typescript
import { createEntityAdapter, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Comment {
  id: string;
  text: string;
  authorId: string;
  createdAt: number;
  resolved: boolean;
}

const commentsAdapter = createEntityAdapter<Comment>({
  sortComparer: (a, b) => a.createdAt - b.createdAt,
});

interface CommentsState {
  status: 'idle' | 'loading';
}

const commentsSlice = createSlice({
  name: 'comments',
  initialState: commentsAdapter.getInitialState<CommentsState>({ status: 'idle' }),
  reducers: {
    commentsLoaded: (state, action: PayloadAction<Comment[]>) => {
      commentsAdapter.setAll(state, action.payload);
    },
    commentAdded: (state, action: PayloadAction<Comment>) => {
      commentsAdapter.addOne(state, action.payload);
    },
    commentResolved: (state, action: PayloadAction<string>) => {
      commentsAdapter.updateOne(state, { id: action.payload, changes: { resolved: true } });
    },
    commentRemoved: commentsAdapter.removeOne,
  },
});

export const { commentsLoaded, commentAdded, commentResolved, commentRemoved } = commentsSlice.actions;
export const commentsReducer = commentsSlice.reducer;

// Generated, memoized selectors
export const {
  selectAll: selectAllComments,
  selectById: selectCommentById,
  selectIds: selectCommentIds,
  selectTotal: selectCommentTotal,
} = commentsAdapter.getSelectors((state: { comments: ReturnType<typeof commentsSlice.reducer> }) => state.comments);
```

```tsx
function CommentSidebar() {
  const comments = useSelector(selectAllComments); // always sorted by createdAt, O(1) reference-stable
  return (
    <ul>
      {comments.map((c) => (
        <li key={c.id} className={c.resolved ? 'opacity-50' : ''}>{c.text}</li>
      ))}
    </ul>
  );
}

function CommentHighlight({ commentId }: { commentId: string }) {
  // O(1) lookup by id — no array scan even with thousands of comments
  const comment = useSelector((state: RootState) => selectCommentById(state, commentId));
  return comment ? <span>{comment.text}</span> : null;
}
```

---

## Gotchas

### Expecting `addOne` to update an entity that already exists
**Symptom.** A "refresh" action appears to do nothing for records already on screen, and works
perfectly for new ones.
**Cause.** The docs are explicit: if an entity already exists, "`addOne` and `addMany` will do nothing
with the new entity". It is not a merge and not a replace — it is a no-op.
**Fix.**
```typescript
// ❌ WRONG assumption: addOne is a no-op if the id already exists — it will NOT update it
commentsAdapter.addOne(state, updatedComment); // silently does nothing if id already present!

// ✅ CORRECT: use upsertOne when the entity may or may not already exist
commentsAdapter.upsertOne(state, updatedComment);
```

### Not telling the adapter which field is the id
**Symptom.** Entities land under a key of `undefined`, and `selectById` never finds anything.
**Cause.** The default `selectId` is `entity => entity.id`. An API returning `_id`, `uuid` or `sku`
produces `undefined` ids and every record collapses onto one key.
**Fix.**
```typescript
// ❌ WRONG: adapter defaults to reading entity.id — misbehaves if your API uses `_id` or `uuid`
createEntityAdapter<Comment>();

// ✅ CORRECT: tell the adapter which field is the identity
createEntityAdapter<Comment, string>({ selectId: (comment) => comment.uuid });
```

### Expecting `sortComparer` to sort data that arrived another way
**Symptom.** The list is sorted after an `addOne` and unsorted after the initial load, or after a
hand-written mutation of `state.ids`.
**Cause.** Sorting "only kicks in when state is changed via one of the CRUD functions" — the adapter
maintains order as a side effect of its own operations, not as an invariant it enforces on the state
shape.
**Fix.** Route every write through the adapter, `setAll` included. Never assign to `state.ids` or
`state.entities` directly next to an adapter that believes it owns the order.

### `updateOne` with a whole entity instead of `{ id, changes }`
**Symptom.** A type error, or a record whose fields are silently replaced by nested nonsense.
**Cause.** `updateOne` takes an **update object**, not an entity. `upsertOne` takes the entity.
**Fix.** `updateOne(state, { id, changes: { resolved: true } })` for a partial patch;
`upsertOne(state, entity)` when you hold the whole record. Note `changes` is a shallow merge — a nested
object in `changes` replaces its counterpart wholesale rather than merging into it.

### Re-sorting the output of `selectAll`
**Symptom.** A `.sort()` in a component on top of an adapter that already has a `sortComparer`.
**Cause.** Not knowing the order is maintained, or inherited code from before the comparer existed.
**Fix.** Trust the adapter. Worse than the wasted work is that the sort logic now lives in two places
and can drift; when the comparer changes, the component's copy silently wins.

### Calling `getSelectors()` with no argument and using it against `RootState`
**Symptom.** `selectAll` returns `undefined`, or TypeScript complains that `ids` is missing from
`RootState`.
**Cause.** `getSelectors()` with no argument produces selectors that expect the **slice's** state.
`getSelectors(state => state.comments)` produces ones that expect the root.
**Fix.** Pick per call site, and be deliberate about which you export.
```typescript
// Against the slice's own state — e.g. inside another selector that already narrowed
const localSelectors = commentsAdapter.getSelectors();

// Against RootState — what components want
export const { selectAll: selectAllComments } =
  commentsAdapter.getSelectors((state: RootState) => state.comments);
```

### Importing the `Dictionary` type after an RTK 2 upgrade
**Symptom.** `Module '"@reduxjs/toolkit"' has no exported member 'Dictionary'`.
**Cause.** RTK 2.0 removed it in favour of standard TypeScript types.
**Fix.** `Record<string, Comment | undefined>` — and note the `| undefined`, because indexing the
entities map with an arbitrary id can legitimately miss.

### Normalising something that is really server cache
**Symptom.** An adapter, a thunk triple and a set of tags all describing the same list.
**Cause.** `createEntityAdapter` predates RTK Query and a lot of code still hand-normalises data that
RTK Query already caches by endpoint and argument.
**Fix.** Normalise **client-owned** state — selections, drafts, optimistic local records, anything the
server does not own. For server data, let RTK Query hold it, and reach for an adapter inside
`transformResponse` only when you genuinely need id lookup within a single cached response.

## Interview questions

**★ What problem does normalising state actually solve?**
Two, and the second is the one that bites. Lookup by id becomes O(1) instead of an O(n) array scan — that
is the cheap win. The real one is **duplication**: an unnormalised tree stores the same user object inside
a post's `author`, a comments list and a mentions widget, so updating one copy leaves the others stale and
the UI disagrees with itself. Normalising stores each entity once and makes everything else hold an id.

**★ What is the shape `createEntityAdapter` maintains, and what is `ids` for?**
`{ ids: [], entities: {} }`. `entities` is the id-keyed lookup; `ids` is an **ordered** array that *is*
the sort order. Keeping order in a separate array is what lets the adapter maintain a `sortComparer`
cheaply and lets `selectAll` produce a correctly ordered array without sorting at read time.

**★ What is the difference between `addOne`, `setOne`, `upsertOne` and `updateOne`?**
`addOne` inserts and does **nothing** if the id already exists. `setOne` adds or fully replaces.
`upsertOne` adds, or shallow-merges into an existing entity. `updateOne` patches an existing entity via
`{ id, changes }` and does nothing if it is absent. The interview-relevant one is `addOne`'s no-op: it
looks like an upsert, is not, and fails silently.

**When does `sortComparer` actually run?**
Only when state changes through one of the adapter's own CRUD functions. It is not an invariant enforced
on the state shape, so data written into `ids`/`entities` by hand — or state hydrated from a persisted
payload — is not sorted by the adapter's mere existence. Route every write through the adapter and the
question does not arise.

**Are the selectors from `getSelectors()` memoized, and what are they memoized against?**
Yes — the docs say each is created with Reselect's `createSelector`. They memoize against the `ids` and
`entities` references, so `selectAll` only rebuilds its array when the collection actually changes. That
is what makes it safe to call in a list component; without it, every render would materialise a new array
and defeat `useSelector`'s reference check.

**What changed for `createEntityAdapter` in RTK 2.0?**
It gained an `Id` generic, so `createEntityAdapter<Comment, string>()` types the id precisely instead of
widening to `string | number`, and the exported `Dictionary` type was removed in favour of plain
`Record`. Both are compile-time breaks rather than behavioural ones, which is why they tend to surface
as a wall of type errors immediately after a dependency bump.

**Would you use `createEntityAdapter` for data fetched from a server?**
Usually not any more. RTK Query already caches server data keyed by endpoint and argument, so normalising
it again duplicates the cache and the invalidation story. Adapters earn their place for **client-owned**
state — drafts, selections, locally-created records awaiting a save — or inside `transformResponse` when
you want id lookup within one cached response.

---

← [`createSelector`](./01-create-selector-and-reselect.md) · [Topic index](../README.md) · Next → [Middleware stack & `listenerMiddleware`](../06-middleware/01-default-middleware-and-listener-middleware.md)
