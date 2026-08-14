---
title: "What is immutable, and when"
sidebar_label: "02 · What is immutable, and when"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
> (Props and state are immutable · Return values and arguments to Hooks are immutable ·
> Values are immutable after being passed to JSX).
> No sandbox script backs this page; claims are cited, not measured.

**"Don't mutate state" is the version of this rule everybody knows, and it is the
smallest quarter of it. Props, hook arguments, hook return values and anything you
have already passed to JSX are all immutable too — and the JSX one has a deadline
rather than a category.**

Four sub-rules, in the order react.dev gives them. The last is the one nobody has
heard of.

## 1 · Props and state

> A component's props and state are **immutable snapshots**. Never mutate them
> directly. Instead, pass new props down, and use the setter function from `useState`.

Props first, with the reason attached:

> Props are immutable because **if you mutate them, the application will produce
> inconsistent output**, which can be hard to debug as **it may or may not work
> depending on the circumstances.**

```jsx
function Post({ item }) {
  item.url = new Url(item.url, base); // 🔴 Bad: never mutate props directly
  return <Link url={item.url}>{item.title}</Link>;
}
```

```jsx
function Post({ item }) {
  const url = new Url(item.url, base); // ✅ Good: make a copy instead
  return <Link url={url}>{item.title}</Link>;
}
```

"May or may not work depending on the circumstances" is the honest description and the
reason this survives review. The bad version works whenever the parent happens to
re-create `item` each render, and fails the moment the parent memoizes it — at which
point the mutation compounds on every render (`new Url(new Url(...))`), and the bug
report blames the memoization that exposed it.

Then state, which is the familiar half:

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  function handleClick() {
    count = count + 1; // 🔴 Bad: never mutate state directly
  }
  // ...
}
```

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  function handleClick() {
    setCount(count + 1); // ✅ Good: use the setter function returned by useState
  }
  // ...
}
```

The word **snapshot** is doing real work in "immutable snapshots" — `count` is not a
variable that holds the current value, it is the value from *this* render and it never
changes ([Phase 3 · 02](../../phase-3-state/02-state-is-a-snapshot.md)). Objects and
arrays in state get the full treatment in
[Phase 3 · 05](../../phase-3-state/05-immutable-updates/README.md).

**Context values belong in this bucket too.** A value read with `useContext` was
created by the provider, not by this render, so mutating it is mutating someone else's
state — with the extra property that nothing re-renders, because the provider never
knew.

## 2 · Hook arguments and return values

This is the sub-rule that applies directly to the custom hooks this phase is about:

> Once values are passed to a hook, **you should not modify them**. Like props in JSX,
> **values become immutable when passed to a hook.**

```jsx
function useIconStyle(icon) {
  const theme = useContext(ThemeContext);
  if (icon.enabled) {
    icon.className = computeStyle(icon, theme); // 🔴 Bad: never mutate hook arguments directly
  }
  return icon;
}
```

```jsx
function useIconStyle(icon) {
  const theme = useContext(ThemeContext);
  const newIcon = { ...icon }; // ✅ Good: make a copy instead
  if (icon.enabled) {
    newIcon.className = computeStyle(icon, theme);
  }
  return newIcon;
}
```

The justification is a principle worth naming, because it is the reason behind more
than one rule in this topic:

> One important principle in React is **_local reasoning_**: the ability to understand
> what a component or hook does by looking at its code in isolation. **Hooks should be
> treated like "black boxes" when they are called.**

Both directions follow from that:

- **Arguments in.** A hook that mutates what you hand it is a hook you cannot call
  without reading its source. `useIconStyle(icon)` silently editing `icon` means the
  caller's next line is wrong for reasons invisible at the call site.
- **Return values out.** A caller that mutates what a hook returned is reaching inside
  the black box. If the hook memoized that object, or returns the same reference to
  every caller, the mutation lands somewhere neither party expected — and this is
  exactly how a shared object from a context-backed hook gets corrupted by one consumer
  ([Phase 7 · 03](../03-share-logic-not-state/README.md)).

The rule is symmetric even though the docs' heading gives it in one breath: **a hook
does not own its arguments, and a caller does not own the hook's return value.** Copy
before you change, in both directions.

## 3 · 🔴 Values are immutable after being passed to JSX

This one is different in kind from the other three, and it is the one that catches
experienced people, because the object in question is genuinely yours — you created it
in this render, and [chunk 01](01-purity-and-idempotence.md) said local mutation is
fine. It is fine **right up until you pass it to JSX**.

> **Don't mutate values after they've been used in JSX.** Move the mutation to before
> the JSX is created.

> When you use JSX in an expression, React may **eagerly evaluate the JSX before the
> component finishes rendering**. This means that mutating values after they've been
> passed to JSX can lead to **outdated UIs**, as React won't know to update the
> component's output.

```jsx
function Page({ colour }) {
  const styles = { colour, size: "large" };
  const header = <Header styles={styles} />;
  styles.size = "small"; // 🔴 Bad: styles was already used in the JSX above
  const footer = <Footer styles={styles} />;
  return (
    <>
      {header}
      <Content />
      {footer}
    </>
  );
}
```

```jsx
function Page({ colour }) {
  const headerStyles = { colour, size: "large" };
  const header = <Header styles={headerStyles} />;
  const footerStyles = { colour, size: "small" }; // ✅ Good: we created a new value
  const footer = <Footer styles={footerStyles} />;
  return (
    <>
      {header}
      <Content />
      {footer}
    </>
  );
}
```

Read the bad version as a race and it stops being surprising. Both `<Header>` and
`<Footer>` are handed **the same object**. Whether `Header` sees `"large"` or `"small"`
depends on when React reads it, and "React may eagerly evaluate the JSX before the
component finishes rendering" means that timing is not yours to control. The mutation
is not wrong because objects are sacred — it is wrong because you have already handed
out the reference.

So the rule is about a **moment**, not a category:

| Point in the render | May you mutate the object? |
|---|---|
| After creating it, before any JSX uses it | ✅ Yes — local mutation, chunk 01 |
| After passing it to a JSX element | 🔴 No — the reference is out of your hands |
| After returning it from the component | 🔴 No — same reason, wider audience |

The reliable habit is **one object, one consumer**: build each value completely before
the JSX that uses it, and create a second object rather than editing the first. The fix
in the docs is exactly that — `headerStyles` and `footerStyles`, not one `styles`.

The same shape appears with arrays (`const rows = [...]; <Table rows={rows} />;
rows.push(extra);`), with a config object passed to two children, and with an object
put into state and then "tidied up" afterwards. All the same bug.

## The one-line test for all four

**Did this render create the value, and has it been handed to anyone yet?** Mutate it
only when both answers are "yes, and no". Props, state, context values and hook
arguments fail the first half; anything already in JSX fails the second.

## Gotchas

**Symptom:** a component works until the parent memoizes the object it passes down.
**Cause:** the child mutates the prop; it was hidden because the prop was rebuilt every
render.
**Fix:** copy before modifying. Do not "fix" it by removing the memoization — the
mutation was always the bug.

**Symptom:** a value compounds — a URL that keeps getting a base prepended, a price
discounted repeatedly.
**Cause:** a prop mutated in render, applied again on each re-render.
**Fix:** derive into a local `const`; never write back into the prop.

**Symptom:** two children rendered from one object show inconsistent values, or one is
stale.
**Cause:** the object was mutated after being passed to the first child's JSX.
**Fix:** build a separate value per consumer. Never edit a value after it has appeared
in JSX.

**Symptom:** a custom hook "works" but the caller's object changes underneath it.
**Cause:** the hook mutates its arguments.
**Fix:** spread into a copy inside the hook and return the copy — the docs' own
`useIconStyle` fix.

**Symptom:** a hook's return value is edited by one consumer and another consumer sees
the edit.
**Cause:** the hook returned a shared or memoized reference and the caller mutated it.
**Fix:** treat the return value as read-only. Copy it if you need a modified version.

**Symptom:** mutating a context value changes nothing on screen.
**Cause:** the provider's state was mutated instead of replaced, so no re-render was
scheduled and no consumer was told.
**Fix:** call the setter the provider exposes; never write through the value.

**Symptom:** the Compiler reports an error on a line that "has always worked".
**Cause:** these four rules are exactly what its diagnostics check — the docs' own bad
examples are annotated as compiler errors.
**Fix:** the diagnostic is right. Copy instead of mutating.

## Interview questions

**★ What exactly is immutable in React, beyond state?**
Four things. Props and state are immutable snapshots — pass new props down, use the
setter. Context values, which are somebody else's state. Hook arguments and hook return
values — values become immutable once passed to a hook, and the return value belongs to
the hook. And any value you have already passed to JSX, which is a deadline rather than
a category.

**★ Why are props immutable, given nothing physically stops you?**
Because mutating them produces inconsistent output that may or may not work depending
on the circumstances. Concretely: if the parent rebuilds the object every render the
mutation is invisible, and the moment the parent memoizes it the mutation compounds
across renders. That makes the failure look like it was caused by the memoization, not
by the mutation that was always wrong.

**★ Explain the JSX rule — why can't I mutate an object I created myself?**
You can, until you pass it to JSX. React may eagerly evaluate JSX before the component
finishes rendering, so once an element holds a reference to your object, whether a
consumer sees the old or new value depends on timing you do not control — the docs'
example passes one `styles` object to a `Header` and then changes `size` before
building the `Footer`. The fix is a separate value per consumer, built before the JSX
that uses it.

**★ What is "local reasoning" and which rules does it explain?**
It is the ability to understand what a component or hook does by reading it in
isolation, with hooks treated as black boxes at their call sites. It explains why a
hook must not mutate its arguments (the caller cannot see it happen), why a caller must
not mutate a hook's return value (reaching inside the box), and why hooks may not be
passed around as values — all cases where you would have to read other files to know
what one line does.

**Local mutation is fine, but values are immutable after JSX. Reconcile those.**
They are the same rule at two moments. A value created during this render is yours to
build up freely, because no later render can observe it. Passing it to JSX hands out
the reference, so from that point a consumer may read it at a time you do not control.
Build fully, then pass — and if a second consumer needs different data, create a second
object.

**Someone mutates a context value and nothing changes on screen. Why?**
Because a mutation schedules nothing. The provider's state object was changed in place,
so React saw no new value, no re-render was scheduled, and no consumer was notified.
The value is also not the mutating component's to change — it is the provider's state.

---

← Prev: [Purity and idempotence](01-purity-and-idempotence.md) ·
Index: [Rules of React beyond hooks](README.md) ·
Next → [React calls components and hooks](03-react-calls-components-and-hooks.md)
