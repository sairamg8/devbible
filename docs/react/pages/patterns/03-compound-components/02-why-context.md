---
title: "Why context, not cloneElement"
sidebar_label: "02 · Why context, not cloneElement"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`createContext`](https://react.dev/reference/react/createContext),
> [`useContext`](https://react.dev/reference/react/useContext),
> [`Children`](https://react.dev/reference/react/Children),
> [`cloneElement`](https://react.dev/reference/react/cloneElement) and
> [`useMemo`](https://react.dev/reference/react/useMemo).
> ⚠️ Community pattern built from documented APIs — see the topic
> [index](README.md). Judgements marked as judgements.
> No sandbox script backs this page; claims are cited, not measured.

**[Chunk 01](01-the-mechanism.md) used context without justifying it. The
alternative is obvious, widely attempted, and structurally broken.**

## Why not `Children.map` and `cloneElement`

The obvious alternative is for `Tabs` to walk its children and inject props. It
fails, and the failure is structural rather than stylistic.

```jsx
// ❌ Works for exactly one arrangement
function Tabs({ children }) {
  const [value, setValue] = useState();
  return Children.map(children, (child) =>
    cloneElement(child, { value, setValue }),
  );
}
```

**`Children.map` sees only direct children.** The moment the caller writes any of
these, the parts stop receiving props — silently, with no error:

```jsx
<Tabs>
  <div className="toolbar">        {/* a wrapper */}
    <Tabs.Tab value="a">A</Tabs.Tab>
  </div>
  <>                                {/* a fragment */}
    <Tabs.Tab value="b">B</Tabs.Tab>
  </>
  {items.map((i) => <Tabs.Tab key={i.id} value={i.id}>{i.label}</Tabs.Tab>)}
  {isAdmin && <Tabs.Tab value="admin">Admin</Tabs.Tab>}
</Tabs>
```

Context has no such constraint: a consumer at any depth finds the nearest
provider. That is the entire argument, and it is why every serious library uses
context here.

React's own documentation reinforces it —
[`cloneElement`](https://react.dev/reference/react/cloneElement) is described as
uncommon and a route to fragile code, and
[element manipulation](../../phase-2-components/16-element-manipulation.md)
collects the reasons.

## The guard that throws

```jsx
const TabsContext = createContext(null);          // null, not a plausible object
```

**Defaulting to `null` is deliberate.** A "helpful" default like
`{ value: undefined, setValue: () => {} }` means a `<Tabs.Tab>` rendered outside
`<Tabs>` silently half-works: it renders, nothing happens on click, and the bug
surfaces somewhere unrelated. With `null` plus the guard hook, the caller gets
`<Tabs.Tab> must be rendered inside <Tabs>` — which names the mistake and the
fix.

Pass the part name in so the message is specific.
[The default context value](../../phase-5-refs-context-reducers/13-default-context-value.md)
is the page on this decision.

## What `useMemo` is actually protecting

```jsx
const context = useMemo(() => ({ value, setValue, baseId }), [value, baseId]);
```

Without it, `{ value, setValue, baseId }` is a **new object every render of
`Tabs`**, so every consumer re-renders whenever the parent re-renders — even
when nothing they read has changed. Since `Tabs` is usually near the top of a
screen, its parent re-renders often.

⚠️ **Be precise about what this does and does not fix.** Memoizing prevents
re-renders caused by *identity churn*. It does nothing about re-renders caused by
the value genuinely changing — when `value` moves from `billing` to `team`,
**every** consumer re-renders, including the ten tabs whose own state did not
change, because `useContext` has no selector. That is
[the context re-render problem](../../phase-5-refs-context-reducers/05-context-re-render-problem.md),
and the fix is splitting the context, covered in
[chunk 03](04-the-costs-and-limits.md).

*(Under the React Compiler this memoization is usually inserted for you. Writing
it explicitly is still correct and still what you should read as intent —
[Phase 6](../../phase-6-performance/README.md).)*

## Gotchas

**`cloneElement` fails silently, which is why it is worse than it looks.** No
warning, no error — the part simply never receives the props, and the widget is
inert. Debugging it means already knowing this failure mode exists.

**`Children.count` and `Children.toArray` share the direct-children
limitation.** Any logic based on "how many tabs are there" breaks under a wrapper
for the same reason.

**`Children.toArray` also rewrites keys**, prefixing them, so using it to derive
identity gives you keys that are not the ones the caller wrote.

**A part rendered outside its parent throws at render time, not at build time.**
The guard is a runtime error; nothing stops the part being imported and used
alone until someone runs that code path.

**A "helpful" default context object is worse than none.** It makes a misused
part half-work — it renders, clicks do nothing — and moves the symptom away from
the mistake.

**Passing the part name into the guard is what makes the error useful.** A
generic "context is null" tells the caller nothing about which component they
misplaced.

**`useMemo` on the value fixes identity churn only.** A genuine value change
still re-renders every consumer, because `useContext` has no selector. Do not
read the memo as a performance fix for the pattern — it is a fix for one specific
waste.

**Assembling the value inline undoes any context split.** `<Ctx value={{...state,
...actions}}>` merges two deliberately separated concerns back into one changing
object.

**Under the React Compiler the memo is usually inserted for you**, but writing it
explicitly is still correct and still communicates intent to a reader.

## Interview questions

**Why context rather than `Children.map` and `cloneElement`?**
Because `Children.map` only sees direct children. Wrap a part in a `<div>`, a
fragment, a `.map()` or a conditional and it silently stops receiving props.
Context finds the nearest provider at any depth, so the caller can arrange the
parts freely.

**How exactly does the `cloneElement` version fail?**
Silently. The parts render and do nothing, because the injected props never
reached them — there is no warning and no error.

**What does React's own documentation say about `cloneElement`?**
That it is uncommon and can lead to fragile code.

**Why does the context default to `null`?**
So a part used outside its parent fails loudly. A plausible default object makes
it half-work and moves the symptom away from the cause.

**What does the guard hook add beyond a null check?**
The part's name in the message, so the error names which component was misused
and what it needs.

**What is `useMemo` on the context value protecting against?**
Re-renders caused by the value object's identity changing on every parent render,
even when nothing a consumer reads has changed.

**What does it *not* protect against?**
Re-renders caused by the value genuinely changing. Those hit every consumer,
because `useContext` has no selector — that is the context re-render problem, and
splitting the context is the mitigation.

**Does the React Compiler make this unnecessary?**
It generally inserts the memoization for you, so the identity churn goes away. It
does not make context selective, so the real-change re-render remains.

---

← Prev: [01 · The mechanism](01-the-mechanism.md) · Index: [Compound components](README.md) · Next → [03 · Designing the parts](03-designing-the-parts.md)
