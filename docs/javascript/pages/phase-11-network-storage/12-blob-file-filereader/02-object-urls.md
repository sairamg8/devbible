---
title: "2 · Object URLs, and reading without reading"
sidebar_label: "2 · Object URLs"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`URL.createObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static), [`URL.revokeObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static), [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob), [Data URLs](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data), [`HTMLAnchorElement.download`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#download), [`Worker()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone). Documentation-validated; **no timings**.

## `createObjectURL`

```js
const url = URL.createObjectURL(blob);
// "blob:https://example.com/6f8c1e2a-..."
img.src = url;
```

**It registers the `Blob` with the document and hands back a URL that refers to it.**
Nothing is read, nothing is encoded, nothing is copied — the browser already has the bytes,
and now there is a name for them.

**Anywhere a URL goes, an object URL goes:** `<img src>`, `<video src>`, `<a href>`, CSS
`url()`, a `Worker` constructor, `fetch`.

🔴 **The URL is scoped to the document that created it**, so it is meaningless in another
tab, after a reload, or if you email it to someone. It is a handle with a URL's shape, not
an address.

## 🔴 `revokeObjectURL` — the leak that testing never finds

```js
URL.revokeObjectURL(url);   // ✅ releases the Blob; the URL stops working
```

**Creating an object URL makes the browser hold the `Blob` alive until you revoke it** —
not until the `<img>` is removed, not until your variable goes out of scope, not on garbage
collection. **The registration is the reference.**

⚠️ **Why it never shows up in development:** one preview of a 2 MB image is invisible. A
gallery where the user flips through two hundred photos, or a long session that previews
every upload, accumulates every one of them. The bug is *time*, and testing is short.

✅ **Revoke as soon as the consumer has what it needs:**

```js
const url = URL.createObjectURL(file);
img.src = url;
img.onload = () => URL.revokeObjectURL(url);   // ✅ the image is decoded; the URL is done
```

**For a download link, revoke after the click has been handled:**

```js
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = "export.csv";
a.click();
setTimeout(() => URL.revokeObjectURL(a.href), 0);   // ✅ after the browser has taken it
```

⚠️ **Revoking too early is the opposite failure** — a broken image or a download that never
starts, because the browser had not yet fetched the URL. The safe points are "after `load`"
for media and "after the current task" for a click-triggered download.

**In a component, revoke on teardown** — the same lifecycle shape as
[08 · 02](../08-aborting-and-timing-out/02-cancellation-as-a-lifecycle.md):

```js
useEffect(() => {
  const url = URL.createObjectURL(file);
  setPreview(url);
  return () => URL.revokeObjectURL(url);   // ✅ on unmount and before the next file
}, [file]);
```

## Object URL, data URL, or read it?

| | Object URL | Data URL | `arrayBuffer()` / `text()` |
|---|---|---|---|
| Cost to create | ✅ nothing | 🔴 full read + ~33% base64 | 🔴 full read |
| Memory | the `Blob` (already held) | the whole thing as a string | the whole thing |
| Survives serialisation | ❌ document-scoped | ✅ it is just text | n/a |
| Works in another tab | ❌ | ✅ | n/a |
| Needs cleanup | ✅ **revoke** | ❌ | ❌ |
| Good for | previews, downloads, media, workers | tiny inline images, embedding in JSON or CSS | parsing the bytes |

**The decision:**

- **Displaying or downloading?** → object URL. Always. It is free and it is what the API is
  for.
- **Must the value be storable or embeddable as text?** → data URL, and only if it is
  small ([Phase 5 · 26 · 02](../../phase-5-built-in-library/26-text-encoding/02-base64.md)).
- **Does your code need to look at the bytes?** → read, and stream if it is large.

🔴 **The common wrong turn is `FileReader.readAsDataURL` for an image preview.** It reads
the whole file, base64-encodes it into a string a third larger, and holds that string for
as long as the preview is on screen — where `createObjectURL` would have cost nothing.

## Generating a file to download

**No server round trip is needed to hand the user a file:**

```js
function download(text, filename, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

⚠️ **`download` only works same-origin** (or for `blob:` and `data:` URLs, which is why
this pattern is the standard one). Pointing it at a cross-origin URL is ignored and the
browser navigates instead.

⚠️ **And for a genuinely large export, build it as a stream** rather than concatenating a
giant string in memory — the same reasoning as reading.

## Workers from a `Blob`

```js
const src = `onmessage = (e) => postMessage(e.data * 2);`;
const worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
```

**Useful for a worker generated at runtime**, and it appears in libraries that ship a
worker without a separate file. ⚠️ **A strict Content Security Policy can block it** —
`blob:` needs to be permitted in `worker-src` — which is a good reason to prefer a real
file when you control the build (**15 · Content Security Policy**, *later in this phase*).

## Where a `Blob` should go instead of into a string

✅ **Straight to whatever consumes it**, with no read at all:

```js
fetch(url, { method: "POST", body: blob });        // upload
store.put(blob, key);                              // IndexedDB stores Blobs natively
worker.postMessage(blob);                          // structured clone handles Blobs
img.src = URL.createObjectURL(blob);               // display
```

🔴 **IndexedDB is the one most often missed.** People base64 a file into `localStorage`,
hit the quota, and conclude the browser cannot store files — when IndexedDB takes the
`Blob` directly, with no encoding and no size inflation
([10 · 02](../10-web-storage/02-the-storage-event-and-choosing.md), and **16 · IndexedDB**
*later in this phase*).

**And `postMessage` accepts a `Blob`** because the structured clone algorithm handles it
([Phase 5 · 21](../../phase-5-built-in-library/21-structuredclone.md)) — so a worker can
process a file without the main thread ever reading it.

## Gotchas

**Symptom:** Memory grew through a session of previewing images
**Cause:** Object URLs were never revoked, so every `Blob` stayed registered.
**Fix:** `revokeObjectURL` after `load`, or on component teardown.

**Symptom:** A preview image was broken
**Cause:** The URL was revoked before the browser fetched it.
**Fix:** Revoke in the `load` handler, not immediately after assigning `src`.

**Symptom:** A generated download did not start
**Cause:** The object URL was revoked in the same tick as the click.
**Fix:** Revoke in a `setTimeout(..., 0)`, after the browser has taken the URL.

**Symptom:** A `blob:` URL did not work in another tab
**Cause:** Object URLs are scoped to the creating document.
**Fix:** Nothing — that is the design. Use a real URL if it must be shareable.

**Symptom:** Previewing images used far more memory than expected
**Cause:** `readAsDataURL` — a full read plus a base64 string a third larger.
**Fix:** `createObjectURL`.

**Symptom:** `download` was ignored and the browser navigated instead
**Cause:** The `href` is cross-origin.
**Fix:** A `blob:` URL, which is what the generate-and-download pattern produces.

**Symptom:** A `Blob`-constructed worker was blocked
**Cause:** CSP does not allow `blob:` in `worker-src`.
**Fix:** Ship a real worker file, or adjust the policy deliberately.

**Symptom:** Storing files hit the `localStorage` quota
**Cause:** Files were base64-encoded into web storage.
**Fix:** IndexedDB, which stores a `Blob` directly.

## Interview questions

**★ What does `createObjectURL` actually do?**
It registers a `Blob` with the document and returns a `blob:` URL referring to it. Nothing
is read, encoded or copied — the browser already holds the bytes. The URL works anywhere a
URL works, but it is scoped to the creating document, so it is meaningless in another tab
or after a reload.

**★ What leaks if you forget `revokeObjectURL`?**
The `Blob` itself. The registration is a reference, so the bytes are held until you revoke —
removing the `<img>`, dropping the variable, or garbage collection will not do it. It never
appears in testing because one preview is invisible; a gallery over a long session is not.

**★ Object URL or data URL for an image preview?**
Object URL, always. A data URL requires a full read plus base64, producing a string about a
third larger that lives as long as the preview does. Data URLs earn their place only when
the value must be *text* — embedded in JSON or a stylesheet — and only when it is small.

**★ How do you let a user download data generated in the browser?**
Wrap it in a `Blob`, create an object URL, set it as an `<a href>` with a `download`
attribute, click it programmatically, and revoke in a `setTimeout(…, 0)` so the browser has
taken the URL first. `download` is ignored cross-origin, which is why the `blob:` URL is
part of the pattern rather than incidental.

**Where should a `Blob` go instead of being read?**
Straight to the consumer: `fetch` as a body, IndexedDB as a stored value, `postMessage` to
a worker, or an object URL for display. IndexedDB is the one most often missed — people
base64 files into `localStorage`, hit the quota, and conclude the browser cannot store
files.

**Why can a `Blob` be sent to a worker without reading it?**
Because the structured clone algorithm handles `Blob`s, so `postMessage` transfers the
reference rather than requiring you to serialise the bytes. The worker can then read or
stream it off the main thread entirely.

---

← [1 · `Blob` and `File`](./01-blob-and-file.md) · [Topic index](./README.md) · [Phase index](../README.md) →
