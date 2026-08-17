---
title: "Designing the action surface"
sidebar_label: "02 · Designing the action surface"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useReducer`](https://react.dev/reference/react/useReducer) and
> [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer)
> for action shape and naming guidance. TypeScript discriminated unions are a
> language feature, documented in the
> [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions).
> ⚠️ Almost everything on this page is **API design judgement**, not documented
> fact, and is marked as such. Where React's docs do have a position — action
> naming — it is quoted.
> No sandbox script backs this page; claims are cited, not measured.

**The moment one caller writes `action.type === 'select'`, that string is public
API. This chunk is about choosing it before that happens.**

## What you are actually publishing

A state reducer exposes three things to every caller, permanently:

1. **The action types** — the strings they compare against.
2. **The state shape** — they spread `changes` and read fields from it.
3. **The action payloads** — they read `action.item`, `action.index`.

None of these can be changed without breaking callers, and none of them is
enforced by anything. In plain JavaScript there is no type error when you rename
`select` to `selectItem`; there is a widget that silently stops honouring a
caller's override. *(That silence is the reason this chunk exists.)*

## Name actions after what happened, not what changed

React's own reducer guidance is that actions should describe the **user's
interaction**, not the state update. The docs' example contrasts
`setFieldValue`-style actions with `changed_field`-style ones, and the same logic
applies with more force here, because your callers see these names.

```jsx
// ❌ Names the state mutation. Ties the caller to your internals.
const actions = {
  setIsOpen:        'setIsOpen',
  setSelectedItem:  'setSelectedItem',
  setHighlighted:   'setHighlighted',
};

// ✅ Names the interaction. Survives an internal redesign.
const actions = {
  triggerClicked:    'triggerClicked',
  optionSelected:    'optionSelected',
  escapePressed:     'escapePressed',
  clickedOutside:    'clickedOutside',
  itemHovered:       'itemHovered',
};
```

The practical difference: with the second set, you can later decide that
`escapePressed` should also clear the search query, and no caller breaks. With
the first, `setIsOpen` promised that it only sets `isOpen`, and now it lies.

**It also makes the caller's code readable.** `if (action.type ===
actions.escapePressed)` says why; `if (action.type === actions.setIsOpen)` says
what, and the caller has to guess which of the four things that close the menu
they are actually intercepting.

## Granularity: one action per cause, not per effect

The question that decides your action list is: **would a caller ever want to
treat these two differently?**

`Escape`, clicking outside, and selecting an item all close the menu. If they are
one `close` action, a caller cannot say "stay open when the user selects, but
close on `Escape`" — which is the exact multi-select requirement from
[chunk 01](01-the-problem-and-the-shape.md). Three actions, one shared internal
transition:

```jsx
function selectReducer(state, action) {
  switch (action.type) {
    case actions.escapePressed:
    case actions.clickedOutside:
    case actions.optionSelected:
      return { ...state, isOpen: false, ...extra(action) };
    // …
  }
}
```

*(Judgement:)* **err toward more actions.** Splitting one later is a breaking
change for anyone who matched on the combined name; merging two is not. The cost
of an extra action type is a line in a table; the cost of a missing one is a
caller who cannot express what they need.

## Payloads

Keep them minimal and derived from the event, not from your state.

```jsx
// ✅ The payload is what happened.
dispatch({ type: actions.optionSelected, item, index });

// ❌ The payload is a computed next state — now the caller has to understand it.
dispatch({ type: actions.optionSelected, item, index, nextIsOpen: false, nextQuery: '' });
```

Anything the caller could compute from `state` plus `changes` does not belong in
the action. Anything they *cannot* — which option, which key, which index — does.

**Include the raw event when the transition came from one.** A caller intercepting
`optionSelected` often wants to know whether `Shift` was held, and reconstructing
that is impossible from `state`. Passing `action.event` costs nothing and is the
difference between a caller being able to implement range-select and not.

⚠️ Do not put non-serialisable values in actions if you ever want to log or
replay them — see [chunk 03](03-living-with-it.md).

## Exporting the action types

Callers need the constants, and the way you expose them matters.

```jsx
export const useSelectActions = Object.freeze({
  triggerClicked: 'triggerClicked',
  optionSelected: 'optionSelected',
  escapePressed:  'escapePressed',
});

// Convenience: also hang them off the hook, so one import is enough.
useSelect.actions = useSelectActions;
```

**`Object.freeze` is worth the line.** Without it a caller can assign
`useSelect.actions.optionSelected = 'foo'` — accidentally, via a bad merge or a
mock — and every comparison in every other caller silently stops matching.

**Prefix the string values if the widget can be nested inside another using the
same pattern.** `'select:optionSelected'` costs nothing and makes a logged action
stream readable when three widgets are dispatching at once.

**Do not use `Symbol`s.** They serialise to nothing, break logging, and make
`action.type` unreadable in DevTools for no safety gain — the strings were never
the risk.

## Typing it

In TypeScript a discriminated union gives the caller exhaustive checking, which
is the single biggest usability win available here:

```ts
type SelectAction =
  | { type: 'triggerClicked' }
  | { type: 'optionSelected'; item: Item; index: number; event?: React.SyntheticEvent }
  | { type: 'escapePressed' }
  | { type: 'clickedOutside' };

type SelectState = { isOpen: boolean; selectedItem: Item | null };

type StateReducer = (
  state: SelectState,
  action: SelectAction,
  changes: SelectState,
) => SelectState;
```

Now `action.item` is only available inside the `optionSelected` branch, and a
caller who adds a `switch` over `action.type` gets exhaustiveness checking for
free.

⚠️ **The type is as public as the strings.** Widening `SelectAction` is safe;
narrowing it, renaming a member, or making a payload field required are all
breaking changes. And `SelectState` appearing in the signature means **every
field of your state is now published** — including ones you meant to be internal.
*(If some state genuinely is internal, keep it in a separate `useRef` or a second
reducer that the caller's function never sees. That is the only reliable way to
keep it out of the API.)*

## Changing an action later

You cannot rename one silently. The options, in order of preference:

1. **Add the new name, dispatch both.** Two actions fire for one interaction;
   old callers match the old one, new callers the new. Ugly, works, and the
   double-dispatch is visible in logs.
2. **Add the new name, keep the old as an alias in your exported object.** Only
   works if the *string value* stays the same — you have renamed the constant,
   not the API.
3. **Major version.** The honest option when the action's *meaning* changed
   rather than its name.

*(Judgement:)* the thing to avoid is silently changing what an existing action
does. A caller's override still runs, still returns something plausible, and now
produces behaviour nobody designed.

## Gotchas

**Naming an action after the state field guarantees a breaking change later.**
`setIsOpen` cannot ever do anything except set `isOpen`, and the day `Escape`
also needs to clear a query, you either break the promise or add a second action.

**Collapsing distinct causes into one action removes the caller's ability to
distinguish them**, which is the whole point of the pattern. `close` covering
`Escape`, outside-click and selection is the classic instance.

**A caller matching on a string literal instead of your constant is out of your
control.** They will do it. That is why the string value — not just the exported
name — is the thing you cannot change.

**Putting DOM events in actions makes them non-serialisable.** Fine for
interception, fatal for logging or replay, and a synthetic event may be pooled or
detached by the time anything reads it later.

**Exhaustive `switch` in the caller breaks when you add an action.** That is
usually *good* in TypeScript — it tells them — but it means adding an action is
not entirely free either. Say in your docs that callers should include a
`default: return changes`.

**A frozen action object is only shallow-frozen.** `Object.freeze` on a flat
string map is enough here; do not assume it protects nested structures elsewhere.

**Publishing your whole state shape is a decision you make by accident.** The
moment `changes` is typed as `SelectState`, every field is API. Decide which
state is internal *before* the first release, not after.

## Interview questions

**What does a state reducer publish?**
The action type strings, the state shape, and the action payloads — all three
permanently, because callers compare against the strings, spread `changes`, and
read payload fields.

**How should actions be named?**
After the interaction that happened, not the state change it causes —
`optionSelected`, not `setSelectedItem`. React's own reducer guidance says the
same, and here it also decides whether you can change the internal transition
later without breaking callers.

**How do you choose action granularity?**
Ask whether a caller would ever want to treat two causes differently. If yes,
they are separate actions even when they share an internal transition. Err toward
more actions — splitting one later is breaking, merging two is not.

**What belongs in an action payload?**
What happened and nothing else: which item, which index, and the originating
event where a caller might need modifier keys. Anything derivable from `state`
and `changes` does not belong.

**Why freeze the exported action constants?**
So a stray assignment — from a bad merge or a test mock — cannot silently change
the string every other caller compares against.

**Why not use `Symbol`s for action types?**
They break logging and replay, read badly in DevTools, and buy no safety. The
strings were never the vulnerability.

**What does typing the reducer with a discriminated union buy you?**
Payload fields are only visible in the branch that has them, and callers writing
a `switch` get exhaustiveness checking.

**What is the hidden cost of that type?**
The state type in the signature publishes every field of your state. Internal
state has to live somewhere the caller's function never sees — a ref, or a second
reducer.

**How do you rename an action after release?**
You do not, silently. Dispatch both names for a transition, alias the exported
constant if only the constant changed, or bump a major version. Never change what
an existing action means.

---

← Prev: [01 · The problem and the shape](01-the-problem-and-the-shape.md) · Index: [The state reducer pattern](README.md) · Next → [03 · Living with it](03-living-with-it.md)
