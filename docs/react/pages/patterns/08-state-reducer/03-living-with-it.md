---
title: "Living with it"
sidebar_label: "03 · Living with it"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useReducer`](https://react.dev/reference/react/useReducer),
> [Keeping Components Pure](https://react.dev/learn/keeping-components-pure),
> [`useCallback`](https://react.dev/reference/react/useCallback) and
> [`useRef`](https://react.dev/reference/react/useRef).
> ⚠️ The testing, debugging and composition guidance here is **engineering
> judgement** built on those documented APIs, and is marked as such. The purity
> requirement is the one hard constraint and it is cited.
> No sandbox script backs this page; claims are cited, not measured.

**The pattern's best property is one nobody mentions: it makes a stateful widget
testable as a pure function.**

## Testing — the payoff

A reducer is `(state, action) => state`. No DOM, no rendering, no `act()`, no
fake timers.

```jsx
test('selecting an option closes the menu', () => {
  const before = { isOpen: true, selectedItem: null };
  const after  = selectReducer(before, { type: actions.optionSelected, item: apple });

  expect(after).toEqual({ isOpen: false, selectedItem: apple });
  expect(before).toEqual({ isOpen: true, selectedItem: null });   // purity
});
```

That second assertion is worth writing every time: it proves the reducer did not
mutate its input, which is the contract react.dev requires and the one most
easily broken by a helper three calls deep.

**Test the caller's override the same way**, by composing the two exactly as the
hook does:

```jsx
const compose = (userReducer) => (state, action) =>
  userReducer(state, action, selectReducer(state, action));

test('the multi-select override keeps the menu open', () => {
  const reducer = compose((state, action, changes) =>
    action.type === actions.optionSelected ? { ...changes, isOpen: true } : changes,
  );

  expect(reducer({ isOpen: true, selectedItem: null },
                 { type: actions.optionSelected, item: apple }))
    .toEqual({ isOpen: true, selectedItem: apple });
});
```

⚠️ **This tests the transitions, not the widget.** Whether `Escape` actually
dispatches `escapePressed` is a DOM question and needs
[Phase 14](../../phase-14-correctness/README.md). A green reducer suite with a
broken key handler is entirely possible.

## Debugging — the reducer is an audit trail

Because every state change goes through one function, one line makes the widget
self-describing:

```jsx
function useSelect({ stateReducer = (s, a, c) => c, debug = false } = {}) {
  const [state, dispatch] = useReducer((state, action) => {
    const changes = selectReducer(state, action);
    const final   = stateReducer(state, action, changes);

    if (debug) {
      console.groupCollapsed(`select · ${action.type}`);
      console.log('state   ', state);
      console.log('proposed', changes);
      console.log('applied ', final);          // differs ⇒ the caller intervened
      console.groupEnd();
    }
    return final;
  }, initialState);
  // …
}
```

**`proposed` versus `applied` is the diagnostic.** When a caller reports "your
component does not close", that log answers in one line whether your reducer
proposed closing and their override cancelled it. Without the pattern the same
question takes an afternoon.

*(Judgement:)* ship this behind a flag rather than stripping it. The people who
need it are integrators you cannot reach.

## Composing with prop getters and headless hooks

The state reducer and [prop getters](../supporting/prop-getters.md) answer two different
questions, and a headless widget wants both:

| | Question it answers |
|---|---|
| **Prop getter** | how do the caller's props merge with mine on *this element*? |
| **State reducer** | how does the caller change what a *transition* does? |

Wired together, the dispatch sites live inside the getters:

```jsx
const getOptionProps = useCallback((index, { onClick, ...rest } = {}) => ({
  role: 'option',
  'aria-selected': index === state.selectedIndex,
  ...rest,
  onClick: (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      dispatch({ type: actions.optionSelected, index, item: items[index], event });
    }
  },
}), [state.selectedIndex, items]);
```

Note the two independent escape hatches: `preventDefault()` in the caller's
handler stops the action being dispatched at all, and `stateReducer` intercepts
it if it is. **Those are different powers** — one is "this click should do
nothing", the other is "this selection should not close the menu" — and a
well-designed widget offers both.

## Multiple reducers, and composing overrides

A caller wrapping your component and re-exposing `stateReducer` has to compose
rather than replace:

```jsx
function MyMultiSelect({ stateReducer: outer = (s, a, c) => c, ...props }) {
  return (
    <BaseSelect
      {...props}
      stateReducer={(state, action, changes) => {
        const mine = action.type === actions.optionSelected
          ? { ...changes, isOpen: true }
          : changes;
        return outer(state, action, mine);   // their turn, on top of mine
      }}
    />
  );
}
```

⚠️ **Order is a real decision.** Running the outer reducer last lets the
application override the wrapper; running it first lets the wrapper enforce
invariants. Neither is right in general — **document which you chose**, because
the caller cannot see it.

## Performance

The reducer runs on every dispatch, synchronously, during the update. *(Judgement
from that fact, not a measured claim:)* keep it cheap — no deep clones, no array
scans over thousands of items, no `JSON.parse(JSON.stringify(...))`. It is
usually irrelevant, and it is the one place in the pattern where a caller can
make your widget slow with code you never see.

Returning `state` unchanged from a veto is worth knowing about here:
[`useReducer`](https://react.dev/reference/react/useReducer) documents that if
the reducer returns the same value, React may bail out of re-rendering. A veto is
therefore usually free.

## When to retire it

*(Judgement.)* Signs the pattern is no longer paying:

- **Nobody has passed a `stateReducer` in a year.** It is API surface you are
  maintaining for nobody. Consider deprecating it — though note that removing it
  is itself breaking.
- **Every caller passes the same override.** That is not an exception; that is
  your default being wrong. Change the default.
- **Callers are using it to work around missing features.** A `stateReducer` that
  fakes multi-select means multi-select should be a first-class option, not
  something each caller reinvents slightly differently.
- **The overrides have become the documentation.** If the only way to learn what
  your widget does is to read three teams' reducers, the transitions need names
  and a table, not more flexibility.

## Gotchas

**A reducer defined inline is a new function every render, and that is fine
here** — `useReducer` reads the reducer it is given at dispatch time, and the
composition wrapper closes over the current `stateReducer` on each render. It is
worth knowing you do **not** need to memoize the caller's function, because
people memoize it out of habit and then close over stale values.

**Closing over props inside the caller's `stateReducer` is where staleness bites
instead.** If their reducer reads `props.mode`, it reads whatever was captured
when that function instance was created — normally current, but not if they
wrapped it in `useCallback` with an empty dependency array. This is the actual
staleness trap and it is caused by over-memoizing.

**Logging actions with a DOM event in the payload can retain nodes.** A
`console.log` keeps a reference; a long-lived debug array keeps many. Strip
`event` before storing anything.

**Testing the reducer in isolation proves the transitions and nothing else.** No
assertion in a reducer suite can tell you the `Escape` handler is wired up.

**A veto that returns a *new but equal* object defeats the bail-out.**
Writing `return { ...state }` is not the same as `return state` — the identity
differs, so React re-renders. Return the original reference.

**Composed reducers make the veto ambiguous.** If the wrapper vetoes and the
application amends, whose intent wins depends entirely on the order you chose —
and neither party can tell from their own code.

**Deprecating `stateReducer` is breaking even if nobody uses it**, because you
cannot know that. Removal needs a major version regardless of your telemetry.

**The pattern encourages callers to depend on transitions rather than ask for
features.** *(Judgement.)* Watch for this — a healthy integration uses the
`stateReducer` for one genuine exception, not for five things that should have
been props.

## Interview questions

**What is the state reducer pattern's best testing property?**
The transitions are a pure function, so they test without a DOM, rendering,
`act()` or timers — including the caller's override, by composing it the same way
the hook does.

**What should every reducer test also assert?**
That the input state was not mutated. Purity is the contract React requires and
the easiest thing to break in a helper.

**What does a reducer suite not prove?**
That anything is wired up. Whether `Escape` dispatches `escapePressed` is a DOM
question and needs integration tests.

**How does the pattern help you debug an integrator's bug report?**
Logging `state`, `proposed` and `applied` around the composition shows in one
line whether your reducer proposed the transition and the caller's override
changed it.

**How do prop getters and state reducers divide the work?**
Getters decide how the caller's props merge onto an element; the state reducer
decides what a transition does. A headless widget wants both, and they give the
caller two different escape hatches — suppressing the dispatch, and amending its
result.

**What has to be documented when a wrapper composes reducers?**
The order. Running the application's reducer last lets it override the wrapper;
running it first lets the wrapper enforce invariants, and no caller can tell
which you chose by reading their own code.

**Is a veto free?**
Usually. `useReducer` documents that returning the same value may let React bail
out of re-rendering — but only if you return the same reference. `{ ...state }`
re-renders.

**Do callers need to memoize their `stateReducer`?**
No, and memoizing it is how they create stale closures. The composition reads the
current function on each render.

**When should you remove the pattern from a component?**
When every caller passes the same override — your default is wrong — or when
overrides are being used to fake features that should be first-class. Removing it
is still a breaking change.

---

← Prev: [02 · Designing the action surface](02-designing-the-action-surface.md) · Index: [The state reducer pattern](README.md)
