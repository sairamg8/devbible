---
title: "04 · Live regions"
sidebar_label: "04 · Live regions"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions), [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live), [`aria-atomic`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-atomic), [`aria-relevant`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-relevant), [`role="alert"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/alert_role). Documentation-validated; **no timings**.

When you update part of the page without moving focus — a search result count, a toast, a "saved"
confirmation, a validation error — a screen reader user gets **nothing**. They are somewhere else
in the document and nothing told them anything happened. A live region is how you tell them.

## The rule that breaks most implementations

🔴 **The live region container must already exist in the DOM before the content changes.** Inject
the container and its text together and assistive technology reliably announces nothing — it only
watches regions it already knew about.

```html
<!-- ✅ ships with the page, empty -->
<div id="status" role="status" aria-live="polite"></div>
```

```js
// ✅ later, change the text inside the region that was already there
document.getElementById('status').textContent = `${count} results`;

// ❌ the region and its content arrive together — usually silent
document.body.insertAdjacentHTML('beforeend',
  '<div role="status" aria-live="polite">3 results</div>');
```

This is why a toast system creates its **container** at startup and only ever appends messages into
it.

## `aria-live` — the three values

| Value | Behaviour |
|---|---|
| `polite` | announced when the user is idle — **the default choice** |
| `assertive` | **interrupts** whatever is being spoken |
| `off` | announced only when focus is inside the region |

- **`polite`** for search results, filter counts, "Saved", upload progress, a chat message
  arriving. Almost everything.
- **`assertive`** only when the message must not wait: a session about to expire, a payment
  failure, data loss. It cuts the user off mid-sentence, and a page that does it for routine
  updates is unusable.
- **`off`** is not "never announce" — it is "only when focus is in here". MDN notes it is the
  implicit value for `role="marquee"` and `role="timer"`.

## Roles that are live regions already

| Role | Implicit | Use for |
|---|---|---|
| `role="status"` | `aria-live="polite"`, `aria-atomic="true"` | status messages, counts, "Saved" |
| `role="alert"` | `aria-live="assertive"` | errors and warnings that must interrupt |
| `role="log"` | `aria-live="polite"` | chat, console, event logs |
| `role="progressbar"` | — (with `aria-valuenow` etc.) | progress |
| `role="timer"` | `aria-live="off"` | countdowns |
| `role="marquee"` | `aria-live="off"` | tickers |

MDN recommends adding a **redundant** `aria-live` to `role="status"` and `role="log"` for
compatibility across screen readers — belt and braces, and harmless.

⚠️ **`role="alert"` plus `aria-live="assertive"` double-speaks in VoiceOver on iOS**, per MDN. Pick
one: the role, or the attribute.

`role="alert"` is also the exception to the pre-exist rule — its content may be announced even when
the alert element is injected dynamically. It is still safer to keep a permanent container.

## `aria-atomic` — announce the whole region, or just what changed

Default is `false`: only the changed part is announced. That is right for a chat log and wrong for
almost everything with surrounding words.

```html
<!-- without aria-atomic, 17:33 → 17:34 announces just "34" -->
<div id="clock" role="timer" aria-live="polite" aria-atomic="true">
  <span id="hours">17</span>:<span id="mins">34</span>
</div>

<div id="year-out" aria-live="polite" aria-atomic="true">
  The set year is: <span id="year">1990</span>
</div>
<!-- announces "The set year is: 2024" instead of a bare "2024" -->
```

**Rule of thumb:** if the region contains fixed words that give the changing value its meaning, set
`aria-atomic="true"`. If it is a list of independent entries, leave it `false` so only the new
entry is read.

## `aria-relevant` — which changes count

Defaults to `"additions text"`, so **removals are silent**. For a roster or a list of active
filters, that is a bug:

```html
<ul id="roster" aria-live="polite" aria-relevant="additions removals">
  <!-- users joining and leaving are both announced -->
</ul>
```

Values are `additions`, `removals`, `text` and `all`. MDN notes support for `aria-relevant` and
`aria-atomic` varies between screen readers, so treat them as improvements rather than guarantees
— and never make understanding the page *depend* on one.

## Making an announcement actually fire

A live region only announces when its content **changes**. Setting the same string twice produces
one announcement, which is why "Error: check the form" is silent the second time the user submits
the same broken form.

```js
const status = document.getElementById('status');

function announce(message) {
  status.textContent = '';                  // clear first
  // a separate task, so the two writes are not coalesced into one mutation
  setTimeout(() => { status.textContent = message; }, 50);
}
```

The clear-then-set is the documented workaround shape; note that both writes must not land in the
same batch, which is why this is one of the few places a small `setTimeout` earns its keep.

`aria-busy="true"` is the opposite control — set it while you are making several related changes,
and clear it when you are done, so the region is announced once instead of per mutation.

## Where a live region is the wrong answer

- **The change is where the user already is** — they typed into the field, they will hear the
  result. Do not narrate every keystroke.
- **A modal or a new view opened** — that is a focus move, not an announcement. Send focus in
  ([02 · Managing focus](./02-managing-focus.md)).
- **A field's own error** — associate it with `aria-describedby` and the constraint-validation API
  from [09 · Forms](../09-forms/02-constraint-validation.md), so the message is read as part of the
  field. A live region on top of that reads it twice.

**The trade-off:** live regions are the only way to announce a change that does not move focus, and
they are also the easiest way to make a page chatter constantly. Announce what a sighted user would
*notice*, not everything that changed.

## Gotchas

**Symptom: the live region never announces anything.**
Cause — the container was injected together with its content.
Fix — ship the empty container in the initial HTML and only change its text afterwards.

**Symptom: the same error is announced the first time and never again.**
Cause — the text is unchanged, so there is no mutation to announce.
Fix — clear the region, then set it in a later task.

**Symptom: only the number is announced, without the words around it.**
Cause — `aria-atomic` defaults to `false`, so only the changed node is read.
Fix — `aria-atomic="true"` on the region.

**Symptom: items disappearing from a list are never announced.**
Cause — `aria-relevant` defaults to `"additions text"`.
Fix — `aria-relevant="additions removals"`.

**Symptom: the screen reader talks over itself constantly.**
Cause — `assertive` used for routine updates, or a region updated on every keystroke.
Fix — `polite`, debounce the update, and set `aria-busy` around multi-step changes.

**Symptom: VoiceOver on iOS reads an alert twice.**
Cause — `role="alert"` combined with `aria-live="assertive"`.
Fix — use one of them, not both.

**Symptom: the validation message is read twice.**
Cause — it is both a live region and referenced by `aria-describedby` on the focused field.
Fix — pick one route; for per-field errors, `aria-describedby` is usually the better one.

## Interview questions

**★ Why does a dynamically created live region often announce nothing?**
Assistive technology only monitors regions it already knows about. The container must exist in the
DOM before the content changes — create it empty at page load and write into it later.

**★ When would you use `assertive` rather than `polite`?**
Only when the message cannot wait — a session expiring, a failed payment, imminent data loss.
`assertive` interrupts whatever is being spoken; using it for routine updates makes a page
unusable.

**★ What does `aria-atomic="true"` do?**
It makes the whole region be announced on any change, not just the changed node — so
"The set year is: 2024" instead of a context-free "2024". Use it whenever fixed surrounding words
give the value meaning.

**★ Why are removals from a list not announced?**
`aria-relevant` defaults to `"additions text"`. Add `removals` for rosters, filter chips and
anything where a disappearance is the news.

**★ How do you announce the same message twice?**
Clear the region and set the text again in a later task. Identical content is not a change, so it
produces no announcement.

**What is the difference between `role="status"` and `role="alert"`?**
`status` is implicitly polite and atomic — for confirmations and counts. `alert` is implicitly
assertive and interrupts — for errors. Do not add `aria-live="assertive"` on top of `alert`; on iOS
VoiceOver the combination double-speaks.

**When is a live region the wrong tool?**
When focus should move instead — a dialog opening, a new view — or when a field's own error can be
associated with `aria-describedby`. Live regions are for changes that do not move focus.

---

← [03 · ARIA from JavaScript](./03-aria-from-javascript.md) · [Topic index](./README.md) ·
**16 · `<dialog>`, the popover API and `inert`** *(not written yet)* →
