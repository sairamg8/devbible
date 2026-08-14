---
title: "`createEntityAdapter`: Normalized State & Generated CRUD"
sidebar_label: "`createEntityAdapter`"
sidebar_position: 2
---

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
| `setOne` / `setAll` | Add or fully replace one/all entities |
| `upsertOne` / `upsertMany` | Insert if new, shallow-merge if existing |
| `updateOne` / `updateMany` | Partial patch of an existing entity via `{ id, changes }` |
| `removeOne` / `removeMany` / `removeAll` | Delete by id(s) |

### Generated Selectors
`usersAdapter.getSelectors()` returns memoized `selectAll`, `selectById`, `selectIds`, `selectEntities`, `selectTotal` — built with `createSelector` internally, so scanning `selectAll` is memoized against the `{ ids, entities }` reference.

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming `addOne` Overwrites an Existing Entity
```typescript
// ❌ WRONG assumption: addOne is a no-op if the id already exists — it will NOT update it
commentsAdapter.addOne(state, updatedComment); // silently does nothing if id already present!

// ✅ CORRECT: use upsertOne when the entity may or may not already exist
commentsAdapter.upsertOne(state, updatedComment);
```

### ⚠️ Pitfall 2: Forgetting `selectId` for Entities Without an `id` Field
```typescript
// ❌ WRONG: adapter defaults to reading entity.id — throws/misbehaves if your API uses `_id` or `uuid`
createEntityAdapter<Comment>();

// ✅ CORRECT: tell the adapter which field is the identity
createEntityAdapter<Comment>({ selectId: (comment) => comment.uuid });
```

### ⚠️ Pitfall 3: Manually Re-Sorting After Using Generated Selectors
Since `sortComparer` already guarantees `selectAll`'s output order, adding a redundant `.sort()` in a component (or in a further `createSelector` on top) is wasted work and, worse, a sign that the sort logic now lives in two places that can drift out of sync. Trust the adapter's maintained order.
