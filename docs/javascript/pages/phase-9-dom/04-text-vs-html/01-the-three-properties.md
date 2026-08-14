---
title: "04.1 · The three properties"
sidebar_label: "01 · The three properties"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`HTMLElement.innerText`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText), [`Node.textContent`](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent), [`Element.innerHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML). Documentation-validated.

**Three properties that look interchangeable and are not.** One is a security boundary, one
is a performance trap, and one is the default you should reach for.

| | Parses HTML? | Sees hidden text? | Costs layout? |
|---|---|---|---|
| **`textContent`** | **no** — text in, text out | **yes** — including `<script>`, `<style>` | no |
| **`innerText`** | no | **no** — rendered text only | **yes** |
| **`innerHTML`** | **yes** — injection sink | n/a | on write |

## `textContent` — the default

Reading gives you all text in the subtree; writing replaces the subtree with a single text
node. **Nothing is parsed in either direction**, which is exactly what makes it safe:

```js
el.textContent = userInput;      // ✅ always text, even if it contains <script>
```

🔴 **`textContent` is the fix for most XSS.** If the value is text — a username, a comment, a
number — this property cannot inject markup, no matter what the string contains. That is a
property of the API, not of your escaping.

It is also the fastest of the three, because no parser and no layout is involved.

## `innerText` — rendered text, and a reflow

MDN:

> "**`innerText` is easily confused with `Node.textContent`, but there are important
> differences between the two. Basically, `innerText` is aware of the rendered appearance of
> text, while `textContent` is not.**"

> `innerText` "represents the **rendered text content** of a node and its descendants… it
> approximates the text the user would get if they highlighted the contents of the element
> with the cursor and then copied it to the clipboard."

Concretely, and all from MDN's comparison:

- **`innerText` is aware of `<br>`** and returns line breaks where the user sees them.
- **`innerText` ignores hidden elements** — `display: none` content is not in the result.
- **`innerText` respects CSS**, since it reflects rendered appearance.
- **`textContent` returns all text**, including inside `<script>` and `<style>` and inside
  hidden elements.

🔴 **"Aware of the rendered appearance" means the browser must know the layout, so reading
`innerText` can force a reflow.** That makes it a real cost inside a loop, and the reason
`textContent` is the right default even when both would return the same string.

Use `innerText` deliberately, when you want *what the user sees*: copying visible text,
snapshotting a rendered value, reading a field that may contain hidden helper markup.
Otherwise use `textContent`.

Writing has its own documented behaviour, and MDN flags it as a warning:

> "Setting `innerText` on a node removes **all** of the node's children and replaces them with
> a single text node with the given string value."

…and:

> "When setting, `innerText` converts any line breaks into `<br>` elements."

**That second one is a genuine difference from `textContent`.** `el.textContent = "a\nb"`
stores a literal newline (which HTML collapses to a space when rendering);
`el.innerText = "a\nb"` inserts a real `<br>`. If you want a visible line break from a string,
`innerText` does it — and it is the only one of the three that quietly creates an element.

## `innerHTML` — the injection sink

Reading serialises the subtree back to a markup string; writing **parses** the string and
replaces the subtree with the result. That parse is the whole problem.

```js
el.innerHTML = userInput;        // ⚠️ markup is parsed and inserted
```

Two things are commonly misunderstood about the risk:

**1. `<script>` inserted via `innerHTML` does not execute** — the HTML parser does not run
scripts inserted this way. **This does not make it safe**, because plenty of markup runs code
without a `<script>` tag:

```html
<img src=x onerror="steal()">
<svg onload="steal()">
<iframe src="javascript:steal()">
```

An `onerror` on a broken image is the canonical payload precisely because it needs no script
tag and looks harmless. **"It strips scripts" is the most dangerous half-truth in frontend
security.**

**2. Escaping by hand does not work.** Replacing `<` and `>` misses attribute contexts,
unquoted attributes, URL contexts, and every parser quirk the sanitiser authors have spent
years on. Full treatment in [06 · Sanitising HTML](../README.md).

### Two more reasons to avoid it

Beyond security, from [03 · 01](../03-creating-and-inserting/01-building-and-placing.md):
**writing `innerHTML` destroys and rebuilds the subtree**, so every event listener on those
children is lost, along with property-only state like `checked`, focus and scroll position.
And reading it is not free either — the browser serialises the whole subtree to a string.

## Choosing

```js
el.textContent = value;                      // ✅ text — the default
el.innerText;                                 // reading what the user sees (costs layout)
el.append(node);                              // adding a built element
el.insertAdjacentHTML("beforeend", trusted);  // markup, from a source you control
el.innerHTML = sanitize(untrusted);           // markup from users — sanitiser required
```

**The rule: if the value is text, use `textContent`.** Reach for markup-parsing APIs only when
you genuinely have markup, and only when you can say where it came from.

## Gotchas

**Symptom:** User input containing `<b>` shows the tags instead of bold text
**Cause:** `textContent` does not parse — correct and intended.
**Fix:** Expected. If you truly need markup, sanitise it; do not switch to `innerHTML` to
"fix" the display.

**Symptom:** `textContent` returns CSS or script source
**Cause:** MDN: `textContent` *"returns all text"*, including inside `<script>` and `<style>`.
**Fix:** Use `innerText` if you want only rendered text, or scope the query more tightly.

**Symptom:** `textContent` includes text the user cannot see
**Cause:** It ignores rendering, so `display: none` content is included.
**Fix:** `innerText`, which *"ignores hidden elements"* — accepting the layout cost.

**Symptom:** Reading text in a loop is slow
**Cause:** `innerText` is *"aware of the rendered appearance"*, so reading it can force a
reflow.
**Fix:** `textContent` unless you specifically need the rendered form.

**Symptom:** A `\n` shows as a space with `textContent` but a line break with `innerText`
**Cause:** MDN: *"When setting, `innerText` converts any line breaks into `<br>` elements."*
**Fix:** Expected — and note `innerText` is the only one of the three that creates an element
from a plain string.

**Symptom:** Someone argues `innerHTML` is safe because scripts do not run
**Cause:** True and irrelevant — `<img src=x onerror=…>` and `<svg onload=…>` need no script
tag.
**Fix:** Sanitise, or do not parse untrusted markup at all.

**Symptom:** Listeners and checkbox state disappear after setting `innerHTML`
**Cause:** The write replaces the whole subtree.
**Fix:** `append`, `insertAdjacentHTML`, or `replaceChildren` with built nodes.

## Interview questions

**★ What is the difference between `textContent` and `innerText`?**
MDN: *"`innerText` is aware of the rendered appearance of text, while `textContent` is
not."* `innerText` skips hidden elements, honours `<br>`, and reflects CSS — but because it
needs layout, **reading it can force a reflow**. `textContent` returns all text including
`<script>` and `<style>` contents, and is faster.

**★ Which should be your default, and why?**
`textContent`. It does not parse, so it cannot inject markup; it does not need layout, so it
is cheap. Use `innerText` only when you specifically want what the user sees.

**★ Is `innerHTML` safe because inserted `<script>` tags do not run?**
No. That is true and irrelevant — `<img src=x onerror="…">`, `<svg onload="…">` and
`javascript:` URLs all execute without a script tag. It is the most dangerous half-truth in
frontend security.

**★ What does setting `innerText` do that `textContent` does not?**
MDN: it *"converts any line breaks into `<br>` elements"* — so it is the only one of the three
that creates an element from a plain string. Both replace all children with the given content.

**★ Name two non-security reasons to avoid `innerHTML`.**
Writing destroys and rebuilds the subtree, losing every event listener and all property-only
state (`checked`, focus, scroll). Reading serialises the entire subtree to a string.

**When is `innerText` the right choice?**
When you want the text a user would get by selecting and copying — a rendered snapshot, or a
field containing hidden helper markup. Accept that it costs layout.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
