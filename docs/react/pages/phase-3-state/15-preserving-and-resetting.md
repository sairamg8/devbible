---
title: "Preserving and resetting state across the tree"
sidebar_label: "15 · Preserving and resetting"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state).
> No sandbox script backs this page; claims are cited, not measured.

**Same component, same position → state kept. Different component, same
position → state destroyed, along with the whole subtree. Two rules, and the
second one fires far more often by accident than on purpose.**

## The two rules

> React preserves a component's state for as long as it's being rendered at its
> position in the UI tree.

> When you render a different component in the same position, it resets the state
> of its entire subtree.

"Position" means position **in the render tree** — the shape of what your
components return — not position in the DOM and not position in your source
file. And the comparison is on the component *type*, by reference.

## State survives more than people expect

```jsx
{isFancy ? <Counter isFancy={true} /> : <Counter isFancy={false} />}
```

The two branches look like different code paths, but they render the same
component type at the same position. **The count survives the toggle.** React
does not care that the JSX was written twice; it cares what type ended up at
that slot.

The same is true when props change completely, when the component is wrapped in
a fragment, and when the surrounding markup changes — as long as the type at
that position is the same.

## State dies more than people expect

```jsx
{isPaused ? <p>See you later!</p> : <Counter />}
```

A `<p>` and a `<Counter>` are different types, so toggling destroys the counter
entirely. Reasonable here — but the same rule fires in cases that are not
intended:

**A conditional wrapper.**

```jsx
{withBorder
  ? <div className="border"><Form /></div>
  : <Form />}
```

`<Form />` is at a different depth in the two branches — child of a `div` versus
child of the parent — so it is a different position. **Toggling the border wipes
the form.** The fix is to keep the tree shape identical and vary only the
attribute:

```jsx
<div className={withBorder ? 'border' : ''}><Form /></div>
```

**Two branches rendering the same component at different slots.**

```jsx
{isPlayerA && <Counter person="Taylor" />}
{!isPlayerA && <Counter person="Sarah" />}
```

These are the **first** and **second** children of the parent, so they are
different positions and the state resets on switch. react.dev presents this as a
deliberate technique — *"Option 1: Render a component in different positions"* —
and it is, but it is equally often an accidental reset when someone rewrites a
ternary as two `&&`s.

**A component defined inside another component.** The type is new each render,
so this rule fires on every render
([Phase 2 · topic 01](../phase-2-components/01-function-components/02-identity-and-nesting.md)).

## The two deliberate resets

react.dev names both.

**Different positions**, as above — works, but only when you control the layout
and it does not distort the markup.

**Different keys**, which is the general answer:

> Specifying a `key` tells React to use the `key` itself as part of the position,
> instead of their order within the parent.

```jsx
{isPlayerA
  ? <Counter key="Taylor" person="Taylor" />
  : <Counter key="Sarah" person="Sarah" />}
```

Same slot, different keys, so React treats them as different positions and
resets. [Topic 07](07-resetting-state-with-key.md) covers this as its own
technique, including the `key={record.id}` form that replaces reset-by-effect.

## Reading a tree for position

The practical skill is looking at JSX and seeing the tree React sees. Three
things that do **not** change position:

- Wrapping in a **fragment** — fragments produce no tree level for this purpose
  when written directly around the same children... but note that changing
  *whether* a fragment wraps a single child does not change depth, while adding a
  real element does.
- Changing **props**, however drastically.
- Changing **the surrounding siblings' contents**, as long as the index or key
  of this element is unchanged.

And three that do:

- Adding or removing a **wrapper element** around it.
- Changing its **index among siblings** without keys.
- Changing its **key**, or its **component type**.

The heuristic that catches most cases: **if the two branches of a conditional
do not have identical tree shapes, state will reset when you toggle.**

## Where the state lives changes the answer

A reset only matters if there is state at that position to lose. Two structural
choices remove the problem entirely:

**Lift the state above the conditional.** If the value lives in the parent, it
survives whatever happens to the children:

```jsx
const [score, setScore] = useState(0);       // in the parent
{isPlayerA ? <Counter score={score} … /> : <Counter score={score} … />}
```

**Or accept the reset as the feature.** Half the time the reset is what you want
and the component is simply telling you so.

The bug is only ever the mismatch between what the tree shape does and what you
intended — which is why the fix is sometimes `key`, sometimes lifting, and
sometimes reshaping the JSX.

## Gotchas

**Symptom:** a form clears when an unrelated styling toggle flips.
**Cause:** the toggle adds or removes a wrapper element, changing the form's
position.
**Fix:** keep one tree shape and vary the `className`.

**Symptom:** state survives when you expected a reset on switching records.
**Cause:** same component, same position — props changing is not a reset.
**Fix:** `key={record.id}`.

**Symptom:** state resets when a ternary is rewritten as two `&&` expressions.
**Cause:** the two branches now occupy different child slots.
**Fix:** go back to one slot, or add keys deliberately if the reset was wanted.

**Symptom:** state resets on every parent render.
**Cause:** the component's type is new each render — a nested definition, a HOC
in render, `memo`/`lazy` called in render.
**Fix:** module top level. Phase 2, topic 01.

**Symptom:** a video restarts or an input loses focus on an unrelated update.
**Cause:** something above changed the tree shape or a key, remounting the
subtree.
**Fix:** find the shape change; the symptom is always a remount.

## Interview questions

**★ What decides whether a component keeps its state?**
Its position in the render tree plus its type. Same type at the same position →
state preserved, however much the props changed. Different type at that position
→ the entire subtree is destroyed and rebuilt. Keys participate as part of the
position, which is how you override the default.

**★ Why does adding a wrapper `div` in one branch of a conditional wipe the
form?**
Because it changes the form's position — child of the wrapper versus child of
the parent. React sees a different position, so it unmounts the old subtree.
Keeping one tree shape and varying only the `className` avoids it entirely.

**★ What are the two ways to deliberately reset state?**
Render the component at a different position, or give it a different `key`. The
key form is the general one, since it works without distorting the markup:
specifying a key tells React to use the key as part of the position instead of
the order within the parent.

**Does changing props reset state?**
No. Props changing is not a reset trigger at all — the same component type at the
same position keeps its state regardless. That is exactly why resetting a form
when the record changes needs `key` rather than just passing a new record.

**Why is "position" not the same as position in the DOM?**
Because it is position in the tree of what your components return, before React
commits anything. A portal renders its DOM node elsewhere but keeps its React
position; a wrapper component that renders nothing still occupies a level. The
DOM is the output, not the thing being compared.

**How do you avoid this class of bug structurally?**
Lift the state above the conditional, so nothing at the changing position owns
anything worth losing. Where that is not possible — uncontrolled inputs, for
instance — keep the tree shapes of the two branches identical, and use `key`
when you genuinely want the reset.

---

← Prev: [State in lists](14-state-in-lists.md) · Index: [Phase 3](README.md) · Next → [Updating state during render](16-updating-state-during-render.md)
