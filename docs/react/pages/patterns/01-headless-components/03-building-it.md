---
title: "Building it"
sidebar_label: "03 · Building it"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useRef`](https://react.dev/reference/react/useRef),
> [`useId`](https://react.dev/reference/react/useId),
> [`useCallback`](https://react.dev/reference/react/useCallback),
> [Common components](https://react.dev/reference/react-dom/components/common)
> for the `ref` callback cleanup contract, and
> [Responding to Events](https://react.dev/learn/responding-to-events) for
> `preventDefault`. Behavioural requirements from the W3C
> [APG Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/),
> fetched 2026-08-17 — the requirements are quoted in
> [chunk 02](02-the-contract-you-are-inheriting.md).
> ⚠️ **This code has not been run.** Under the standing no-sandbox rule it is
> written against the documented APIs and the quoted spec, and carries no console
> output. Treat it as a worked reference, not as tested library code.
> No sandbox script backs this page; claims are cited, not measured.

**Single-select listbox, roving `tabindex`, with the bindings chunk 02 quoted.
This is the widget the previous version of this topic promised and did not
build.**

## The state, and why each piece exists

```jsx
import { useCallback, useId, useRef, useState } from 'react';

const TYPEAHEAD_RESET_MS = 500;

function useListbox({ items, getLabel = (item) => item.label, onSelect }) {
  const listboxId = useId();

  const [activeIndex, setActiveIndex]     = useState(0);   // where focus is
  const [selectedIndex, setSelectedIndex] = useState(-1);  // what is chosen

  const optionRefs = useRef([]);                    // for imperative .focus()
  const typeahead  = useRef({ buffer: '', timer: 0 });
```

**`activeIndex` and `selectedIndex` are two different things**, and collapsing
them is the first mistake people make. The spec is explicit that arrow keys move
*focus*, and that moving selection with focus is *optional* in single-select.
With one variable you cannot express "focused but not chosen", which is exactly
the state a keyboard user is in while browsing the list.

**`optionRefs` exists because roving `tabindex` needs real DOM focus.** There is
no declarative way to say "focus this element now" — `.focus()` is imperative, so
you need the node.

**`typeahead` is a ref, not state, deliberately.** Nothing renders from the
buffer. Making it state would re-render the whole list on every keystroke to
change a value nobody displays.

## Moving focus

```jsx
  const focusOption = useCallback((index) => {
    setActiveIndex(index);
    optionRefs.current[index]?.focus();
  }, []);
```

Two things happen because both are needed: the state update re-renders so
`tabIndex` moves to the new option, and the imperative `.focus()` actually moves
the browser's focus. Doing only the first leaves focus on the old element with
`tabIndex={-1}`; doing only the second leaves two options claiming `tabIndex={0}`
on the next render.

## Type-ahead

The spec's two behaviours differ only by timing, so the buffer is the entire
implementation.

```jsx
  const findMatch = useCallback((needle, from) => {
    for (let offset = 0; offset < items.length; offset += 1) {
      const index = (from + offset) % items.length;          // wraps
      if (getLabel(items[index]).toLowerCase().startsWith(needle)) return index;
    }
    return -1;
  }, [items, getLabel]);

  const onType = useCallback((char) => {
    const state = typeahead.current;
    window.clearTimeout(state.timer);
    state.buffer += char.toLowerCase();
    state.timer = window.setTimeout(() => { state.buffer = ''; }, TYPEAHEAD_RESET_MS);

    // "b b b" cycles through the b's; "b r o" matches "Broccoli".
    const repeated = state.buffer.length > 1
      && [...state.buffer].every((c) => c === state.buffer[0]);
    const needle = repeated ? state.buffer[0] : state.buffer;

    // A single character advances PAST the current option; a longer string
    // refines from where we are.
    const from = needle.length === 1 ? activeIndex + 1 : activeIndex;

    const match = findMatch(needle, from);
    if (match !== -1) focusOption(match);
  }, [activeIndex, findMatch, focusOption]);
```

The `repeated` check is what makes pressing "b" three times cycle rather than
search for `"bbb"` and find nothing. It is four lines and it is the difference
between a list that feels native and one that feels broken.

## Selection

```jsx
  const select = useCallback((index) => {
    setSelectedIndex(index);
    onSelect?.(items[index], index);
  }, [items, onSelect]);
```

## The keyboard handler

Every binding from chunk 02 that applies to single-select:

```jsx
  const onKeyDown = useCallback((event) => {
    const last = items.length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();                       // or the page scrolls
        focusOption(Math.min(activeIndex + 1, last));
        return;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(Math.max(activeIndex - 1, 0));
        return;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        return;
      case 'End':
        event.preventDefault();
        focusOption(last);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();                       // Space would scroll
        select(activeIndex);
        return;
      default:
        // Printable characters only, and never steal a shortcut.
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          onType(event.key);
        }
    }
  }, [activeIndex, items.length, focusOption, select, onType]);
```

`Math.min`/`Math.max` rather than modulo: the spec does not ask for wrapping on
arrow keys, and a list that jumps from last to first surprises people. Type-ahead
*does* wrap, which is why `findMatch` uses `%`.

## Gotchas

**`activeIndex` survives an `items` change and can point past the end.** Replace
`items` with a shorter list and the next `ArrowDown` reads `undefined`. Clamp it
when the list changes — during render, not in an effect, which costs an extra
render and shows the wrong option first
([derived state](../../phase-3-state/06-derived-state.md)).

**`Space` must be handled before the type-ahead branch.** `' '.length === 1`, so
if it fell through to the default case it would be buffered as a search
character and never select anything. It also has to be prevented or the page
scrolls.

**`preventDefault()` on every printable key steals application shortcuts.** Many
apps bind `/` to search and `?` to help. The modifier checks let `Ctrl`/`Cmd`
combinations through, but a bare `/` is still swallowed while the listbox has
focus. Scope it if your app uses single-key shortcuts.

**Arrow keys do not wrap here, deliberately.** The APG does not require it, and a
list that jumps from the last item to the first surprises people. If you add
wrapping, add it in both directions and document it — half-wrapping is worse than
neither.

**The type-ahead timer is never cleared on unmount.** A pending `setTimeout`
firing after unmount writes to a ref belonging to a dead component. Harmless as
written, but it is the shape of a leak, and the same code calling `setState`
would be a real one. Clear it in a cleanup.

**`getLabel` will usually change identity every render**, because callers pass an
inline arrow. `findMatch`'s `useCallback` then rebuilds on every render and buys
nothing. Either document that `getLabel` must be stable or stabilise it
internally.

**Repeated-character detection has an edge case.** Treating an all-identical
buffer as "cycle" means a list containing an item literally named `"aa"` cannot be
reached by typing "a", "a" quickly — that input cycles instead of matching. Real
implementations accept this; it is worth knowing it is a choice rather than an
oversight.

**`findMatch` is O(n) per keystroke.** Fine for hundreds of options, and worth
noticing before you point this at ten thousand.

**Type-ahead moves focus but not selection**, which is correct per the spec and
frequently reported as a bug by people expecting the old Windows combobox
behaviour. It is worth stating in your own documentation.

**Two `useListbox()` calls are two independent listboxes** — the rule from
[share logic, not state](../../phase-7-custom-hooks/03-share-logic-not-state/README.md),
and still the most common misunderstanding of headless hooks.

## Interview questions

**Why are `activeIndex` and `selectedIndex` separate?**
Because the spec separates focus from selection: arrow keys move focus, and
moving selection with focus is only *optional* in single-select. One variable
cannot represent "focused but not chosen", which is the state a keyboard user
occupies while browsing the list.

**Why does `focusOption` both set state and call `.focus()`?**
The state update moves `tabIndex={0}` to the new option on re-render; the
imperative call moves the browser's actual focus. Either one alone leaves the DOM
and the component disagreeing about where focus is.

**Why is the type-ahead buffer a ref rather than state?**
Nothing renders from it. As state it would re-render the entire list on every
keystroke in order to update a value that is never displayed.

**How does the code distinguish the spec's two type-ahead behaviours?**
By timing and by content. Keystrokes accumulate into a buffer that resets after
~500 ms; a buffer whose characters are all identical is treated as a repeat, so
it cycles to the next match for that single character instead of searching for
the literal repeated string.

**Why does `findMatch` wrap when the arrow keys do not?**
Type-ahead is a search and should find a match anywhere in the list. Arrow
navigation is positional, the APG does not require wrapping, and wrapping there
disorients people.

**Why must `Space` be handled before the default branch?**
Because a space character has length 1 and would otherwise be treated as
type-ahead input, so the key that is meant to select would silently search
instead.

**Why is `preventDefault()` on `ArrowDown` not optional?**
Without it the browser scrolls the page while the user navigates, so the widget
moves out from under them.

**What is the first thing that breaks when `items` changes?**
`activeIndex` can point past the end of the new array, so the next arrow press
reads `undefined`.

**What would multi-select require?**
A selection set rather than a single index, a `Shift` range anchor, and one of
the two APG models implemented in full — plain `Space` toggling versus
`Control + Space` toggling, and whether plain arrows change selection. The two
models are mutually exclusive.

**Why is the keyboard handler on the container rather than on each option?**
Events from the focused option bubble, so one handler serves the whole widget.
That works precisely because roving `tabindex` puts real DOM focus on an option.

---

← Prev: [02 · The contract you are inheriting](02-the-contract-you-are-inheriting.md) · Index: [Headless components](README.md) · Next → [04 · Wiring it to the DOM](04-wiring-it-up.md)
