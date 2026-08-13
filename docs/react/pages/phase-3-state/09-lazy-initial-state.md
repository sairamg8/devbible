---
title: "Lazy initial state"
sidebar_label: "09 · Lazy initial state"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`useState`](https://react.dev/reference/react/useState), including the
> initializer caveats and the Strict Mode note. No sandbox script backs this
> page; claims are cited, not measured.

**`useState(expensive())` calls `expensive()` on every single render and throws
the result away every time but the first. `useState(() => expensive())` calls it
once. One pair of parentheses.**

## The difference

```jsx
const [todos, setTodos] = useState(createInitialTodos());     // 🔴 runs every render
const [todos, setTodos] = useState(createInitialTodos);       // ✅ runs once
const [todos, setTodos] = useState(() => createInitialTodos()); // ✅ runs once
```

Line 1 is ordinary JavaScript: the argument is evaluated before the call, so
`createInitialTodos()` runs, produces a value, and hands it to `useState`. React
uses it on the first render and **discards it on every subsequent one** — the
initial state is read once ([topic 01](01-usestate.md)) — but the work has
already happened.

Lines 2 and 3 pass a *function*. React calls it only when it actually needs an
initial value, which is once per component instance at that position.

The distinction between 2 and 3 matters only when the function takes arguments
or you need to control what is passed. `useState(createInitialTodos)` is fine
when the function takes no parameters — but note that if it takes any, React
passes it nothing, so a function with a defaulted first parameter behaves
differently than you might expect. Being explicit with `() => fn(x)` is never
wrong.

## When it is worth it

The cost you are avoiding is per-render, so it matters in proportion to how
often the component renders and how expensive the initialiser is.

Worth it:

```jsx
useState(() => JSON.parse(localStorage.getItem('draft') ?? 'null'));
useState(() => new Map(entries));
useState(() => buildIndex(largeArray));
useState(() => crypto.randomUUID());
```

Not worth it:

```jsx
useState(() => 0);          // pointless — allocating a closure to avoid nothing
useState(() => '');
useState(() => ({}));       // ⚠️ actually this one IS meaningful, see below
```

`useState({})` versus `useState(() => ({}))` is an interesting near-miss: both
create an object per render, but the object created by the first is *only*
garbage on later renders. The difference is negligible for a small literal. Do
not add closures for style.

**The reads are the real case.** `localStorage.getItem` is synchronous and hits
disk. Doing it on every keystroke because a parent re-renders is a genuine cost,
and — separately — reading it during render at all is a
[purity](../phase-2-components/02-purity/01-the-two-rules.md) concern that the
lazy form neatly resolves: the initialiser runs once, at mount, which is exactly
when the read is legitimate.

## The initialiser must be pure

> In Strict Mode, React will **call your initializer function twice** in order to
> help you find accidental impurities. This is development-only behavior and does
> not affect production. If your initializer function is pure (as it should be),
> this should not affect the behavior. The result from one of the calls will be
> ignored.

So the initialiser is subject to the same rule as the component body. Two
consequences:

```jsx
useState(() => {
  analytics.track('form-opened');      // 🔴 fires twice in development
  return {};
});

useState(() => {
  socket.connect();                     // 🔴 a side effect, and no cleanup
  return null;
});
```

Both belong in an effect, which has a cleanup and a defined lifecycle. The
initialiser computes a value and does nothing else.

The doubling is also a reason not to put anything *non-idempotent* there — an id
generated with `crypto.randomUUID()` will be generated twice in development and
one result discarded, which is harmless, but a counter incremented in a module
variable would not be.

## The same rule elsewhere

`useReducer` takes an optional third argument for exactly this reason:

```jsx
const [state, dispatch] = useReducer(reducer, initialArg, init);
```

`init(initialArg)` is called once. This is more than an optimisation there — it
is also how you get a reusable "reset to initial" by calling `init` again from
inside the reducer.

`useRef` and `useMemo` are the two that do *not* have a lazy form in the same
shape. `useRef(expensive())` genuinely evaluates on every render with no way to
pass a function — the argument is the initial value, and a function argument
would simply become the ref's contents. The workaround when it matters is the
lazy-ref pattern:

```jsx
const ref = useRef(null);
if (ref.current === null) ref.current = expensive();   // runs once
```

which is a documented-in-practice idiom rather than an API, and is worth knowing
because `useRef(new IntersectionObserver(…))` constructing an observer on every
render is a real and easy mistake.

## Gotchas

**Symptom:** an expensive function appears in a profile far more often than
there are mounts.
**Cause:** it is being called as `useState(fn())` rather than passed as
`useState(fn)`.
**Fix:** pass the function.

**Symptom:** an analytics event fires on every render, or twice at mount.
**Cause:** a side effect inside the initialiser. `StrictMode` doubles it.
**Fix:** move it to an effect. Initialisers must be pure.

**Symptom:** `useState(fn)` where `fn` takes parameters behaves unexpectedly.
**Cause:** React calls the initialiser with no arguments.
**Fix:** wrap it — `useState(() => fn(arg))`.

**Symptom:** state is `undefined` when the initialiser was meant to return an
object.
**Cause:** an arrow with a block body and no `return`, or an object literal not
wrapped in parentheses — `() => {}` returns `undefined`, not an empty object.
**Fix:** `() => ({})`.

**Symptom:** a `new` expression in `useRef` constructs on every render.
**Cause:** `useRef` has no lazy form.
**Fix:** the `if (ref.current === null)` idiom.

**Symptom:** the lazy initialiser reads a prop and the state never updates when
that prop changes.
**Cause:** correct — initial state is initial, lazily or not.
**Fix:** derive the value, or reset with `key`. Nothing about laziness changes
this.

## Interview questions

**★ What is lazy initial state and why does it exist?**
Passing a function to `useState` instead of a value, so React calls it only when
it needs an initial value rather than on every render. `useState(expensive())`
evaluates the argument on every render and discards the result on all but the
first — ordinary JavaScript argument evaluation. `useState(() => expensive())`
runs it once per component instance.

**★ When is it worth using?**
When the initial value is genuinely expensive to compute or involves a
synchronous read: parsing `localStorage`, building an index or a `Map`,
generating an id. For a literal like `0` or `''` it is pointless — you are
allocating a closure to avoid nothing.

**★ Does the initialiser have to be pure?**
Yes. React double-invokes it in Strict Mode to surface impurity, discarding one
result. Side effects — analytics, opening a connection — belong in an effect,
which has a cleanup and a defined lifecycle. The initialiser computes a value
and nothing else.

**Does `useRef` have a lazy form?**
No. Its argument is the initial value and a function passed to it becomes the
ref's contents, so `useRef(new Thing())` constructs on every render. The common
workaround is to initialise to `null` and assign inside an
`if (ref.current === null)` check, which runs exactly once.

**Why does `useState(() => {})` give `undefined`?**
Because `{}` after an arrow is parsed as a function body, not an object literal,
so the function returns nothing. It needs parentheses: `() => ({})`. This is a
JavaScript parsing rule rather than a React one, but it shows up here more than
anywhere else.

**Does lazy initialisation make state track a prop?**
No. Initial state is read once at the first render in that position however it
is computed. If the value should follow a prop, derive it instead of storing it,
or remount with `key`.

---

← Prev: [What triggers a re-render](08-what-triggers-a-re-render.md) · Index: [Phase 3](README.md) · Next → [Structuring state](10-structuring-state.md)
