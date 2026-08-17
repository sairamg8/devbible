---
title: "Wiring it to the DOM"
sidebar_label: "04 · Wiring it to the DOM"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`useId`](https://react.dev/reference/react/useId),
> [`useCallback`](https://react.dev/reference/react/useCallback) and
> [Common components](https://react.dev/reference/react-dom/components/common)
> for the `ref` callback cleanup contract. ARIA requirements from the W3C
> [APG Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/),
> fetched 2026-08-17 and quoted in
> [chunk 02](02-the-contract-you-are-inheriting.md).
> ⚠️ **This code has not been run** — written against documented APIs under the
> standing no-sandbox rule, and carrying no console output.
> No sandbox script backs this page; claims are cited, not measured.

**[Chunk 03](03-building-it.md) built the behaviour. Nothing has touched the DOM
yet. This is the half that decides whether the caller can get it wrong.**

## The prop getters

```jsx
  const getListboxProps = useCallback(({ onKeyDown: callerKeyDown, ...rest } = {}) => ({
    role: 'listbox',
    id: listboxId,
    ...rest,
    onKeyDown: (event) => {
      callerKeyDown?.(event);
      if (!event.defaultPrevented) onKeyDown(event);
    },
  }), [listboxId, onKeyDown]);

  const getOptionProps = useCallback((index, { onClick, ref, ...rest } = {}) => ({
    role: 'option',
    id: `${listboxId}-option-${index}`,
    'aria-selected': index === selectedIndex,      // present on EVERY option
    tabIndex: index === activeIndex ? 0 : -1,      // exactly one is 0
    ref: mergeRefs((node) => { optionRefs.current[index] = node; }, ref),
    ...rest,
    onClick: (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) { setActiveIndex(index); select(index); }
    },
  }), [listboxId, selectedIndex, activeIndex, select]);

  return { getListboxProps, getOptionProps, activeIndex, selectedIndex };
}
```

Four decisions worth naming.

**`aria-selected` is `index === selectedIndex`, which yields `false` — not
`undefined` — for every other option.** Chunk 02 quoted the rule: an absent
`aria-selected` means "not selectable", while `false` means "selectable, not
currently selected". A ternary that returns `undefined` for unselected options
would silently change what the widget claims to be.

**`tabIndex` is computed, so exactly one option can ever be `0`.** The invariant
is enforced by construction rather than by the caller remembering it. This is the
entire value of a getter over documentation.

**Everything above `...rest` is a default; everything below is an invariant.**
`role` and `id` sit above, so a caller *can* override them — sometimes
legitimately, e.g. a `role="option"` wrapped in a `role="presentation"` list.
`tabIndex`, `aria-selected` and `ref` sit above too, which is a **deliberate but
arguable** choice: it lets a caller break the widget. Move them below `...rest`
if you would rather the widget win. *(Judgement — the trade-off is discussed in
[prop getters](../supporting/prop-getters.md).)*

**`mergeRefs` is not optional here.** The hook needs the node for `.focus()` and
the caller may want it too. The version that survives React 19's cleanup
contract — the one that does not lose the `null` reset — is in
[prop getters](../supporting/prop-getters.md).

## Using it

```jsx
function FruitPicker({ fruits }) {
  const { getListboxProps, getOptionProps } = useListbox({
    items: fruits,
    onSelect: (fruit) => console.log('picked', fruit),
  });

  return (
    <ul {...getListboxProps({ 'aria-label': 'Fruit' })} className="picker">
      {fruits.map((fruit, i) => (
        <li key={fruit.id} {...getOptionProps(i, { className: 'picker-option' })}>
          {fruit.label}
        </li>
      ))}
    </ul>
  );
}
```

**What the caller chose:** `<ul>`/`<li>`, their own class names, their own label.
They could have used `<div>`s, a table, or a wrapper element per option. That is
the test from [chunk 01](01-what-headless-means.md), and this passes it.

**What the caller could not get wrong:** the roles, the id relationships,
`aria-selected` present on every option, exactly one `tabIndex={0}`, and every
keyboard binding from chunk 02.

**What the caller still has to supply:** `aria-label` — the spec requires an
accessible name and the hook cannot invent one. Chunk 02's container rules also
require `aria-multiselectable` and `aria-orientation` where they apply, and this
hook implements neither.

## Gotchas

**`optionRefs.current` is never cleaned up.** Items removed from the list leave
detached nodes in the array, so `focusOption` can call `.focus()` on an element
that is no longer in the document — silently doing nothing. Either reset the
array during render or return a cleanup from the ref callback
([ref callbacks](../../phase-5-refs-context-reducers/06-ref-callbacks.md)).

**Refs are keyed by index, not identity.** Reorder the list and the refs point at
the wrong nodes. Stable lists are fine; a sortable or filterable list needs
keying by id.

**Option ids are derived from the index too**, so `aria-activedescendant` or any
external `aria-controls` pointing at `${listboxId}-option-3` refers to a
different item after a sort. Same fix.

**A caller passing their own `id` to `getOptionProps` breaks the id scheme
silently**, because `id` sits above `...rest`. Nothing references those ids in
this single-select roving-focus version, so the damage is latent — and appears
the day someone adds `aria-activedescendant`.

**`getListboxProps` runs the caller's `onKeyDown` first and honours
`defaultPrevented`.** That is the escape hatch, but it means a caller who calls
`preventDefault()` for their own reasons disables the entire keyboard interface
without an obvious connection between cause and effect. Document it.

**`onClick` sets `activeIndex` as well as selecting.** Without that line, a mouse
click selects an option while keyboard focus stays somewhere else, so the next
`ArrowDown` jumps from a place the user does not think they are.

**Nothing gives the container a `tabIndex`.** With roving focus that is correct —
focus lands on an option — but the list is unreachable by `Tab` until at least
one option renders. An empty list is a keyboard dead end, and the empty state
needs its own handling.

**`aria-setsize` and `aria-posinset` are absent.** Correct for a fully rendered
list, wrong the moment you virtualise, and chunk 02 quotes the requirement.

**Scroll-into-view is inherited from `.focus()`, not chosen.** Usually right;
inside a transformed or virtualised container it can fight your own scrolling.
`scrollIntoView({ block: 'nearest' })` after focusing takes control back.

**The getters return new objects and new closures every render.** A `memo`'d
option component will re-render regardless. Whether that matters is a
[Phase 6](../../phase-6-performance/README.md) question, and the Compiler changes
the answer — but do not assume it away on a 5,000-row list.

**`getOptionProps` takes the index as its first argument**, which is a small API
decision with consequences: the caller must pass the array position, so they
cannot easily render options out of order or from a nested structure without
recomputing indices themselves.

## Interview questions

**Why are these getters rather than plain props objects?**
Because the caller needs their own `onClick` and `onKeyDown` on the same elements.
A spread cannot merge handlers — one silently replaces the other — so the getter
takes the caller's props as an argument and composes them.

**Why must `aria-selected` be `false` rather than omitted on unselected
options?**
Absent means "not selectable"; `false` means "selectable, not currently
selected". They are different claims about the option and screen readers announce
them differently.

**How is the "exactly one `tabIndex={0}`" invariant enforced?**
It is computed from `activeIndex` inside the getter, so it cannot drift. Nothing
the caller does can produce two focusable options.

**What decides whether one of the hook's props sits above or below `...rest`?**
Above means the caller can override it — a default. Below means they cannot — an
invariant. Here `role`, `id`, `tabIndex` and `aria-selected` are above, which is
deliberate but arguable; putting the ARIA state below would stop a caller
breaking the widget at the cost of an escape hatch.

**Why does `mergeRefs` matter here specifically?**
The hook needs every option node for imperative `.focus()`, and the caller may
want a ref on the same element. One element takes one `ref`, so without a merge
one of the two silently loses.

**What does the caller still have to get right themselves?**
The accessible name — `aria-label` or `aria-labelledby` — which the spec requires
and the hook cannot invent. Plus `aria-multiselectable` and `aria-orientation`
where they apply, neither of which this version implements.

**Why does clicking an option also set `activeIndex`?**
So mouse and keyboard agree. Otherwise a click selects one option while keyboard
focus remains elsewhere, and the next arrow key moves from a position the user
does not believe they are in.

**What breaks first if the list can be reordered?**
Both the refs and the option ids, because both are keyed by array index rather
than by a stable identity.

**Is the container focusable?**
No, and with roving `tabindex` it should not be — focus belongs on an option. The
consequence is that an empty list has nothing to focus and becomes unreachable by
keyboard, so the empty state needs deliberate handling.

---

← Prev: [03 · Building it](03-building-it.md) · Index: [Headless components](README.md) · Next → [05 · The delivery shapes](05-the-delivery-shapes.md)
