---
title: "01 · The clipboard"
sidebar_label: "01 · The clipboard"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API), [`Clipboard.writeText()`](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText), [`Clipboard.read()`](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/read), [`ClipboardItem`](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardItem), [`Element: paste` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event), [`DataTransfer`](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer), [Transient activation](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation). Documentation-validated; **no timings and no console output**.

Copying used to mean a hidden `<textarea>`, `select()`, and `document.execCommand('copy')` — a hack
that worked because it was indistinguishable from the user doing it by hand. `navigator.clipboard`
replaced it with a real, promise-based API, and MDN is explicit that it is the one to prefer over
the deprecated `execCommand`.

## Copying: the 90% case

```js
button.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl);
    setLabel('Copied');
  } catch {
    setLabel('Press Ctrl+C to copy');     // 🔴 always have this branch
  }
});
```

Three rules make the difference between this working and this being a support ticket:

- **Secure context only.** `navigator.clipboard` is undefined on plain `http://` — which is why
  "it works locally and not on the staging box" is a clipboard classic (`localhost` counts as
  secure; a LAN IP does not).
- 🔴 **Inside a user gesture.** Writing needs [transient activation](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation)
  — a click or key press the browser is still counting as "just now". A copy fired from a
  `setTimeout`, a `fetch().then()` or on page load is rejected.
- **It can reject, and rejection is normal.** `NotAllowedError` from a lost gesture or a denied
  permission is a UI state, not an exception to log and forget.

⚠️ **The browsers differ here, deliberately.** As MDN describes them: Chromium wants the
`clipboard-write` permission *or* transient activation, and remembers the permission once granted;
Firefox and Safari want transient activation and nothing else. Do not code against one browser's
permission model — code against the gesture, which all of them accept.

## Rich content: `ClipboardItem`

`writeText` covers links, codes and tokens. Anything else — an image, HTML with formatting, several
representations of the same thing — is a `ClipboardItem`, whose keys are MIME types and whose
values are strings or `Blob`s.

```js
const item = new ClipboardItem({
  'text/plain': 'Q3 revenue: 4,200',                  // what a plain editor gets
  'text/html':  '<table><tr><td>Q3 revenue</td><td>4,200</td></tr></table>',
});
await navigator.clipboard.write([item]);
```

🔴 **Write every representation you can, in one item.** The receiving application picks; a
spreadsheet takes the HTML table, a terminal takes the plain text. Writing only `text/html` means
pasting into a plain-text field gets nothing useful, and that is the most common rich-copy bug.

```js
if (ClipboardItem.supports('image/svg+xml')) { /* … */ }
```

`ClipboardItem.supports()` is the registry check — the same shape as `CSS.supports` and
`navigator.canShare` ([12 · Feature detection](../12-feature-detection/README.md)): ask the
platform rather than maintaining a browser list. `image/png` is the format to assume works;
anything else is worth checking.

⚠️ **Prepare the data before the click, not after.** Anything you `await` between the gesture and
the `write()` call risks spending the transient activation. Fetch or render the blob first, then
copy on the click.

## Reading, and why it is the hard direction

```js
const items = await navigator.clipboard.read();
for (const item of items) {
  if (item.types.includes('image/png')) {
    const blob = await item.getType('image/png');     // 🔴 getType returns a Blob
    upload(blob);
  }
}
```

Reading is a **privacy boundary**: the clipboard may hold a password, an address, a one-time code
from another site. So the platform gates it far harder than writing, and the gating is not uniform.
MDN describes reading as requiring transient activation, with Chromium requesting the
`clipboard-read` permission when the document has focus, and Firefox and Safari instead showing a
small "Paste" context menu that the user must click — with the button enabled after about a second,
so it cannot be clickjacked.

🔴 **The consequence: there is no reliable "read the clipboard" button.** Design for the user
pasting, and treat `read()`/`readText()` as an enhancement on top.

## `paste`, `copy`, `cut` — the events, and why they are still the best path

```js
editor.addEventListener('paste', (e) => {
  const text = e.clipboardData.getData('text/plain');
  const file = [...e.clipboardData.items].find((i) => i.kind === 'file')?.getAsFile();
  if (file) { e.preventDefault(); uploadImage(file); }
});
```

`ClipboardEvent.clipboardData` is a `DataTransfer` — the same object drag-and-drop uses — and it
carries text through `getData()` and files through `items[i].getAsFile()`. 🔴 **No permission is
required**, because the user performed the paste. That is the whole trick: "paste a screenshot into
the comment box" needs no prompt at all, while a button that reads the clipboard does.

`preventDefault()` is what lets you take over — strip formatting on paste, upload an image instead
of embedding a data URL, or, on `copy`/`cut`, call `setData()` to change what actually lands on the
clipboard (a code block copied without its line numbers, a quotation copied with a source URL
attached).

## The decision

| You want | Use |
|---|---|
| Copy a link, a code, a token | `navigator.clipboard.writeText()` |
| Copy a table, an image, styled text | `new ClipboardItem({...})` + `write()`, **every** representation |
| Change what copying produces | the `copy` event + `setData()` + `preventDefault()` |
| Accept a pasted screenshot or file | the `paste` event + `clipboardData.items` — **no permission** |
| Read the clipboard on a button press | `read()`/`readText()`, and expect a prompt or a refusal |

## Gotchas

**Symptom: copy works on your machine and fails on the staging server.**
Cause — `navigator.clipboard` does not exist outside a secure context.
Fix — HTTPS (or `localhost`); feature-detect and fall back to a selectable text field.

**Symptom: `NotAllowedError` on a copy that "definitely" runs from a click.**
Cause — the transient activation was spent by an `await` before the `write()` call.
Fix — prepare the payload first and call the clipboard synchronously in the handler.

**Symptom: pasting into a plain-text field gets nothing.**
Cause — only `text/html` was written.
Fix — include `text/plain` in the same `ClipboardItem`.

**Symptom: reading the clipboard shows a permission prompt in one browser and a paste menu in
another.**
Cause — the read path is deliberately not uniform.
Fix — do not build a flow that depends on reading; let the user paste.

**Symptom: `document.execCommand('copy')` still used in the codebase.**
Cause — the old hidden-textarea hack.
Fix — `navigator.clipboard`; `execCommand` is deprecated, and MDN says to prefer the new API.

**Symptom: the clipboard API is missing inside a worker.**
Cause — it is not available in Web Workers.
Fix — do the copy on the main thread; a worker can prepare the `Blob`.

**Symptom: copy fails only inside an embedded iframe.**
Cause — the clipboard permissions need to be delegated by the embedder.
Fix — the embedding page must send the appropriate `Permissions-Policy`
([13 · What belongs on the server](../13-what-belongs-on-the-server/README.md)).

## Interview questions

**★ What replaced the hidden-textarea + `execCommand('copy')` hack?**
`navigator.clipboard` — promise-based, secure-context only, gesture-gated, with `writeText` for
text and `ClipboardItem` for anything richer. `execCommand` is deprecated.

**★ Why does copying usually work but reading usually prompt?**
Because the clipboard may contain data from another application — passwords, codes, addresses.
Writing costs the user nothing; reading is an exfiltration risk, so it is gated by activation and
by a permission or a paste menu depending on the browser.

**★ How do you accept a pasted screenshot without asking for clipboard permission?**
Listen for the `paste` event and read `event.clipboardData.items`, calling `getAsFile()` on the
file item. The user performed the paste, so no permission is involved.

**★ Why write both `text/plain` and `text/html`?**
The pasting application chooses the representation it understands. Without `text/plain`, pasting
into a plain editor produces nothing useful.

**★ A copy button throws `NotAllowedError` intermittently. What is the likely cause?**
The write happened outside the transient activation window — typically an `await` between the click
and the clipboard call, or a copy triggered by a timer.

---

[Topic index](./README.md) · [02 · Sharing](./02-web-share.md) →
