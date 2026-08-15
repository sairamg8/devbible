---
title: "02 · Uploading and submitting"
sidebar_label: "02 · Uploading and submitting"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [`FormData.append()`](https://developer.mozilla.org/en-US/docs/Web/API/FormData/append), [`XMLHttpRequest.upload`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload), [`ProgressEvent`](https://developer.mozilla.org/en-US/docs/Web/API/ProgressEvent), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`Request.duplex`](https://developer.mozilla.org/en-US/docs/Web/API/Request/duplex), [`beforeunload` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event), [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions). Documentation-validated; **no timings and no console output**.

🔴 **The decision that shapes this whole feature: photos upload the moment they are picked, and the
review text is submitted separately, carrying only their ids.** Everything on this page follows from
that one choice, including why it is the right one.

## One request per photo

```js
async function upload(record) {
  record.status = 'uploading';
  record.controller = new AbortController();
  render();

  const body = new FormData();
  body.append('photo', record.file, record.file.name);   // ⚠️ the filename argument — see below
  body.append('draftId', draftId);

  try {
    const { mediaId } = await postWithProgress('/api/review-media', body, {
      signal: record.controller.signal,
      onProgress: (pct) => { record.pct = pct; renderProgress(record); },
    });
    record.mediaId = mediaId;
    record.status = 'done';
    announce(`Photo uploaded, ${doneCount()} of ${photos.length}.`);
  } catch (err) {
    if (err.name === 'AbortError') return;               // removed or cancelled — not a failure
    record.status = 'error';
    record.error = 'Upload failed.';                     // ✅ with a retry button beside it
  }
  render();
}
```

**Why one request per photo rather than one `FormData` holding five files:**

| Per photo | One combined request |
|---|---|
| Per-photo progress and per-photo retry | One bar for everything; one failure loses all five |
| A failure is isolated — four succeed, one offers a retry | The retry re-sends megabytes that already arrived |
| Each body stays inside ordinary request-size limits | One body that trips the proxy's max request size |
| Uploads overlap with the user still typing | The user waits at the end, when they expect to be done |

⚠️ **Cap the concurrency at two or three.** Five simultaneous uploads share one uplink, so nothing
finishes sooner and every bar crawls at a fifth of the speed — the visible effect is a form that
looks stuck. It is the same promise-pool as everywhere else
([Phase 7 · 16 · Concurrency limiting](../../phase-7-async/16-concurrency-limiting/README.md)),
and on a review form a pool of two is plenty because uploads start as photos arrive rather than all
at once.

## The two `FormData` traps

🔴 **Never set `Content-Type` yourself.** The browser sets `multipart/form-data` **and the boundary
parameter** that tells the server where each part starts. A hand-written header carries no boundary,
so the server parses nothing and reports no fields at all — from the client's side the request looks
completely normal.

```js
// ❌ the bug
fetch('/api/review-media', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body });
// ✅ let the browser do it
fetch('/api/review-media', { method: 'POST', body });
```

⚠️ **On a storefront this almost always arrives through the shared wrapper**, which sets
`application/json` for every request because every other endpoint takes JSON. The wrapper needs one
line: skip the header when the body is a `FormData` or a `Blob`
([03 · A resilient API client](../03-resilient-api-client/README.md)).

🔴 **Pass the filename when you append a `Blob`.** MDN is explicit: *"The default filename for
`Blob` objects is `"blob"`. The default filename for `File` objects is the file's filename."*

```js
body.append('photo', resizedBlob);                       // ❌ arrives as "blob"
body.append('photo', resizedBlob, 'review-photo-1.jpg'); // ✅
```

**This is the trap the next chunk creates.** A resized photo is a `Blob` produced by the canvas, not
the `File` the user picked — so **every** resized upload arrives named `blob`, and a server that
derives its extension or content type from the filename gets it wrong for all of them
([03 · Resizing before upload](./03-resizing-before-upload.md)).

⚠️ **Do not pass the user's filename straight through either.** It is untrusted text that may
contain path segments or control characters; send it as a *display label* and let the server choose
the stored name ([04 · A file you cannot trust](./04-a-file-you-cannot-trust.md)).

## Progress, and why it is still `XMLHttpRequest`

```js
function postWithProgress(url, body, { signal, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.addEventListener('progress', (e) => {     // 🔴 xhr.upload, NOT xhr
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener('load', () =>
      xhr.status < 400 ? resolve(JSON.parse(xhr.responseText))
                       : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));

    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(body);
  });
}
```

🔴 **`fetch` has no upload progress.** It streams the response, not the request, so there is no
event that says *60% of the bytes have left*. This is the one job `XMLHttpRequest` still holds, and
the honest reason it is not dead ([Phase 11 · 21](../../phase-11-network-storage/21-xmlhttprequest/README.md)).

⚠️ **`xhr.upload`, not `xhr`.** Listening on the request object gives *download* progress — which,
for an upload endpoint returning a small JSON id, jumps from nothing to 100% instantly. It looks
like a working progress bar in development and is a lie.

⚠️ **Check `lengthComputable`.** When it is `false`, `e.total` is meaningless and a percentage
computed from it is nonsense; fall back to an indeterminate bar.

**Streaming request bodies are the standards-track alternative** — a `ReadableStream` as the body,
which requires `duplex: "half"` on the request. MDN marks it **experimental and not Baseline**, so
it is not what a shipping progress bar should be built on today.

⚠️ **Progress is bytes leaving the browser, not work finished.** The last percent covers everything
the server does afterwards — virus scan, re-encode, thumbnails, storage — so a bar that sits at 100%
for a while is normal, and the UI should say *"processing"* rather than pretend it is done.

## Cancelling, retrying and the states in between

```js
retryButton.onclick = () => { record.error = null; record.pct = 0; upload(record); };
```

- **Cancel is `record.controller.abort()`**, and the `catch` must treat `AbortError` as a
  cancellation, not as a failure to display
  ([Phase 11 · 08 · Aborting and timing out](../../phase-11-network-storage/08-aborting-and-timing-out/README.md)).
- **Retry is just calling `upload` again** — the record still holds the `File`, and a fresh
  `AbortController` replaces the aborted one. ⚠️ **An `AbortSignal` is single-use**; reusing the
  aborted controller aborts the new request immediately.
- **Abort does not un-send what already left.** Bytes on the wire have arrived; a cancelled upload
  may still be a complete object on the server, which is why the server should key partial uploads
  to the draft and expire them.
- ⚠️ **Retry the request, not the resize.** Re-running the canvas pipeline on retry burns CPU on a
  phone for a blob you already have — keep the resized `Blob` on the record.

## The submit that cannot lose the user's writing

```js
async function submitReview() {
  if (photos.some((p) => p.status === 'uploading')) return blockWith('Photos are still uploading…');

  await api.post('/api/reviews', {
    productId,
    rating,
    body: textarea.value,
    media: photos.filter((p) => p.status === 'done')
                 .map((p) => ({ id: p.mediaId, alt: p.alt })),   // ✅ ids, not bytes
    requestId: draftId,                                          // ✅ idempotency key
  });
}
```

🔴 **This is the whole argument for uploading on selection.** The review POST is a small JSON body
of ids: it is fast, it is safely retryable, and a photo that failed cannot take a paragraph of typed
text down with it. The alternative — one giant multipart submit — puts the slowest and most
failure-prone work at the exact moment the user believes they have finished, and a dropped
connection there costs them everything they wrote. That is the worst outcome this form has.

**Send the same `requestId` on every retry** so a submit that succeeded on the server but failed on
the way back does not produce two reviews ([07 · Idempotency from the client](../07-idempotency/README.md)).

🔴 **Decide explicitly what a failed photo means.** Either the submit is blocked until every photo
is `done` or removed, or it proceeds with the ones that worked *and says so before it does*.
Silently dropping a photo the user can still see on screen is the option that produces support
tickets — and it is the default if nobody decides.

## Not losing the draft

```js
addEventListener('beforeunload', (e) => {
  if (photos.some((p) => p.status === 'uploading') || textarea.value.trim()) {
    e.preventDefault();          // triggers the browser's own generic confirmation
  }
});
```

⚠️ **You cannot choose the wording** — browsers show a generic message deliberately, and custom
strings are ignored. It also only covers a deliberate close: it does nothing for a crash, and
nothing for a backgrounded phone tab the OS discards.

- **Persist the text as it is typed** — `localStorage`, keyed by product id, cleared on success.
  It is a few lines and it is the difference between an annoyance and a lost review.
- **Already-uploaded photos need nothing but their ids**, which are short strings. Persisting those
  restores the attachments for free — one more argument for uploading early.
- **`File` objects can be stored in IndexedDB**, so unsent photos *can* survive a reload. Do that
  only if the product genuinely needs it. ⚠️ **Never base64 a photo into `localStorage`** — it
  inflates the bytes by about a third and pushes a synchronous multi-megabyte string through the
  main thread ([Phase 11 · 16 · IndexedDB](../../phase-11-network-storage/16-indexeddb/README.md)).

## Accessibility, in the four places it matters here

- **Progress must be readable, not merely visible.** `<progress max="100" value="40">` with a label,
  or `role="progressbar"` with `aria-valuenow` — a coloured bar alone announces nothing.
- **Announce outcomes through a live region that was already in the DOM** — *"Photo 3 uploaded"*,
  *"Photo 2 failed, retry available"*. A region inserted at the same moment as its text is often not
  announced ([Phase 12 · 11 · Accessibility from JavaScript](../../phase-12-browser-platform/11-accessibility-from-javascript/README.md)).
- **Give every control its own accessible name.** Five buttons all called "Retry" are useless —
  `aria-label="Retry photo 3"`.
- **Ask for alt text per photo.** A review photo is content, and a one-line optional description
  beside each thumbnail is the only way it means anything to a screen reader once published. It also
  gives the submitted `media[].alt` something real to carry.

## Gotchas

**Symptom: the server sees no fields at all on the upload.**
Cause — `Content-Type` was set manually on a `FormData` request, so there is no multipart boundary.
Fix — never set it; make the shared wrapper skip it for `FormData`.

**Symptom: every uploaded photo arrives named `blob`.**
Cause — a `Blob` was appended with no third argument.
Fix — `body.append('photo', blob, 'review-1.jpg')`.

**Symptom: the progress bar sits at 0% then jumps to 100%.**
Cause — progress read from `fetch` (which has none) or from `xhr` instead of `xhr.upload`.
Fix — listen on `xhr.upload`'s `progress` event.

**Symptom: the percentage is `NaN` or wildly wrong.**
Cause — `e.total` used while `lengthComputable` is `false`.
Fix — check the flag; show an indeterminate bar otherwise.

**Symptom: the bar reaches 100% and the photo still is not attached.**
Cause — progress measures bytes sent, not server-side processing.
Fix — a separate "processing" state until the response arrives.

**Symptom: retry aborts instantly every time.**
Cause — the aborted `AbortController` was reused; a signal cannot be un-aborted.
Fix — a fresh controller per attempt.

**Symptom: a failed upload lost the whole review the user had typed.**
Cause — text and bytes submitted together in one multipart request.
Fix — upload photos on selection; submit ids.

**Symptom: two identical reviews appear after a flaky submit.**
Cause — the retry sent a new request with no idempotency key.
Fix — one `requestId` per draft, reused on every attempt.

**Symptom: five uploads all crawl and nothing completes.**
Cause — unbounded concurrency on one uplink.
Fix — a pool of two or three.

## Interview questions

**★ Why upload review photos before the user presses submit?**
So a photo failure cannot destroy typed text, so the submit is a small retryable JSON body of ids,
and so the upload overlaps with the time the user spends writing. The one-big-multipart alternative
puts the slowest, most failure-prone work at the exact moment the user expects to be finished.

**★ What breaks when you set `Content-Type: multipart/form-data` yourself?**
The boundary parameter is missing, so the server cannot split the parts and sees no fields. The
browser generates the boundary — let it set the header.

**★ Why does an upload progress bar force you into `XMLHttpRequest`?**
`fetch` exposes no upload progress; `xhr.upload` fires `progress` events with `loaded` and `total`.
Streaming request bodies with `duplex: "half"` are the standards-track answer but are not Baseline.

**★ What is the difference between `xhr.upload.onprogress` and `xhr.onprogress`?**
`xhr.upload` is the request body going out; `xhr` is the response coming back. For an upload
endpoint that returns a small JSON id, the second one looks like a working bar and measures nothing
useful.

**★ Why does a resized photo arrive at the server called `blob`?**
Because it is a `Blob`, not a `File`, and `FormData.append()` defaults a `Blob`'s filename to
`"blob"`. Pass the third argument.

**★ How do you stop a retried submit from creating two reviews?**
Send a stable `requestId` generated once per draft, and have the server treat a repeat as the same
write. The dangerous case is a request that succeeded but whose response was lost.

---

← [01 · The photo list](./01-the-photo-list.md) · [Topic index](./README.md) · [03 · Resizing before upload](./03-resizing-before-upload.md) →
