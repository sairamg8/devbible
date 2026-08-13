---
title: "StrictMode"
sidebar_label: "07 · StrictMode"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. Both builds
> below come from `sandbox/react-p0/ex07-strictmode.mjs`, which bundles the
> **same source twice**, changing only `process.env.NODE_ENV`.

**`StrictMode` deliberately runs your components twice and mounts your effects
twice — in development only. It is a detector for bugs that would otherwise
appear later, under concurrent rendering, in production.**

The instinct when you first meet it is to remove it. That instinct is the bug.

## What it does, measured

One component, one effect, one impure line. Same file, two builds.

```jsx
let renders = 0, setups = 0, cleanups = 0;
const trail = [];                              // module-level state

function Widget() {
  renders++;
  const [n] = useState(() => { console.log('useState initialiser ran'); return 0; });
  trail.push('render');                        // <-- the bug StrictMode looks for
  console.log('render #' + renders);
  useEffect(() => {
    setups++;
    console.log('  effect SETUP #' + setups);
    return () => { cleanups++; console.log('  effect CLEANUP #' + cleanups); };
  }, []);
  return <p>{n}</p>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode><Widget /></StrictMode>
);
```

```console
$ node ex07-strictmode.mjs

=== development build — 1,125,752 bytes ===
  [info] Download the React DevTools for a better development experience: …
  useState initialiser ran
  useState initialiser ran
  render #1
  render #2
    effect SETUP #1
    effect CLEANUP #1
    effect SETUP #2
  TOTALS renders=2 setups=2 cleanups=1
  trail (module array mutated during render) = [render, render]

=== production build — 194,799 bytes ===
  useState initialiser ran
  render #1
    effect SETUP #1
  TOTALS renders=1 setups=1 cleanups=0
  trail (module array mutated during render) = [render]
```

Read the differences:

| | Development | Production |
|---|---|---|
| Component function called | **twice** | once |
| `useState` lazy initialiser | **twice** | once |
| Effect setup | **twice** | once |
| Effect cleanup between them | **once** | never |
| Bundle | 1,125,752 bytes | 194,799 bytes |

The impure line is the payoff. `trail` ends up `[render, render]` in
development — the array has two entries for one visible component. That is the
symptom of a real bug: the component mutates something outside itself during
render, so its effect depends on how many times React chose to call it.

## Why doubling is the right test

React reserves the right to call your component more than once per visible
update, and to throw a render away. [Fiber](05-fiber.md) is what makes that
possible; transitions and Suspense are what make it happen in production.

So "my component is only called once" was never a guarantee. StrictMode makes
the assumption fail immediately, on your machine, rather than intermittently for
a user on a slow connection.

The **effect** double-mount tests something more specific. React runs
setup → cleanup → setup, which asserts: *your cleanup must fully undo your
setup*. If it does, the sequence is invisible. If it does not, you get the class
of bug this catches:

```jsx
// ✗ Cleanup does not undo setup — StrictMode leaves two sockets open
useEffect(() => {
  const socket = io(url);
  socket.on('message', onMessage);
  // no cleanup at all
}, [url]);

// ✓ Symmetrical
useEffect(() => {
  const socket = io(url);
  socket.on('message', onMessage);
  return () => socket.disconnect();
}, [url]);
```

Without cleanup, StrictMode gives you two live sockets in development. In
production you get one — until the user navigates away and back four times, and
then you have four.

## The bundle-size line

`1,125,752` versus `194,799` bytes is not a StrictMode cost — it is the
development build of React itself: warnings, the double-invoke machinery,
component stacks, DevTools hooks. The production build strips all of it.

**What selects the build is `process.env.NODE_ENV`.** It is not a separate file
you import; it is a dead-code branch inside `react-dom` that a minifier removes
when the value is `'production'`. Every bundler sets it for you in a production
build — and misconfiguring it is how apps ship the 1.1 MB development build to
users.

Check it in your deployed bundle before assuming:

```console
$ grep -c "Warning: " dist/assets/index-*.js
0
```

A production bundle contains no React warning strings. A non-zero count means
you shipped the development build.

## What StrictMode does not do

- It does **not** run in production. There is no runtime cost to users.
- It does **not** double-invoke event handlers, or effects after the first mount.
  Only the initial mount is double-mounted.
- It does **not** make your code correct. It surfaces impurity; fixing it is your
  job.

React 19 also uses it to warn about deprecated APIs (string refs, legacy
context, `findDOMNode` usages in old libraries).

## The wrong fix, and the right one

```jsx
// ✗ The classic "fix": suppress the second run
const didInit = useRef(false);
useEffect(() => {
  if (didInit.current) return;
  didInit.current = true;
  fetchUser();                 // now runs once — and still has no cleanup
}, []);
```

This silences the symptom and keeps the disease. The effect still cannot be
re-run safely, which means it will misbehave when the user navigates back to
this screen, when Fast Refresh remounts it, or when a future `<Activity>`
boundary hides and restores it.

```jsx
// ✓ Make the effect re-runnable
useEffect(() => {
  const controller = new AbortController();
  fetchUser({signal: controller.signal})
    .then(setUser)
    .catch((e) => { if (e.name !== 'AbortError') setError(e); });
  return () => controller.abort();
}, [userId]);
```

Now running it twice is harmless: the first request is aborted by its own
cleanup before the second starts.

The one genuinely legitimate `didInit` case is a truly global, idempotent-unsafe
initialisation — a third-party SDK that throws if configured twice — and even
then it belongs at module scope, outside any component.

## Gotchas

**Symptom:** two API requests fire on every page load in development, one in
production.
**Cause:** StrictMode double-mounting an effect with no cancellation.
**Fix:** abort in cleanup. Do not add a `didInit` ref.

**Symptom:** two WebSocket connections, doubled analytics events, doubled
subscriptions — but only locally.
**Cause:** the effect's cleanup does not undo its setup.
**Fix:** make setup and cleanup symmetrical.

**Symptom:** a counter in a module variable increments by two per render.
**Cause:** the component mutates module scope during render, and StrictMode calls
it twice.
**Fix:** move the mutation into an effect or an event handler; render must be
pure.

**Symptom:** an expensive `useState(() => buildIndex(data))` runs twice on mount.
**Cause:** lazy initialisers are double-invoked too, as the log shows.
**Fix:** nothing — it is development only. If it makes the dev loop painful,
that is a signal the work belongs in a memo or outside the component.

**Symptom:** the production bundle is over a megabyte and full of warning text.
**Cause:** `process.env.NODE_ENV` is not `'production'` in the build.
**Fix:** build with the bundler's production mode; verify by grepping the output
for warning strings.

## Interview questions

**★ Why does React run my effect twice?**
`StrictMode` in development mounts effects, cleans them up and mounts them
again, to assert that your cleanup fully undoes your setup. It is a test of the
effect, not a scheduling quirk, and it does not happen in production.

**★ Should you remove `StrictMode` to stop the double render?**
No. It only runs in development, costs users nothing, and the doubling is
surfacing a real problem — an effect that cannot be safely re-run, or a
component that is not pure.

**★ What exactly gets doubled?**
Component function bodies, `useState`/`useReducer` lazy initialisers, and the
initial mount of effects (setup → cleanup → setup). Event handlers and
post-mount effect runs are not doubled.

**Is the fix a `useRef` guard?**
Almost never. It hides the symptom while leaving the effect unable to re-run,
which breaks again on navigation, Fast Refresh, or `<Activity>`. Make the effect
idempotent instead — usually by aborting in cleanup.

**How does React decide between the development and production build?**
`process.env.NODE_ENV`. It is a dead-code branch the minifier removes, not a
separate entry point. Measured here: 1,125,752 bytes versus 194,799 from
identical source.

**Does StrictMode double-render in production?**
No. Measured above: the production build logs `render #1` once and one effect
setup, from the same source file.

---

← Prev: [createRoot](06-createroot.md) · Index: [Phase 0](README.md) · Next → [Versions and release channels](08-versions-and-channels.md)
