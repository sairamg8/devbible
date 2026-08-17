---
title: "The contract you are inheriting"
sidebar_label: "02 · The contract you are inheriting"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against the W3C
> [ARIA Authoring Practices Guide — Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/),
> **fetched on that date**; every quoted binding below is from that page, not from
> memory. React APIs from react.dev
> [`useId`](https://react.dev/reference/react/useId) and
> [`useRef`](https://react.dev/reference/react/useRef).
> ⚠️ The APG is a set of **authoring practices**, not a normative standard — it
> says what works, not what is legally required. Where it marks something
> optional, this page says so.
> No sandbox script backs this page; claims are cited, not measured.

**This chunk exists because the previous version of this topic argued that
headless components encapsulate a hard contract and then never showed the
contract. Here it is.**

One widget. A listbox — a scrolling list you pick from. Not a combobox, not a
menu, not a date picker, all of which are harder.

## The keyboard bindings

Quoted from the APG listbox pattern.

### Focus on entry

| Situation | Required behaviour |
|---|---|
| Single-select, nothing pre-selected | *"the first option receives focus. Optionally, the first option may be automatically selected."* |
| Single-select, something pre-selected | focus moves to the selected option |
| Multi-select, nothing pre-selected | *"focus is set on the first option and there is no automatic change in the selection state"* |
| Multi-select, something pre-selected | focus goes to the **first** selected option |

Four cases before a key has been pressed.

### Navigation

| Key | Behaviour |
|---|---|
| **Down Arrow** | *"Moves focus to the next option. Optionally, in a single-select listbox, selection may also move with focus."* |
| **Up Arrow** | *"Moves focus to the previous option. Optionally, in a single-select listbox, selection may also move with focus."* |
| **Home** | Moves to first option. Optional, but *"strongly recommended for lists exceeding five options"* |
| **End** | Moves to last option. Same recommendation |

### Type-ahead

Recommended for all listboxes, and especially those with seven or more options.
Two behaviours, distinguished only by timing:

- a **single character** advances to the next item starting with that character;
- **rapid multi-character** input advances to the item matching the accumulated
  string.

So "b, r, o" typed quickly means *Broccoli*, and "b, b, b" typed slowly means
*cycle through the b's*. Same keys, different result, decided by a timer.

### Multi-select — and there are two competing models

The APG documents **two**, and you must pick one.

**Recommended model — no modifier keys required:**

| Key | Behaviour |
|---|---|
| **Space** | toggles the focused option's selection state |
| Shift + Down Arrow | *(optional)* moves focus and toggles the next option |
| Shift + Up Arrow | *(optional)* moves focus and toggles the previous option |
| Shift + Space | *(optional)* selects contiguous items from the most recent to the focused |
| Control + Shift + Home | *(optional)* selects focused and all options up to the first |
| Control + Shift + End | *(optional)* selects focused and all options down to the last |
| Control + A | *(optional)* selects or unselects all |

**Alternative model — modifier keys required:**

| Key | Behaviour |
|---|---|
| Shift + Down / Up Arrow | moves focus and toggles that option |
| **Control + Down / Up Arrow** | moves focus **without** changing selection |
| **Control + Space** | toggles the focused option |
| Shift + Space, Control+Shift+Home/End, Control+A | as above |

Note what differs: in the recommended model plain `Space` toggles; in the
alternative it is `Control + Space`, and plain arrows change selection while
`Control` + arrows do not. **Mixing the two produces a widget that behaves like
neither**, which is the most common outcome of implementing this from memory.

## The ARIA requirements

### On the container

- role **`listbox`**.
- A visible label via **`aria-labelledby`**, or **`aria-label`** — unless it is
  part of another widget.
- **`aria-multiselectable="true"`** if multi-select.
- **`aria-orientation="horizontal"`** if horizontal; vertical is the default.

### On each option

- role **`option`**.
- Must be contained in — or owned by — the `listbox`, or a `group` inside it.
- Selection state via **either `aria-selected` or `aria-checked`**, *"not both,
  except in rare cases"*.
- Selected options carry `="true"`; **unselected but selectable options must
  carry `="false"`**, not be omitted. Omission means "not selectable", which is a
  different statement.

### Grouping and virtualisation

- Grouped options use role **`group`**, and *"each group requires accessible name
  via `aria-label` or `aria-labelledby`"*.
- If options load dynamically, set **`aria-setsize`** and **`aria-posinset`** —
  otherwise a screen reader announces "item 3 of 20" when there are 5,000.

## Count it

Four entry cases · four navigation keys · two type-ahead behaviours · one of two
multi-select models with up to seven bindings · four container attributes · four
option-level rules · two virtualisation attributes.

**That is roughly thirty requirements, for the second-simplest widget in the
guide.** A combobox adds a text input, its own `aria-expanded`, `aria-controls`,
`aria-autocomplete`, and a popup whose focus model differs again.

This is the argument for headless components, stated as a quantity rather than a
feeling: **no team implements thirty requirements correctly by hand, and no team
implements them correctly twice.**

## The one decision the spec does not make for you

The bindings above say "moves focus to the next option". There are **two
different ways to satisfy that**, and the choice changes your entire
implementation.

### Roving `tabindex`

Real DOM focus moves. Exactly one option has `tabIndex={0}`; every other has
`tabIndex={-1}`. On arrow-down you update which one, and imperatively `.focus()`
it.

- ✅ `document.activeElement` is genuinely the option, so `:focus` and
  `:focus-visible` work, and browser find-in-page behaves.
- ✅ Nothing to keep in sync — the DOM is the source of truth.
- ⚠️ Requires a ref per option and an imperative call, so you need refs the
  caller cannot forget to attach.
- ⚠️ Moving focus scrolls the element into view automatically, which you
  sometimes do not want.

### `aria-activedescendant`

DOM focus stays on the container. The container carries
`aria-activedescendant={activeOptionId}`, and assistive technology announces that
option as if it were focused.

- ✅ One focus target; no per-option refs required for focus itself.
- ✅ Keeps focus on an `<input>` — which is why comboboxes essentially must use
  it.
- ⚠️ `:focus` never matches the active option, so **you must style the active
  state yourself** and it will not follow the user's OS focus settings.
- ⚠️ Scroll-into-view is now **your** job entirely.
- ⚠️ Historically the weaker-supported of the two.

*(Judgement, not spec: use roving `tabindex` for a standalone listbox and
`aria-activedescendant` when focus must remain in a text input. Chunk 03 builds
the roving version, because it is the one whose failure modes are instructive.)*

## Gotchas

**"Optional" in the APG does not mean "skip it".** `Home`/`End` are optional and
*strongly recommended* past five options. Shipping a 200-item list without them
is technically conformant and practically unusable.

**Omitting `aria-selected="false"` is not the same as leaving it out.** Present
and `false` means "selectable, not currently selected". Absent means "not
selectable at all". Screen readers announce these differently.

**Both `aria-selected` and `aria-checked` on the same option is a spec
violation**, not a belt-and-braces improvement.

**`aria-setsize`/`aria-posinset` are mandatory the moment you virtualise.**
Windowing a list renders 20 of 5,000 nodes, and without those attributes the
widget lies about its own size to every assistive-technology user.

**A `<div role="listbox">` is not focusable by default.** Roles do not confer
focusability; you still need `tabIndex`.

**Type-ahead must not swallow keys the page needs.** Buffering every printable
character means intercepting `/` and `?`, which many apps bind to search and
help. Scope it, and let modifier-key combinations through.

**Arrow keys inside a listbox must call `preventDefault()`**, or the page scrolls
underneath the widget as the user navigates.

**The two multi-select models are not compatible.** Pick one and document which.
A widget where plain `Space` toggles *and* `Control` + arrow moves focus without
selecting is a hybrid nobody's muscle memory fits.

**The spec is per-widget, not general.** Arrow keys move *focus* in a listbox but
move *selection* in a radio group, and `Enter` activates in a menu but submits in
a form. Copying a keyboard handler between widgets is how you get a widget that
feels almost right.

## Interview questions

**Why is a listbox a good illustration of what headless encapsulates?**
Because a plain list you click is trivial and the specified widget is not — about
thirty requirements across focus-on-entry, navigation, type-ahead, an optional
multi-select model, and ARIA state that has to track selection exactly.

**What are the two ways to satisfy "move focus to the next option"?**
Roving `tabindex`, where real DOM focus moves and one option at a time has
`tabIndex={0}`; and `aria-activedescendant`, where focus stays on the container
and an attribute names the active option.

**When must you use `aria-activedescendant`?**
When focus has to remain somewhere else — most importantly a combobox's text
input, where moving DOM focus into the list would stop the user typing.

**What do you give up by choosing it?**
`:focus` and `:focus-visible` no longer match the active option, so you style the
active state manually, and scroll-into-view becomes your responsibility.

**Why does `aria-selected="false"` have to be present?**
Because absent means "not selectable" while `false` means "selectable, currently
unselected". They are different statements about the option.

**What breaks if you virtualise a long list without `aria-setsize`?**
The widget reports the number of *rendered* nodes rather than the real total, so
a 5,000-item list announces itself as 20 items and position information is wrong.

**Describe the type-ahead behaviour precisely.**
A single character moves to the next option starting with it. Characters typed in
quick succession accumulate into a string and match against it. The only thing
distinguishing the two is inter-keystroke timing.

**Why can't you copy a keyboard handler from one widget to another?**
The bindings are specified per pattern. Arrow keys move focus in a listbox and
selection in a radio group; `Enter` means different things in a menu and a form.
The keys look the same and the contracts are not.

**Is the APG normative?**
No — it documents authoring practices that are known to work, and it marks some
behaviours optional. It is the best available specification of user expectation,
not a conformance requirement.

---

← Prev: [01 · What headless actually means](01-what-headless-means.md) · Index: [Headless components](README.md) · Next → [03 · Building it](03-building-it.md)
