---
title: "1 · Getting the file"
sidebar_label: "1 · Getting the file"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file), [`HTMLInputElement.files`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/files), [`FileList`](https://developer.mozilla.org/en-US/docs/Web/API/FileList), [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File), [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API), [`DataTransfer.files`](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files), [`DataTransferItem`](https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem), [`Element: paste` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event), [`showOpenFilePicker()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker). Documentation-validated; **no timings**.

## The input

```html
<input type="file" id="pick" accept="image/*" multiple />
```

```js
pick.addEventListener("change", () => {
  const files = [...pick.files];    // ✅ FileList is array-like, not an Array
});
```

**`input.files` is a `FileList`** — indexed and with a `length`, but no `map`, no `filter`,
no `forEach`. Spread it or use `Array.from`
([Phase 5 · 22](../../phase-5-built-in-library/22-array-likes-and-iterables/README.md)).

**Each entry is a `File`:**

```js
file.name;           // "holiday.jpg" — the base name; no path, deliberately
file.size;           // bytes
file.type;           // "image/jpeg" — ⚠️ a guess, see below
file.lastModified;   // epoch ms
```

🔴 **A `File` is a `Blob` with a name.** It is a *handle* to bytes the browser already
holds — nothing has been read into memory. That is why sending a 2 GB file costs nothing
until it is sent, and why reading it into a string is almost always the wrong move
(**12 · `Blob`, `File` and `FileReader`** *(next in this phase)*).

⚠️ **There is no path.** `file.name` is the base name only; the full path is deliberately
withheld from the page.

### 🔴 Selecting the same file twice fires nothing

```js
// user picks report.pdf → change fires
// user picks report.pdf again → 🔴 nothing happens
```

**`change` fires when the value changes**, and picking the identical file does not change
it. The symptom is a user who cancelled an upload, re-picks the same file and sees nothing
happen at all.

✅ **Clear the input after you have taken the files:**

```js
pick.addEventListener("change", () => {
  const files = [...pick.files];
  pick.value = "";        // ✅ so the same file can be picked again
  handle(files);
});
```

**`input.value = ""` is the one assignment a file input accepts** — you cannot set it to a
filename, for obvious reasons.

### `accept`, `multiple`, `capture` — hints, not rules

```html
<input type="file" accept=".pdf,application/pdf" multiple capture="environment" />
```

- **`accept`** filters the OS picker's default view. ⚠️ **The user can switch it to "all
  files"**, and drag-and-drop ignores it entirely. It improves the experience; it enforces
  nothing.
- **`multiple`** allows a multi-selection. Without it, `files` still exists and still has
  `length` — it is just at most 1.
- **`capture`** asks a mobile browser to offer the camera or microphone directly.

**The modern alternative is `showOpenFilePicker()`**, which returns file handles and can
also write back. ⚠️ Availability is limited — check your targets, and keep the input as the
fallback, since it works everywhere and is keyboard- and screen-reader-accessible for free.

## Drag and drop

```js
const zone = document.querySelector("#drop");

zone.addEventListener("dragover", (e) => {
  e.preventDefault();                        // 🔴 REQUIRED
  e.dataTransfer.dropEffect = "copy";        // ✅ shows the right cursor
});

zone.addEventListener("drop", (e) => {
  e.preventDefault();                        // 🔴 REQUIRED
  handle([...e.dataTransfer.files]);
});
```

🔴 **Both `preventDefault()` calls are mandatory, and for different reasons.** Without the
one on `dragover`, the element is not a valid drop target and `drop` never fires at all.
Without the one on `drop`, the browser does its default action — **navigating away to open
the dropped file**, discarding your page and any unsaved state.

⚠️ **Add `dragleave` handling, and expect it to fire spuriously.** Moving over a child
element fires `dragleave` on the parent, so a naive "remove the highlight on dragleave"
flickers. A counter incremented on `dragenter` and decremented on `dragleave` is the usual
fix.

**`dataTransfer.files` gives files; `dataTransfer.items` gives more.** Items are needed to
detect a dropped *folder*, and to distinguish a dropped file from dropped text or a URL:

```js
for (const item of e.dataTransfer.items) {
  if (item.kind === "file") { … }     // vs "string"
}
```

⚠️ **Directory support is not uniform.** Reading a dropped folder's contents relies on
`webkitGetAsEntry()` or the newer `getAsFileSystemHandle()`, and both need a targets check.

## Paste

**Users expect to paste a screenshot**, and it costs three lines:

```js
document.addEventListener("paste", (e) => {
  const files = [...e.clipboardData.files];
  if (files.length) handle(files);
});
```

**This is the cheapest usability win in the whole topic** and it is very often missed.

## Validating on the client

**Client-side checks are for feedback, not for safety.** They stop a user waiting through
a doomed upload; they stop nothing else.

```js
const MAX = 10 * 1024 * 1024;

function validate(file) {
  if (file.size > MAX) return "That file is larger than 10 MB.";
  if (!file.type.startsWith("image/")) return "Please choose an image.";
  return null;
}
```

🔴 **`file.type` is not evidence.** The browser guesses it, largely from the extension —
so `virus.exe` renamed to `photo.png` reports `image/png`. It is also empty for
unrecognised types, so `!file.type.startsWith("image/")` rejects legitimate files whose
type the OS did not know.

✅ **If the actual format matters, check the magic bytes** — and check them again on the
server, which is the only check that counts:

```js
const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
const isPNG = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
```

**`file.slice(0, 4)` reads four bytes, not the file** — the same `Blob.slice` that powers
chunked uploads in [chunk 2](./02-sending-it.md).

⚠️ **And `file.name` is untrusted input.** It can contain `../`, control characters, or a
name designed to overwrite something. Never use it as a path or a storage key; generate
your own identifier and keep the original name as a display label only.

**Check the count too** — a user can drop a folder of 5,000 images, and a `map` that fires
5,000 concurrent uploads will take down your own page before it reaches the server.

## Gotchas

**Symptom:** Picking the same file twice did nothing
**Cause:** `change` needs the value to change.
**Fix:** `input.value = ""` after reading `files`.

**Symptom:** `files.map is not a function`
**Cause:** `FileList` is array-like, not an array.
**Fix:** `[...input.files]`.

**Symptom:** Dropping a file navigated the browser to it
**Cause:** No `preventDefault()` on `drop`.
**Fix:** Call it — and on `dragover` too.

**Symptom:** The `drop` event never fired
**Cause:** No `preventDefault()` on `dragover`, so the element is not a drop target.
**Fix:** Prevent the default on `dragover`.

**Symptom:** The drop highlight flickered
**Cause:** `dragleave` fires when moving onto a child element.
**Fix:** Count `dragenter`/`dragleave` and only clear at zero.

**Symptom:** `accept` did not stop the wrong file type
**Cause:** It filters the picker's view; the user can override it, and drag-and-drop
ignores it.
**Fix:** Validate after selection — and again on the server.

**Symptom:** A valid file was rejected because `file.type` was empty
**Cause:** The browser could not guess the type.
**Fix:** Fall back to the extension, or read the magic bytes; do not reject on an empty
type alone.

**Symptom:** An executable passed an image check
**Cause:** `file.type` is derived from the name.
**Fix:** Magic bytes on the client if you like; on the server always.

**Symptom:** Dropping a folder produced nothing
**Cause:** `dataTransfer.files` does not expand directories.
**Fix:** `dataTransfer.items` with `webkitGetAsEntry()`, behind a support check.

## Interview questions

**★ What is a `File`, and what does it cost to hold one?**
A `File` is a `Blob` with a name, size, type and last-modified date — a *handle* to bytes
the browser already has. Nothing is read into memory when you receive it, which is why a
multi-gigabyte file can be sent without being loaded. Reading it into a string is the
mistake that turns a cheap operation into an expensive one.

**★ Why does selecting the same file twice not fire `change`?**
Because the input's value did not change. The fix is to clear it — `input.value = ""` —
after taking the files, which is also the only assignment a file input accepts.

**★ Why do drag-and-drop handlers need two `preventDefault()` calls?**
They prevent different defaults. On `dragover` it marks the element as a valid drop target;
without it `drop` never fires. On `drop` it stops the browser's default action of navigating
away to open the file, which would discard the page.

**★ Can you trust `file.type` or `file.name`?**
Neither. `type` is the browser's guess, largely from the extension, so a renamed executable
reports an image type — and it is empty for unrecognised formats, which rejects legitimate
files. `name` is attacker-controlled text that may contain path segments, so never use it
as a path or storage key. Both are display hints; the server validates.

**What is client-side validation for, then?**
Feedback. Telling a user immediately that their file is too large beats making them wait
through a doomed upload. It is a user-experience feature with no security value, because
anything the client checks the client can skip.

**How do you accept a pasted screenshot?**
Listen for `paste` on the document and read `e.clipboardData.files`. Three lines, and it is
the interaction users most often expect and most often do not get.

---

[Topic index](./README.md) · Next: [2 · Sending it](./02-sending-it.md) →
