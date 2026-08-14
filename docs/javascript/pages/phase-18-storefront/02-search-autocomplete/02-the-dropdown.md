---
title: "02.2 · The dropdown"
sidebar_label: "02 · The dropdown"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`aria-activedescendant`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-activedescendant), [`aria-expanded`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded), [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live), [`KeyboardEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key), [`Element.scrollIntoView()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView), [`Element: focusout` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focusout_event). Documentation-validated; **no timings**.

**The network half is solved; the interface half is where autocomplete is actually judged.** A
dropdown that cannot be driven from the keyboard is unusable for a large group of people and
irritating for everyone who does not want to reach for the mouse.

## Keyboard is the specification

| Key | Behaviour |
|---|---|
| `ArrowDown` | move to the next option; from the input, open and select the first |
| `ArrowUp` | previous; from the first option, return **to the input** |
| `Enter` | commit the highlighted option, or submit the raw term if none is highlighted |
| `Escape` | close the list, keep the text; press again to clear the text |
| `Tab` | close and move on — 🔴 **do not** commit the highlight |
| `Home`/`End` | first/last option |

🔴 **`Tab` must not select.** A user tabbing past the field expects to move on, not to have their
input replaced by whatever happened to be highlighted. `Enter` commits; `Tab` leaves.

⚠️ **Highlight is not focus.** Focus must **stay in the input** the entire time — otherwise typing
stops working. The highlight is a visual and ARIA state on an option, not DOM focus, which is
exactly what `aria-activedescendant` is for.

```js
input.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowDown": e.preventDefault(); move(+1); break;   // 🔴 preventDefault
    case "ArrowUp":   e.preventDefault(); move(-1); break;
    case "Enter":     if (active >= 0) { e.preventDefault(); commit(options[active]); } break;
    case "Escape":    if (isOpen) { close(); } else { input.value = ""; } break;
  }
});
```

**`preventDefault` on the arrows** stops the caret jumping to the start or end of the input while
navigating the list — a small thing that feels broken immediately.

## The ARIA wiring

```html
<input
  role="combobox"
  aria-expanded="true"
  aria-controls="search-listbox"
  aria-activedescendant="option-3"
  aria-autocomplete="list"
  autocomplete="off"
/>
<ul id="search-listbox" role="listbox">
  <li id="option-3" role="option" aria-selected="true">Blue running shoe</li>
</ul>
```

- **`aria-expanded`** must track the open state — a screen reader announces "collapsed"/"expanded"
  from it.
- 🔴 **`aria-activedescendant`** points at the highlighted option's id while focus stays in the
  input. This is the mechanism that makes "focus stays put, highlight moves" possible.
- **`aria-selected="true"`** on the highlighted option, and only one at a time.
- ⚠️ **`autocomplete="off"`** stops the browser's own suggestion list covering yours. It is
  frequently forgotten and the result is two dropdowns.

**Announce the result count** in a polite live region: *"8 suggestions available"*. Without it a
screen-reader user gets no signal that anything appeared
([01 · 02 · Rendering and the request](../01-product-grid/02-rendering-and-the-request.md)).

## Mouse, touch and the blur trap

🔴 **The classic bug: clicking an option closes the list before the click registers.** `blur` fires
before `click`, so a `blur` handler that hides the list removes the element mid-click and the
selection never happens.

Three fixes, in order of quality:

1. **`mousedown` with `preventDefault`** on the option — the input never loses focus, so `blur`
   never fires. **This is the correct fix.**
2. **`focusout` with a `relatedTarget` check** — close only if focus moved outside the whole
   widget.
3. ⚠️ **A `setTimeout` before closing** — the common hack. It works by racing, and it is fragile:
   too short and it still fails, too long and the list lingers.

```js
listbox.addEventListener("mousedown", (e) => e.preventDefault());   // keep focus in the input
listbox.addEventListener("click", (e) => {
  const option = e.target.closest("[role='option']");
  if (option) commit(option.dataset.value);
});
```

⚠️ **`scrollIntoView({ block: "nearest" })`** when the highlight moves, so keyboard navigation does
not walk off the bottom of a scrollable list. `block: "nearest"` avoids scrolling when the option
is already visible, which `"center"` does not.

## Rendering the suggestions

🔴 **Never `innerHTML` a search result.** The term is user input and the results come from a server
that may echo user-generated content — this is the injection sink from
[Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md). For highlighting
the matched substring, build the elements:

```js
function highlight(text, term) {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  const frag = document.createDocumentFragment();
  if (i === -1) { frag.append(text); return frag; }

  frag.append(text.slice(0, i));
  const mark = document.createElement("mark");
  mark.textContent = text.slice(i, i + term.length);          // 🔴 textContent
  frag.append(mark, text.slice(i + term.length));
  return frag;
}
```

⚠️ **Highlighting by `replace` with `<mark>` tags and `innerHTML` is the standard version of this
bug**, and it is doubly wrong: it is an XSS sink, and a term containing regex metacharacters
(`.`, `*`, `(`) breaks or hangs the replace.

## Caching, briefly

**A small `Map` from term to results removes most of the repeat traffic** — users backspace
constantly, and every backspace is a term already searched.

```js
const cache = new Map();
if (cache.has(term)) return renderResults(term, cache.get(term));
```

⚠️ **Bound it and give it a lifetime.** An unbounded cache is a leak, and stale results in a search
box are visible — a product that no longer exists still appearing is worse than a slower search.
Cap it at a few dozen entries and clear it on navigation.

## Gotchas

**Symptom:** Clicking a suggestion does nothing
**Cause:** `blur` fires before `click` and the list is already hidden.
**Fix:** `preventDefault` on the option's `mousedown`, keeping focus in the input.

**Symptom:** Arrow keys move the text caret instead of the highlight
**Cause:** No `preventDefault` on the arrow keydown.
**Fix:** Prevent the default for `ArrowUp`/`ArrowDown`.

**Symptom:** Typing stops working after arrowing into the list
**Cause:** DOM focus was moved to the option.
**Fix:** Keep focus in the input; use `aria-activedescendant` for the highlight.

**Symptom:** Tabbing away replaces the typed text
**Cause:** `Tab` treated as a commit.
**Fix:** Only `Enter` commits.

**Symptom:** Two dropdowns appear
**Cause:** The browser's own autofill list.
**Fix:** `autocomplete="off"` on the input.

**Symptom:** Screen-reader users get no signal that suggestions appeared
**Cause:** No `aria-expanded` and no live region.
**Fix:** Both, with a polite result count.

**Symptom:** Keyboard navigation scrolls past the visible list
**Cause:** No `scrollIntoView` on highlight change.
**Fix:** `scrollIntoView({ block: "nearest" })`.

**Symptom:** A search for `a.*b` hangs or breaks the highlight
**Cause:** The term was used as a regex.
**Fix:** `indexOf` and DOM nodes, not `replace` + `innerHTML`.

**Symptom:** A suggestion renders as markup
**Cause:** `innerHTML` on server-provided text.
**Fix:** `textContent` and built elements.

**Symptom:** Deleted products keep appearing
**Cause:** An unbounded, un-expiring result cache.
**Fix:** Bound it and clear it on navigation.

## Interview questions

**★ Why does clicking a suggestion sometimes do nothing?**
`blur` fires before `click`, so a blur handler that closes the list removes the element mid-click.
The correct fix is `preventDefault` on the option's `mousedown`, so the input never loses focus at
all — a `setTimeout` before closing is the common hack and it works by racing.

**★ Where does focus live while the user arrows through suggestions?**
**In the input, the whole time.** Moving DOM focus to an option breaks typing. The highlight is
communicated with `aria-activedescendant` pointing at the option's id, plus `aria-selected` on the
option.

**★ Should `Tab` select the highlighted suggestion?**
No. `Enter` commits; `Tab` closes and moves on. A user tabbing past the field does not expect their
text replaced.

**★ How do you highlight the matched substring safely?**
Find the index with `indexOf` and build text nodes plus a `<mark>` with `textContent`. Using
`replace` with `<mark>` tags and `innerHTML` is an XSS sink **and** breaks on regex metacharacters
in the term.

**★ What ARIA does a combobox need?**
`role="combobox"` with `aria-expanded` tracking the open state, `aria-controls` pointing at the
listbox, `aria-activedescendant` for the highlight, `role="option"`/`aria-selected` on the items —
and `autocomplete="off"` so the browser's own list does not cover yours.

**★ Is caching search results worth it?**
Yes — users backspace constantly and every backspace repeats a term. But bound it and expire it: an
unbounded cache is a leak, and a deleted product still appearing is worse than a slightly slower
search.

**Why `scrollIntoView({ block: "nearest" })`?**
So the highlighted option is brought into view only when it is not already visible. `"center"`
scrolls on every move, which is disorienting.

---

← [01 · The three bugs](./01-the-three-bugs.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
