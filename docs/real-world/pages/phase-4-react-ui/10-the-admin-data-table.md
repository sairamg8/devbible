---
title: "The admin data table"
sidebar_label: "10 · The admin data table"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against react.dev and the Phase 3 admin contract.
> Concept home: [React — performance](../../../react/pages/phase-6-performance/README.md);
> the server-side pagination trade-offs are
> [chapter 1·04's](../phase-1-database/04-the-catalog-query.md).

## The problem

The admin orders table: sortable columns, a status filter, page numbers
(admins *do* jump to page 7 — [1·04](../phase-1-database/04-the-catalog-query.md)
gave this surface bounded `OFFSET` for exactly that), row actions that
mutate status. The defining decision: **the server owns sorting,
filtering and paging**. A client-side table (fetch everything, sort in
JS) is simpler right up until the ten-thousandth order, and the switch
after the fact rewrites the whole feature — so the architecture starts
server-driven, and the chapter shows how small that actually is.

## The implementation

```jsx
// src/hooks/useTableQuery.js — table UI state, URL-synced
import {useSearchParams} from 'react-router';

const DEFAULTS = {page: '0', sort: 'created_desc', status: ''};

export function useTableQuery() {
  const [params, setParams] = useSearchParams();
  const query = {
    page: Number(params.get('page') ?? DEFAULTS.page),
    sort: params.get('sort') ?? DEFAULTS.sort,
    status: params.get('status') ?? DEFAULTS.status,
  };
  const update = (delta) => {
    const next = {...query, ...delta};
    if (!('page' in delta)) next.page = 0;     // any filter/sort change resets page
    setParams(
      Object.fromEntries(Object.entries(next)
        .filter(([k, v]) => String(v) !== DEFAULTS[k])
        .map(([k, v]) => [k, String(v)])),
      {replace: true},
    );
  };
  return [query, update];
}
```

```jsx
// src/admin/OrdersTable.jsx
import {useAsync} from '../hooks/useAsync.js';
import {useTableQuery} from '../hooks/useTableQuery.js';
import {api} from '../lib/api.js';

const COLUMNS = [
  {key: 'id',          label: 'Order'},
  {key: 'user_email',  label: 'Customer'},
  {key: 'total_cents', label: 'Total',  sortable: 'total'},
  {key: 'status',      label: 'Status'},
  {key: 'created_at',  label: 'Placed', sortable: 'created'},
];

export function OrdersTable() {
  const [query, update] = useTableQuery();
  const {status, data, retry} = useAsync((signal) => api(
    `/admin/orders?page=${query.page}&sort=${query.sort}` +
    (query.status ? `&status=${query.status}` : ''), {signal},
  ), [query.page, query.sort, query.status]);

  const toggleSort = (col) => {
    const asc = `${col}_asc`, desc = `${col}_desc`;
    update({sort: query.sort === desc ? asc : desc});
  };

  return (
    <div className="admin-table">
      <StatusFilter value={query.status}
                    onChange={(s) => update({status: s})} />
      <table aria-busy={status === 'loading'}>
        <thead>
          <tr>{COLUMNS.map((c) => (
            <th key={c.key} aria-sort={ariaSort(c, query.sort)}>
              {c.sortable
                ? <button onClick={() => toggleSort(c.sortable)}>{c.label}</button>
                : c.label}
            </th>))}
          </tr>
        </thead>
        <tbody className={status === 'loading' ? 'is-stale' : ''}>
          {(data?.items ?? []).map((o) => (
            <OrderRow key={o.id} order={o} onChanged={retry} />
          ))}
        </tbody>
      </table>
      {status === 'error' && <ErrorPanel onRetry={retry} />}
      <Pager page={query.page} pageCount={data?.page_count ?? 0}
             onPage={(p) => update({page: p})} />
    </div>
  );
}

const ariaSort = (col, sort) =>
  !col.sortable ? undefined
  : sort === `${col.sortable}_asc` ? 'ascending'
  : sort === `${col.sortable}_desc` ? 'descending' : 'none';
```

Row mutations stay boring on purpose:

```jsx
function OrderRow({order, onChanged}) {
  const [saving, setSaving] = useState(false);
  const setStatus = async (status) => {
    setSaving(true);
    try {
      await api(`/admin/orders/${order.id}/status`,
        {method: 'PATCH', body: {status}});
      onChanged();                              // refetch the page — the truth
    } finally { setSaving(false); }
  };
  // …cells, and a <StatusSelect disabled={saving} onChange={setStatus} />
}
```

## The decisions

- **URL as the table's state store.** Sort, filter and page live in
  search params — reload-safe, back-button-correct, and shareable
  ("look at page 4 of refunds" is a link). The hook's one rule —
  *any non-page change resets the page* — is the client mirror of the
  cursor-reset law from [chapter 03](03-the-infinite-product-list.md),
  for the same reason: position is meaningless across a different query.
- **Admin mutations are pessimistic.** The customer cart optimizes for
  feel ([chapter 06](06-cart-state.md)); admin actions optimize for
  certainty — a disabled control for 300 ms, then the refetched truth.
  Optimism is a UX investment; spend it where the user taps thirty times
  a session, not where an operator changes a status twice a day.
- **Stale-while-loading, not spinner-per-click.** The table keeps
  rendering the previous page dimmed (`is-stale`) while the next loads —
  `useAsync` keeping `data` through reloads
  ([chapter 01's policy](01-useasync-and-the-api-client.md)) is what
  makes this a CSS class instead of a caching layer.
- **`aria-sort` and header buttons** — sortable headers are buttons (they
  do something), and the sort state is announced. Table accessibility is
  mostly these two facts applied consistently.
- **No table library, and the line it would cross:** column resizing,
  row virtualization, selection models, CSV export — the day two of
  those are real requirements, TanStack Table earns its dependency
  (headless, so this markup survives). A dependency for sorting
  indicators alone is ceremony.

## Gotchas

- **Symptom:** changing the filter shows "page 4 of 1" and an empty
  table. **Cause:** the page survived a filter change — the reset rule
  was bypassed by a direct `setParams` call. **Fix:** all table-state
  writes go through `update()`; the reset lives there structurally,
  like every invariant in this track.
- **Symptom:** the back button steps through every keystroke of the
  filter box. **Cause:** history-pushing on each param write. **Fix:**
  `{replace: true}` for refinements (as written); reserve push for
  *navigation-sized* changes if the team wants filter history at all.
- **Symptom:** two admins, one stale table — A changes a status, B's
  table shows the old one for minutes. **Cause:** nothing pushes; B's
  data is as fresh as B's last interaction. **Fix:** accepted at this
  scale and named: admin tables refetch on window focus (one
  `visibilitychange` listener in `useAsync`'s consumer) — the honest
  cheap version of liveness; real-time tables are a websocket project
  this spec never asked for.

## Interview questions

1. **★ Why server-driven tables when client-side sorting is one array
   method?** `sort()` on the client requires *all* the data — fine at
   200 rows, dead at 20,000, and the failure arrives gradually as the
   dataset grows past what was tested. Server-driven costs a round trip
   per interaction but scales with the page size forever, and the
   sort/filter logic already exists server-side for the API's other
   consumers. Start where you can stay.
2. **★ Why do the customer catalog and the admin table paginate
   differently (cursor vs offset)?** Different access patterns:
   customers scroll forward through a live feed (keyset's strength —
   stable, cheap at depth); admins jump to arbitrary pages of a
   filtered, bounded set (offset's strength — random access, tolerable
   cost when depth is capped). [1·04](../phase-1-database/04-the-catalog-query.md)
   chose per-surface, and the UIs inherit the shapes.
3. **Why is the URL the right store for table state?** Because table
   state *is* navigation state: reload should restore it, back should
   undo it, and a colleague should be able to receive it as a link.
   Component state gives none of those; a global store gives them only
   with extra plumbing that the URL provides natively.

---

← Prev: [Auth in the client](09-auth-in-the-client.md) ·
Next → **Error boundaries and retry UX** *(not written yet)*
