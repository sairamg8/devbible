---
title: "useDebounce and the search box"
sidebar_label: "02 · useDebounce & search"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against react.dev (state, effects) and the Phase 3
> search contract. Concept home:
> [JavaScript — debounce and throttle](../../../javascript/pages/README.md)
> (phase 17's from-scratch implementations) and
> [React — designing a hooks API](../../../react/pages/phase-7-custom-hooks/06-designing-a-hooks-api/README.md).

## The problem

The search box fires a request per keystroke — "walnut" is six requests,
five wasted, and under [chapter 3·10's rate limit](../phase-3-express-api/10-rate-limiting.md)
a fast typer throttles themself. Debouncing in React is not the
[phase-17 debounce function](../../../javascript/pages/README.md) wrapped
in a component — closures over stale state and re-created timers on every
render break the naive port. The React-native shape is **a debounced
value**, not a debounced function.

## The implementation

```jsx
// src/hooks/useDebounce.js
import {useEffect, useState} from 'react';

/** Returns `value`, but only after it has been stable for `delayMs`. */
export function useDebounce(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);          // a newer value cancels the older timer
  }, [value, delayMs]);

  return debounced;
}
```

```jsx
// src/components/SearchBox.jsx — the whole search feature
import {useState} from 'react';
import {useDebounce} from '../hooks/useDebounce.js';
import {useAsync} from '../hooks/useAsync.js';
import {api} from '../lib/api.js';

export function SearchBox() {
  const [input, setInput] = useState('');
  const query = useDebounce(input.trim(), 300);

  const {status, data} = useAsync(
    (signal) => query.length >= 2
      ? api(`/products/search?q=${encodeURIComponent(query)}`, {signal})
      : Promise.resolve(null),
    [query],
  );

  return (
    <div className="search" role="search">
      <input
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
      />
      {input !== query && input.length >= 2 && <Spinner size="s" />}
      {status === 'success' && data && (
        <SearchResults items={data.items} hasMore={data.has_more} query={query} />
      )}
    </div>
  );
}
```

## Why this shape wins

- **Two states, one derived.** `input` is what the user sees — it updates
  every keystroke, keeping the field responsive. `query` is what the
  *system* reacts to — it changes only when typing pauses. Everything
  downstream (the fetch, the results, the URL sync if added) keys off
  `query` and inherits the debouncing for free.
- **The cleanup *is* the debounce.** Each keystroke re-runs the effect;
  clearing the previous timer before setting the next one is exactly
  "reset the countdown". No refs to timer ids, no `useMemo`'d debounced
  callbacks with stale closures — the platform's cleanup contract does
  the bookkeeping.
- **Cancellation still matters after debouncing.** Debounce reduces
  requests; it cannot order responses — "waln" then a pause then "walnut"
  is still two requests, and the first can return last.
  [`useAsync`](01-useasync-and-the-api-client.md) aborts the stale one;
  the two hooks compose, each solving its own half.
- **The pending hint reads `input !== query`** — the UI knows a search is
  *coming* before it is in flight. Cheap honesty that makes 300 ms feel
  intentional instead of laggy.
- **The 2-character floor** mirrors the server's validation
  ([3·02](../phase-3-express-api/02-the-validation-boundary.md)) — the
  client avoids sending what the server would reject; the server still
  enforces it because clients lie.

## Choosing the delay

300 ms is the folk default and a real decision: shorter (150 ms) feels
psychic but roughly doubles request volume on continuous typing; longer
(500 ms+) reads as broken on fast connections. The honest method: measure
the p50 inter-keystroke gap of real typing (~120–200 ms) and sit just
above it. The number lives in one constant, and the
[rate-limit budget](../phase-3-express-api/10-rate-limiting.md) (30/min)
was set assuming it — the two are a pair, tuned together.

## Gotchas

- **Symptom:** results for "walnut des" render after the user typed
  "walnut desk" — stale results with debounce "on". **Cause:** debounce
  without cancellation; both requests fired, slow one won. **Fix:**
  composition with `useAsync` above — and the general lesson: debounce is
  a *volume* tool, abort is an *ordering* tool; neither substitutes for
  the other.
- **Symptom:** the input lags typing. **Cause:** someone debounced `input`
  itself (`setInput` behind the debounce) — the visible field now updates
  on the trailing edge. **Fix:** the two-state split is the design: raw
  state for the field, debounced *derived* value for effects. The field
  is never debounced.
- **Symptom:** tests for the search box are flaky around the 300 ms line.
  **Cause:** real timers in tests. **Fix:** fake timers
  (`jest.useFakeTimers`/`vi.useFakeTimers`, advance by 300) — the
  [testing-hooks page](../../../react/pages/phase-7-custom-hooks/11-testing-a-custom-hook.md)
  covers the act()-and-timers dance; asserting on real elapsed time is
  the flake.

## Interview questions

1. **★ Why is "debounced value" the React-native shape rather than a
   debounced callback?** A debounced callback closes over the render it
   was created in — kept stable (ref/`useMemo`) it sees stale state;
   re-created per render it never fires. A debounced *value* has no
   closure problem: it is state, updated by an effect that reads current
   props, and consumers just… use it. The impedance match is
   value-in/value-out, which is React's whole model.
2. **★ Debounce is in place — why does the response race still need
   solving?** Because debounce collapses *bursts*, not *sequences*: two
   pauses produce two requests, and the network reorders freely. Ordering
   needs cancellation (abort the superseded request) or sequencing
   (ignore stale responses) — `useAsync` does both. Interviewers probe
   exactly this seam because "debounce fixes the race" is the common
   wrong answer.
3. **When is throttle right and debounce wrong, in this app?** Debounce
   waits for quiet — right when only the final state matters (search
   text). Throttle guarantees periodic execution — right when
   *intermediate* states matter: the scroll-position tracking in the
   infinite list (chapter 03) throttles, because "user is near the
   bottom" must fire during motion, not after it stops.

---

← Prev: [`useAsync` and the API client](01-useasync-and-the-api-client.md) ·
Next → **The infinite product list** *(not written yet)*
