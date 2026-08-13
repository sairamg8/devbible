---
title: "The procedure"
sidebar_label: "01 · The procedure"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
> and [Thinking in React](https://react.dev/learn/thinking-in-react) steps 4–5.
> No sandbox script backs this page; claims are cited, not measured.

**Two components need to agree about something. There is exactly one place that
information can live: above both of them. Everything else in this topic is
detail.**

## The three steps

react.dev reduces the operation to three:

> 1. **Remove** state from the child components.
> 2. **Pass** hardcoded data from the common parent.
> 3. **Add** state to the common parent and pass it down together with the event
>    handlers.

Step 2 is the one people skip, and it is the reason the procedure is worth
following literally. Passing hardcoded values first proves the data flows
correctly before any state is involved — if the UI looks right with `isActive`
hardcoded to `true`, then the wiring is correct and the remaining work is only
adding `useState`. Debugging those two problems separately is much faster than
debugging them together.

Worked through on the accordion:

```jsx
// Before — each Panel owns its own isActive. They cannot coordinate.
function Panel({title, children}) {
  const [isActive, setIsActive] = useState(false);
  …
}
```

```jsx
// Step 1 + 2 — remove the state, take a prop, hardcode it in the parent
function Panel({title, children, isActive, onShow}) {
  return (
    <section>
      <h3>{title}</h3>
      {isActive ? <p>{children}</p> : <button onClick={onShow}>Show</button>}
    </section>
  );
}

function Accordion() {
  return (
    <>
      <Panel title="About" isActive={true}  onShow={() => {}}>…</Panel>
      <Panel title="Etymology" isActive={false} onShow={() => {}}>…</Panel>
    </>
  );
}
```

```jsx
// Step 3 — add the state, and the handlers that change it
function Accordion() {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <>
      <Panel title="About" isActive={activeIndex === 0} onShow={() => setActiveIndex(0)}>…</Panel>
      <Panel title="Etymology" isActive={activeIndex === 1} onShow={() => setActiveIndex(1)}>…</Panel>
    </>
  );
}
```

Notice what the state became. Two booleans in two children became **one index**
in the parent — and the "only one open at a time" rule is now impossible to
violate, because the data structure cannot represent two open panels. That is
the second, less-advertised payoff of lifting: it usually lets you replace
several pieces of state with one better-shaped piece.

## Finding the right owner

*Thinking in React* gives the procedure for locating the owner:

> 1. Identify *every* component that renders something based on that state.
> 2. Find their closest common parent component—a component above them all in
>    the hierarchy.
> 3. Decide where the state should live:
>    - Often, you can put the state directly into their common parent.
>    - You can also put the state into some component above their common parent.
>    - If you can't find a component where it makes sense to own the state,
>      create a new component solely for holding the state and add it somewhere
>      in the hierarchy above the common parent component.

Step 1 says *renders something based on* — not "reads". A component that only
passes the value through is not a consumer; it is a casualty. Counting it will
push the state higher than it needs to go.

The third bullet is the escape hatch that gets forgotten: **you are allowed to
invent a component whose only job is to own state.** If a search box and a table
share a parent that is a generic `<Card>`, do not put the query in `<Card>` —
introduce `<ProductSearch>` between them. Owning state is a legitimate reason
for a component to exist.

## Single source of truth

> **For each unique piece of state, you will choose the component that "owns"
> it.** This principle is also known as having a "single source of truth". It
> doesn't mean that all state lives in one place—but that for *each* piece of
> state, there is a *specific* component that holds that piece of information.

The clarification in the middle matters. "Single source of truth" is routinely
misread as "put all state in one store at the top". What it says is one owner
*per piece*: the search query in `<ProductSearch>`, the theme in a provider near
the root, a tooltip's hover state in the tooltip. Ten pieces of state can have
ten different owners and still satisfy the principle perfectly.

The violation it forbids is **the same information in two places**. That is what
produces the class of bug where two parts of the UI disagree and someone writes
an effect to keep them equal.

## Inverse data flow

Data goes down as props; changes go up as function calls. *Thinking in React*
calls the second half "inverse data flow", and the shape is always the same:

```jsx
<SearchBar
  filterText={filterText}
  inStockOnly={inStockOnly}
  onFilterTextChange={setFilterText}
  onInStockOnlyChange={setInStockOnly}
/>
```

The child does not know what happens when it calls `onFilterTextChange`. It does
not know whether the parent stores it, validates it, ignores it, or sends it to
a server. That ignorance is the point — it is what lets the same `<SearchBar>`
be reused somewhere that does something completely different.

Which is why passing `setFilterText` directly is a decision worth making
consciously. It works, and it is fine when the child genuinely is a thin
wrapper. But naming the prop `onFilterTextChange` rather than `setFilterText`
keeps the door open: later, when the parent needs to also clear page 2 of the
results, only the parent changes.

## Passing handlers, not setters, to deeper children

One level down, passing the setter is harmless. Three levels down, it is a
design smell — the leaf now knows the *shape* of the ancestor's state.

```jsx
// 🔴 the leaf knows the parent stores an array of items with an `id`
<Row onDelete={() => setItems(items.filter(i => i.id !== row.id))} />

// ✅ the leaf reports what happened; the owner decides what that means
<Row onDelete={() => handleDelete(row.id)} />
```

The second version survives the parent switching from an array to a `Map`, from
local state to a reducer, or from client state to a server mutation. The first
does not.

## What lifting is not for

Three cases that look like they need lifting and do not:

**A value that can be computed.** If the parent already has `items` and the
child needs `items.length`, do not lift a `count` state — derive it. Storing
what you can compute is the duplication the single-source rule forbids, one
level in.

**A value only one component uses.** Lifting "so it is available if we need it"
adds re-renders now for a maybe later. Push state *down* as readily as you lift
it up — the mirror-image operation, and the cheaper of the two.

**A value that many components at many depths need.** Lifting works, but at
depth it produces prop drilling. Two better answers exist:
[composition](../03-composition/02-slots-and-children.md), which removes the
intermediate layers, and context, which skips them. react.dev's own advice is to
try composition before context.

## Gotchas

**Symptom:** after lifting, the child no longer updates.
**Cause:** the child kept its `useState` and now has both — it renders its own
copy while the parent updates the prop.
**Fix:** finish step 1. Remove the state from the child entirely.

**Symptom:** the parent's state updates but the UI does not.
**Cause:** the handler mutates the existing object or array instead of creating
a new one, so `Object.is` sees no change.
**Fix:** immutable update. Phase 3 covers this in full.

**Symptom:** two components show different values for the same thing.
**Cause:** the information is stored twice — the single-source violation.
**Fix:** delete one copy and derive it. If an effect is keeping them in sync,
that effect is the evidence.

**Symptom:** everything in the app re-renders on a keystroke.
**Cause:** the state was lifted higher than its consumers needed — often to the
root "so everything can reach it".
**Fix:** lower the owner to the closest common parent, or use the composition
techniques in the [next chunk](02-the-cost.md).

**Symptom:** the child needs the parent's state shape to describe a change.
**Cause:** a setter was passed down instead of a handler.
**Fix:** pass a callback named for the event. The owner keeps its shape private.

## Interview questions

**★ What is the procedure for lifting state up?**
Three steps: remove the state from the children, pass hardcoded data down from
the common parent, then add state to the parent and pass it down along with the
event handlers. The middle step is worth doing literally — it separates "is the
data flowing correctly" from "is the state updating correctly" so you debug one
at a time.

**★ How do you decide which component should own a piece of state?**
Find every component that renders something based on it, find their closest
common parent, and put it there — or higher if something above also needs it. If
no existing component is a sensible owner, create one for the purpose. The docs
list that last option explicitly; owning state is a legitimate reason for a
component to exist.

**★ What does "single source of truth" actually mean in React?**
One owner per piece of state — not all state in one place. Different pieces can
and should have different owners at different depths. The thing it forbids is
the same information existing in two places, which is what creates the bugs
where two parts of the UI disagree and an effect is written to reconcile them.

**Should you pass `setState` down or a handler?**
A handler, once you are more than a level or two away. Passing the setter leaks
the owner's state shape into the leaf, so refactoring the owner — array to Map,
state to reducer, local to server — breaks components that had no business
knowing. A callback named for the event keeps the shape private.

**When is lifting state the wrong answer?**
When the value can be derived from something the parent already has; when only
one component uses it, in which case pushing it down is better; and when many
components at many depths need it, where lifting produces prop drilling and
composition or context is the better tool.

**What did lifting do to the accordion's state shape?**
Turned two independent booleans into a single active index — which makes "two
panels open at once" unrepresentable rather than merely prevented. Lifting often
improves the shape of the state, not just its location.

---

← Index: [Lifting state up](README.md) · Next → [The cost, and how to pay less of it](02-the-cost.md)
