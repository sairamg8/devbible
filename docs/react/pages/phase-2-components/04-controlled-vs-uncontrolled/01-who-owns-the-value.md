---
title: "Who owns the value"
sidebar_label: "01 · Who owns the value"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
> and [`<input>`](https://react.dev/reference/react-dom/components/input).
> No sandbox script backs this page; claims are cited, not measured. The
> measured DOM behaviour of form inputs is on
> [Phase 1 · Controlled and uncontrolled](../../phase-1-jsx/13-form-elements/01-controlled-and-uncontrolled.md).

**"Controlled" is not a property of inputs. It is a property of any component,
and it answers one question: when this thing's value changes, whose state
changed?**

## The general definition

Phase 1 covered controlled and uncontrolled `<input>` elements — value in React
state versus value in the DOM. That is one instance of a much broader idea, and
react.dev states the general form:

> It is common to call a component with some local state "uncontrolled". For
> example, the original `Panel` component with an `isActive` state variable is
> uncontrolled because its parent cannot influence whether the panel is active
> or not.
>
> In contrast, you might say a component is "controlled" when the important
> information in it is driven by props rather than its own local state. This
> lets the parent component fully specify its behavior.

No DOM involved. A `<Panel>`, an `<Accordion>`, a `<Dropdown>`, a `<Wizard>` —
each holds some important piece of information, and it is either in its own
`useState` or in a prop.

The docs are also careful to say the terms are informal:

> In practice, "controlled" and "uncontrolled" aren't strict technical
> terms—each component usually has some mix of both local state and props.
> However, this is a useful way to talk about how components are designed and
> what capabilities they offer.

Which is worth taking literally. A `<DataTable>` might have a controlled sort
order, an uncontrolled column width, and an uncontrolled scroll position, all at
once. The question is asked **per piece of state**, not per component.

## The two shapes

**Uncontrolled — the component owns it**

```jsx
function Panel({title, children}) {
  const [isActive, setIsActive] = useState(false);
  return (
    <section>
      <h3>{title}</h3>
      {isActive
        ? children
        : <button onClick={() => setIsActive(true)}>Show</button>}
    </section>
  );
}

<Panel title="About">…</Panel>            // caller passes nothing
```

**Controlled — the caller owns it**

```jsx
function Panel({title, isActive, onShow, children}) {
  return (
    <section>
      <h3>{title}</h3>
      {isActive ? children : <button onClick={onShow}>Show</button>}
    </section>
  );
}

const [openId, setOpenId] = useState(null);   // in the parent
<Panel title="About" isActive={openId === 'about'} onShow={() => setOpenId('about')}>…</Panel>
```

The controlled version has no state at all. It is a pure function of its props,
which is what makes it composable — and also what makes it useless on its own,
since something must hold the state.

## The trade, stated plainly

react.dev's summary is the one to remember:

> Uncontrolled components are easier to use within their parents because they
> require less configuration. But they're less flexible when you want to
> coordinate them together. Controlled components are maximally flexible, but
> they require the parent components to fully configure them with props.

Expanded into what actually decides it:

| | Uncontrolled | Controlled |
|---|---|---|
| Call site | `<Panel />` | `<Panel isActive={…} onShow={…} />` |
| Who can read the value | Nobody outside | Anyone with the state |
| Who can set it | Nobody outside | The owner, at any time |
| Coordination between siblings | Impossible | Natural |
| Validation before accepting a change | Impossible | Natural |
| Reset from outside | Only by remounting with `key` | Set the state |
| Value survives the component unmounting | No | Yes — it lives above |
| Renders when the value changes | Just this subtree | The owner and everything below it |

The last row is the cost people forget. Controlling a value means the state
moved *up*, so the update now re-renders the owner and every sibling under it.
That is the same cost as [lifting state up](../05-lifting-state-up/README.md),
because it is the same operation.

## When each is right

**Start uncontrolled.** It is less API, less coupling, and a component nobody
needs to configure is a component nobody can misconfigure. If no other part of
the app cares about a disclosure panel's open state, do not export it.

**Control it when a second thing needs the value.** The trigger is almost always
one of five:

1. **Coordination** — only one accordion section may be open at a time. Two
   components must agree, so the state must be above both.
2. **Persistence** — the value goes in the URL, `localStorage`, or the server.
   Something outside must be able to read it.
3. **Validation or transformation** — the owner wants to reject or reshape a
   change before it takes effect. Impossible if the component already applied
   it.
4. **Programmatic control** — a "clear all filters" button somewhere else must
   set it.
5. **Reflecting external data** — the value is really server state arriving
   asynchronously, and the component must show it whenever it changes.

**Do not control it "in case".** Speculatively controlled state is the most
common source of the sync bugs in the [next chunk](02-the-switch-warning.md): a
value that exists in two places and has to be kept identical by hand.

## Naming the controlled API

Conventions, not rules, but consistency is worth more here than novelty — a
component that follows them is usable without reading its source.

```jsx
<Dropdown
  value={selected}            // the current value
  onChange={setSelected}      // called with the NEXT value
  defaultValue="all"          // uncontrolled initial value only
/>
```

- **`value` / `onChange`** for a single value. Match the DOM's naming so that
  callers can wire the component the same way they wire an `<input>`.
- **`checked` / `onChange`** for a boolean, and **`open` / `onOpenChange`** for
  disclosure. `on…Change` is the widely used form when the event is not a DOM
  change event.
- **`defaultX` for the uncontrolled initial value**, mirroring `defaultValue`
  and `defaultChecked`. The `default` prefix is a strong signal that it is read
  once and ignored afterwards.
- **Call the handler with the *value*, not the event**, unless you are wrapping
  a real DOM input. `onChange(nextValue)` is far more useful to a caller than
  `onChange(syntheticEvent)` when there is no DOM event to begin with.

One more that pays for itself: **name a handler for what happened, not what
should happen.** `onSelect` rather than `setSelected` — the caller decides what
setting means, and might do something entirely different with it.

## The mixed case is normal

A component is rarely all one thing. `<DataTable>` might reasonably be:

```jsx
<DataTable
  rows={rows}
  sort={sort} onSortChange={setSort}   // controlled — goes in the URL
  defaultPageSize={25}                 // uncontrolled — nobody else cares
/>
```

Sort is in the URL so it must be controlled. Page size is a local preference, so
it stays inside. Column widths, hover state, and which row has keyboard focus
are all uncontrolled without anyone thinking about it.

Asking the question per value rather than per component is what keeps the API
small. The alternative — controlling everything for symmetry — produces
components with fifteen `value`/`onChange` pairs that every caller must wire.

## Gotchas

**Symptom:** a component takes `value` and `onChange` but nobody passes them.
**Cause:** it was made controlled speculatively.
**Fix:** either make it uncontrolled, or support both
([next chunk](02-the-switch-warning.md)) — but do not require configuration
nobody needs.

**Symptom:** two sibling panels can both be open, and the design says only one
should.
**Cause:** each owns its own `isActive`, so neither can know about the other.
**Fix:** lift the state to the common parent and control both. This is exactly
react.dev's accordion example.

**Symptom:** a controlled value updates a render late.
**Cause:** the owner is setting state from an effect that reacts to the child's
change, adding a render between the event and the update.
**Fix:** set it directly in the handler. An effect that syncs state to state is
the antipattern Phase 3 covers.

**Symptom:** typing feels laggy in a large form.
**Cause:** the value is controlled far above, so every keystroke re-renders a
large subtree.
**Fix:** ask whether it needs to be controlled at that level. Local state plus a
submit-time read is often enough; if it truly must be shared, that is what
transitions and memoization are for.

**Symptom:** a "reset" button does not clear an uncontrolled component.
**Cause:** the caller has no access to state it does not own.
**Fix:** remount it with a changing `key`, or control the value. `key` is the
lighter of the two and often the right answer.

## Interview questions

**★ What does "controlled" mean, outside of form inputs?**
That the important information in the component is driven by props rather than
its own state, so the parent fully specifies its behaviour. Uncontrolled means
the component holds that information itself and the parent cannot influence it.
The docs are explicit that these are informal terms and that most components
mix both — the question is asked per piece of state, not per component.

**★ What is the trade-off?**
Uncontrolled components are easier to use because they need no configuration,
but they cannot be coordinated with anything else. Controlled components are
maximally flexible but require the parent to fully configure them — and the
state moved up, so updating it re-renders the owner and everything below.

**★ When would you convert an uncontrolled component to a controlled one?**
When a second thing needs the value: coordination between siblings, persistence
to the URL or server, validating or transforming a change before accepting it,
programmatic control from elsewhere, or reflecting data that arrives
asynchronously. Absent one of those, the extra API is cost with no benefit.

**How do you reset an uncontrolled component from outside?**
Give it a `key` that changes. Changing the key changes its position as far as
reconciliation is concerned, so React unmounts the old instance and mounts a
fresh one with initial state. It is usually preferable to controlling the value
purely to be able to reset it.

**Why does controlling a value sometimes make typing feel slow?**
Because the state lives above the input, so every keystroke re-renders that
owner and its entire subtree. Uncontrolled inputs keep the work in the DOM. If
the value must be shared, the fix is scope — control it as low as possible — and
then memoization or a transition, not abandoning control.

**What naming would you give a controlled component's props?**
Mirror the DOM: `value`/`onChange`, `checked`/`onChange`, and `defaultValue` for
the uncontrolled initial value. For non-DOM concepts, `open`/`onOpenChange` is
the common shape. Call the handler with the next value rather than an event when
there is no real DOM event, and name it for what happened rather than for what
the parent should do about it.

---

← Index: [Controlled vs uncontrolled](README.md) · Next → [The switch warning, and supporting both](02-the-switch-warning.md)
