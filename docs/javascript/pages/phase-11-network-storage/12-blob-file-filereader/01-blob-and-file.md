---
title: "1 · `Blob` and `File`"
sidebar_label: "1 · Blob and File"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob), [`Blob()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob), [`Blob.slice()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice), [`Blob.text()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/text), [`Blob.arrayBuffer()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer), [`Blob.stream()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/stream), [`Blob.bytes()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/bytes), [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File), [`FileReader`](https://developer.mozilla.org/en-US/docs/Web/API/FileReader), [`TextDecoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder). Documentation-validated; **no timings**.

## Making one

```js
new Blob(["hello"], { type: "text/plain" });
new Blob([uint8Array, otherBlob, "text"], { type: "application/octet-stream" });
```

**The first argument is an array of parts**, concatenated in order — strings, other
`Blob`s, `ArrayBuffer`s and typed-array views all count. Strings are encoded as **UTF-8**,
which is the only encoding a `Blob` constructor produces.

```js
blob.size;   // bytes — always accurate
blob.type;   // the MIME string you gave it, lowercased; "" if you gave none
```

⚠️ **`type` is a label, not a fact.** Nothing verifies that the bytes match it. For a
`Blob` you constructed that is fine, since you know what you put in; for a `File` the user
chose, it is the browser's guess from the extension
([11 · 01](../11-uploading-files/01-getting-the-file.md)).

**Blobs are immutable.** There is no `append`, no way to write into one. You build a new
one from parts — which is cheap, because the parts are referenced rather than copied.

## 🔴 `slice()` costs nothing

```js
const firstChunk = blob.slice(0, 5 * 1024 * 1024);   // ✅ instant, whatever the size
const header = file.slice(0, 4);                      // ✅ four bytes, no read
```

**`slice` returns a new `Blob` describing a byte range of the original.** No bytes are
read, copied or allocated — it is a view, in the same spirit as `subarray` over an
`ArrayBuffer` ([Phase 5 · 25 · 01](../../phase-5-built-in-library/25-typed-arrays/01-buffers-and-views.md)).

**That is why the two most useful `Blob` techniques are both free:**

```js
// 1 · check magic bytes without reading a 2 GB file
const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());

// 2 · chunked upload
for (let i = 0; i * CHUNK < file.size; i++) {
  await send(file.slice(i * CHUNK, (i + 1) * CHUNK));
}
```

⚠️ **`slice` takes negative indices** like `Array.prototype.slice` — `blob.slice(-100)` is
the last hundred bytes — and an optional third argument sets the new blob's `type`, which
is otherwise empty.

## `File` — a `Blob` with a name

```js
file instanceof Blob;   // ✅ true
file.name;              // "report.pdf" — base name only, no path
file.lastModified;      // epoch ms
```

**Everything a `Blob` can do, a `File` can do**, which is why `fetch` accepts a `File` as a
body without a conversion step. You can also construct one, which is how you attach a
generated file to `FormData` under a chosen name:

```js
const generated = new File([csvString], "export.csv", { type: "text/csv" });
```

## Reading — the four methods

**All four are on `Blob` itself and all return promises:**

```js
await blob.text();          // string, decoded as UTF-8
await blob.arrayBuffer();   // ArrayBuffer of the whole thing
await blob.bytes();         // Uint8Array — newer; check your targets
blob.stream();              // a ReadableStream — not a promise
```

**Choosing between them is a memory decision, not a style one:**

| You need | Use | Cost |
|---|---|---|
| the text of a small file | `text()` | the whole thing in memory, twice while decoding |
| the bytes, to parse a format | `arrayBuffer()` | the whole thing in memory |
| the bytes, as a typed array | `bytes()` | same, without the extra wrapping step |
| to process a large file piece by piece | `stream()` | one chunk at a time ✅ |
| **to send, store or display it** | **none of them** | ✅ **free** |

🔴 **`text()` assumes UTF-8, always.** A file in another encoding comes back as
replacement characters. If the encoding is not yours to control, read the bytes and decode
with a labelled `TextDecoder`
([Phase 5 · 26 · 01](../../phase-5-built-in-library/26-text-encoding/01-textencoder-and-textdecoder.md)):

```js
const text = new TextDecoder("iso-8859-1").decode(await blob.arrayBuffer());
```

⚠️ **And reading is where a large file becomes a problem.** A 500 MB file has a `size` and
a handle for free; `arrayBuffer()` on it asks for 500 MB of contiguous memory, and a tab
can simply die. **Stream it, or slice it, or do not read it at all.**

```js
for await (const chunk of blob.stream()) { … }   // ✅ bounded memory
```

## `FileReader` — why it still exists

```js
const reader = new FileReader();
reader.onload = () => use(reader.result);
reader.onerror = () => handle(reader.error);
reader.readAsText(file);
```

**`FileReader` is the pre-promise API**, event-based and considerably more code for the
same result. `blob.text()` replaces `readAsText`, `blob.arrayBuffer()` replaces
`readAsArrayBuffer`, and object URLs ([chunk 2](./02-object-urls.md)) replace
`readAsDataURL` in almost every case.

🔴 **Two reasons it is not simply obsolete:**

- **`readAsDataURL`** is still the shortest way to get a data URL for a small image when
  you genuinely need one embedded — for example to store in JSON or paste into a
  stylesheet. Object URLs are better for display; data URLs survive serialisation.
- **`onprogress`** exists on `FileReader`. Reading a very large file locally is the one
  place a progress event is available without XHR.

⚠️ **`FileReader` also has a synchronous cousin, `FileReaderSync`, available only in
workers** — which is the correct place to do heavy local file processing anyway.

## Gotchas

**Symptom:** The tab crashed or froze reading a large file
**Cause:** `arrayBuffer()` or `text()` loads the entire file into memory at once.
**Fix:** `stream()`, or `slice()` the part you actually need — or do not read it.

**Symptom:** File text came back full of `�`
**Cause:** `blob.text()` decodes as UTF-8 unconditionally.
**Fix:** `arrayBuffer()` plus a `TextDecoder` with the right encoding label.

**Symptom:** `blob.type` was empty
**Cause:** No type was given to the constructor, or the browser could not guess a file's.
**Fix:** Pass a type when constructing; never reject a file solely on an empty type.

**Symptom:** A `Blob` could not be modified
**Cause:** Blobs are immutable.
**Fix:** Build a new one from parts — the parts are referenced, so it is cheap.

**Symptom:** Slicing a huge file seemed suspiciously fast
**Cause:** It is — `slice` reads nothing, it describes a range.
**Fix:** Nothing. Rely on it; that is what makes chunked uploads and magic-byte checks
practical.

**Symptom:** A generated file uploaded with the wrong name
**Cause:** A `Blob` has no name; `FormData` invents one.
**Fix:** `new File([parts], "name.ext", { type })`, or pass the filename as `append`'s
third argument.

**Symptom:** `blob.bytes is not a function`
**Cause:** It is newer than the other read methods.
**Fix:** `new Uint8Array(await blob.arrayBuffer())`.

## Interview questions

**★ What is a `Blob`?**
A handle to an immutable lump of bytes the browser holds — on disk, in memory, or from the
network. Your JavaScript has a reference with a `size` and a `type`, not the data. That is
why sending, storing or displaying a `Blob` costs nothing, and why reading it is a separate,
asynchronous, expensive act.

**★ Why is `blob.slice()` cheap on a huge file?**
Because it does not read anything — it returns a new `Blob` describing a byte range of the
original. That is what makes chunked uploads and magic-byte checks practical: you can look
at the first four bytes of a two-gigabyte file, or upload it in five-megabyte pieces,
without ever holding it in memory.

**★ How do `Blob` and `File` relate?**
`File` extends `Blob`, adding `name` and `lastModified`. Everything that accepts a `Blob`
accepts a `File`, which is why `fetch` can take one as a body directly. You can construct a
`File` too, which is how a generated export gets a filename.

**★ When should you read a `Blob`, and how?**
Only when your code has to inspect the bytes. Then pick by size: `text()` or
`arrayBuffer()` for something small, `stream()` for anything large — the whole-file readers
ask for contiguous memory and can kill a tab. And `text()` assumes UTF-8, so a
differently-encoded file needs `arrayBuffer()` with a labelled `TextDecoder`.

**Is `FileReader` obsolete?**
Nearly. `blob.text()` and `blob.arrayBuffer()` replace its main methods with promises and
far less code. It survives for `readAsDataURL`, which is still the shortest route to an
embeddable data URL, and for its `progress` event when reading a very large local file.
`FileReaderSync` exists in workers, which is where heavy local processing belongs.

---

[Topic index](./README.md) · Next: [2 · Object URLs, and reading without reading](./02-object-urls.md) →
