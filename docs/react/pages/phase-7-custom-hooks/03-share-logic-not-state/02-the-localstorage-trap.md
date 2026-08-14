---
title: "The useLocalStorage trap"
sidebar_label: "02 · The useLocalStorage trap"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — MDN
> [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event)
> and react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks).
> No sandbox script backs this page; claims are cited, not measured.

**The independence of hook calls only causes production bugs when two callers agree
*at first* and diverge later. `useLocalStorage` is the canonical case, and the
"obvious" fix — a `storage` event listener — is silent for exactly the scenario you
have.**

Every in-house hooks library has this hook. It reviews cleanly, demos perfectly, and
then produces a bug report that reads "the theme sometimes doesn't update".

## The hook, and the four steps to the bug

```jsx
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(
    () => JSON.parse(localStorage.getItem(key)) ?? initialValue   // lazy init
  );

  function set(next) {
    setValue(next);
    localStorage.setItem(key, JSON.stringify(next));
  }

  return [value, set];
}
```

Nothing here is wrong in isolation. The lazy initialiser is correct
([Phase 3 · 09](../../phase-3-state/09-lazy-initial-state.md)) — without it you would
hit `localStorage` on every render. The write is paired with the state update. Read
alone, it is a good hook.

Now two components call `useLocalStorage('theme', 'light')`:

1. **On mount, they agree.** Both lazy initialisers read the same key and get the same
   string. *This is why the bug survives code review* — the first render is correct,
   and the first render is what anyone checks.
2. **Component A calls `set('dark')`.** Its own `useState` slot updates, so A
   re-renders dark. `localStorage` now says `dark`. Both of those are real.
3. **Component B still says `light`.** Nothing told it. `setValue` in A wrote to A's
   slot on A's fiber; B's slot was never touched, and B has no reason to re-render —
   [what triggers a re-render](../../phase-3-state/08-what-triggers-a-re-render.md) is
   a state or context change *on that component or an ancestor*, and neither happened.
4. **B stays wrong until it remounts** — a route change, a `key` change, a reload — at
   which point its initialiser re-reads storage and it "corrects itself". That is what
   makes the report say *sometimes*: the bug is deterministic, but the thing that
   hides it (a remount) is incidental to what the user was doing.

`localStorage` is doing its job perfectly here. It is a **write-through cache that
nobody reads again until mount**. The persistence works; the propagation was never
implemented.

## 🔴 Why the `storage` event does not fix it

The reflex fix is to make the hook listen for changes:

```jsx
// 🔴 Does not fix the bug you have
useEffect(() => {
  function onStorage(e) {
    if (e.key === key) setValue(JSON.parse(e.newValue));
  }
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}, [key]);
```

MDN, on `Window: storage` — the first sentence and then the sentence that matters:

> The **`storage`** event of the `Window` interface fires when **another document**
> that shares the same storage area … updates that storage area. **The event is _not_
> fired on the window that made the change.**

> For `localStorage` … the event is fired in **all other browsing contexts** that are
> in the same origin as the initiating document. **This includes other tabs** with the
> same origin.

So `storage` synchronizes **tabs**, and is deliberately silent inside the document
that performed the write. Your two components are in one document. The listener will
never fire for them.

Worse, this fix *appears to work* if you test it the natural way — open a second tab,
change the theme, watch the first tab update. You have proved the one case that was
never broken while leaving the actual case untouched. **Test both components in one
tab**, which is the scenario the bug report describes.

(The listener is still worth having if you genuinely want cross-tab sync. It is an
addition, not a fix. Note also that `e.newValue` is `null` on `removeItem`, and that
the handler must tolerate a value another tab wrote in an older format.)

## The rest of the family

The same shape appears wherever a hook seeds itself from a source it then writes to
without re-reading:

| Hook | Agrees on mount because | Diverges after |
|---|---|---|
| `useLocalStorage` / `useSessionStorage` | both read the same key | the first `set` |
| `useCookie` | both parse the same `document.cookie` | the first write |
| `useUrlState` reading `location.search` **into** `useState` | both parse the same URL | the first update that does not remount |
| `useTheme` seeded from `matchMedia(...).matches` **without** subscribing | both read the same match | the OS theme changes, or one component overrides |
| A `useState` seeded from a prop | both get the same initial prop | the prop changes ([derived state](../../phase-3-state/06-derived-state.md)) |

The tell is always the same: **an initialiser reads a shared source; the updates
write to a private one.** Once you learn to spot that asymmetry, you find these
without running the app.

## Seeing it, not arguing about it

Two checks that settle the question in under a minute, and are worth doing before any
refactor because they tell you whether state is shared or merely coincident:

- **React DevTools → Components.** Select each component and read its hooks panel.
  Independent state shows as a `State` entry **on each component**, with values that
  can differ. Genuinely shared state shows once — on the owner or provider — and
  appears on the readers as a `Context` entry instead.
- **`console.log` inside the hook body, not in the component.** Every call site logs
  separately on every render. Two lines per interaction means two of everything
  inside the hook, including the state you thought was one.

## This is a feature, and the alternative is worse

It is tempting to file all of this under "React limitation". Consider what the
opposite would mean — if a custom hook shared state across its callers, then:

- **`useFormInput` could never be called twice in one form.** Every field would be the
  same field. Every hook would be single-instance, which is a severe constraint for a
  reuse mechanism.
- **Every hook in every library would be a global variable with a `use` prefix.**
  Importing one would couple every component that imports it, and two libraries whose
  hooks happened to share a name would share state.
- **Two instances of the same widget could not coexist.** Two date pickers, two
  modals, two tabs of the same editor — all of them are the `useFormInput` problem.
- **On the server it would mean shared across requests.** Module scope on a server is
  per-process, not per-request, so "shared" state would be visible to every user that
  process serves. That is chunk 03's anti-pattern, and it is a data-leak class of bug,
  not a correctness annoyance.

Independence is what makes hooks composable. Sharing is a deliberate, explicit,
visible act — and React gives you exactly three places to put shared state, which is
[chunk 03](03-when-you-wanted-shared-state.md).

## Gotchas

**Symptom:** a `useLocalStorage`-style hook works in the demo and drifts in the app.
**Cause:** the initial read agrees; every write afterwards touches one component's
state only.
**Fix:** one source of truth — lift, provide, or store. The persistence layer is not
a synchronization layer.

**Symptom:** a `storage` listener is added and the hook now works when tested in two
browser tabs.
**Cause:** you tested the only case `storage` covers, and not the case you have.
**Fix:** test both components in one tab. Keep the listener only if cross-tab sync is
an actual requirement.

**Symptom:** the bug is reported as intermittent.
**Cause:** a remount re-runs the lazy initialiser, so the stale component silently
corrects itself on navigation or reload.
**Fix:** stop treating remount as evidence. Reproduce without navigating.

**Symptom:** `e.newValue` throws in the `storage` handler.
**Cause:** it is `null` when the key was removed, and `JSON.parse(null)` returns
`null` while `JSON.parse(undefined)` throws.
**Fix:** guard the handler; never assume another tab wrote the shape you expect.

**Symptom:** the fix chosen is to read `localStorage` during render instead of from
state, "so it is always fresh".
**Cause:** trying to make the read authoritative.
**Fix:** that is a side-effectful, non-idempotent read during render
([Phase 7 · 04](../04-rules-of-react-beyond-hooks/README.md)) and it still does not
re-render anyone when the value changes. It trades a stale value for a rules
violation.

**Symptom:** an SSR app crashes on this hook with `localStorage is not defined`.
**Cause:** the lazy initialiser runs on the server too.
**Fix:** a separate concern from sharing, and the reason the standard-set version of
this hook is built on `useSyncExternalStore` with a `getServerSnapshot`
([Phase 7 · 07 · 02](../07-the-standard-set/02-browser-state.md)).

## Interview questions

**★ A teammate ships `useLocalStorage` and reports it "randomly desyncs". Diagnose it.**
Both callers read the same key on mount, so they start equal; after that each has its
own `useState`. A write in one calls its own setter and `localStorage.setItem`, which
re-renders only that component. The other keeps its stale value until it happens to
remount and re-run its initialiser — hence "random". The persistence works; nothing
propagates the change to the other subscriber.

**★ Why doesn't a `storage` event listener fix it?**
Because the `storage` event is not fired on the window that made the change — it fires
in *other* browsing contexts of the same origin, which is what makes it a cross-tab
mechanism. Two components in one document are in the same browsing context, so the
listener never runs for them. It is a useful addition for cross-tab sync and a
non-fix for this bug, and testing it with two tabs open confirms only the case that
was already working.

**★ Why did React design hooks this way instead of sharing per-hook state?**
Because sharing would make every custom hook a global. A hook could never be called
twice in one component (`useFormInput` breaks immediately), importing a hook would
couple every component that imports it, two instances of the same widget could not
have separate state, and on the server module scope is per-process — "shared" would
mean shared between users' requests. Independence is what makes hooks composable;
sharing is made explicit instead.

**How would you spot this class of bug by reading, without running the app?**
Look for the asymmetry: the initialiser reads a **shared** source (storage, cookies,
the URL, `matchMedia`) while the updater writes to a **private** one (`useState` on
one component). Any hook with that shape agrees on mount and diverges on the first
write. The fix is to make the shared source the thing you subscribe to, not the thing
you seed from.

**What is the correct role of `localStorage` in a hook like this?**
Persistence across sessions, and nothing else — a write-through cache read once at
mount. Treating it as the transport between two live components is the mistake;
storage has no change notification for the document that wrote to it.

---

← Prev: [Two callers, two states](01-two-callers-two-states.md) ·
Index: [Share logic, not state](README.md) ·
Next → [When you actually wanted shared state](03-when-you-wanted-shared-state.md)
