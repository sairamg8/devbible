---
title: "01 · The photo list"
sidebar_label: "01 · The photo list"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File), [`FileList`](https://developer.mozilla.org/en-US/docs/Web/API/FileList), [`<input type="file">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file), [`URL.createObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static), [`URL.revokeObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API). Documentation-validated; **no timings and no console output**.

A "write a review" form is a star rating, a textarea and — the part that goes wrong — up to five
photos of the thing that arrived. Getting a `File` out of the browser is
[Phase 11 · 11 · 01](../../phase-11-network-storage/11-uploading-files/01-getting-the-file.md);
this page is what you hold it *in*, because a review form is the case where the naive answer
(keep the `FileList`) falls apart on the first interaction.

## The model is a list of records, not a `FileList`

```js
// one record per photo — they succeed, fail, retry and cancel independently
const photos = [];        // [{ id, file, previewUrl, status, pct, mediaId, error, controller }]

let nextId = 0;
function toRecord(file) {
  return {
    id: `p${nextId++}`,           // ✅ our own id — never file.name, which is untrusted input
    file,
    previewUrl: URL.createObjectURL(file),
    status: 'queued',             // 'queued' | 'uploading' | 'done' | 'error'
    pct: 0,
    mediaId: null,                // what the server gives back
    error: null,
    controller: null,             // the AbortController for this photo's request
  };
}
```

🔴 **Holding `input.files` is the mistake this replaces**, for three separate reasons:

- **It is replaced wholesale.** The next `change` event swaps in a brand-new `FileList`, so a user
  who picks two photos and then opens the picker again for a third ends up with one.
- **It is array-like, not an array** — no `map`, no `filter`, no `splice`
  ([Phase 5 · 22](../../phase-5-built-in-library/22-array-likes-and-iterables/README.md)) — and it
  is read-only, so a photo cannot be removed from it.
- **It has nowhere to put the state the UI renders.** Progress, error text, the retry affordance and
  the server's id all belong per photo, and there is no per-file slot on a `FileList` to hold them.

The moment the design allows *remove photo 2 and retry photo 4* — which every review form does —
you need records.

## Adding files without losing the ones already there

```js
const MAX_PHOTOS = 5;

input.addEventListener('change', () => {
  addPhotos([...input.files]);
  input.value = '';               // 🔴 or picking the same file again fires nothing
});

function addPhotos(incoming) {
  for (const file of incoming) {
    if (photos.length >= MAX_PHOTOS) { announce('You can attach up to 5 photos.'); break; }
    if (photos.some((p) => same(p.file, file))) continue;      // deduplicate
    const record = toRecord(file);
    photos.push(record);
    upload(record);                                            // ✅ start immediately — chunk 02
  }
  render();
}

const same = (a, b) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
```

**Append, never replace.** This is the single most common review-form bug and it is invisible in
testing, because a developer picks all their test images in one go and a real user does not.

🔴 **`input.value = ''` after taking the files, always.** `change` fires when the *value* changes,
so a user who removes a photo and re-picks the identical file gets no event and no feedback
whatsoever — the form simply ignores them. Clearing the value is also the only assignment a file
input accepts.

**Deduplicate, because the same photo genuinely does arrive twice.** The picker, drag-and-drop and
paste all feed the same list, and a user who drops a file and then also selects it is not doing
anything unusual.

⚠️ **`name` + `size` + `lastModified` is a heuristic, not an identity.** It is right often enough to
be worth doing and cheap enough that nothing more is warranted, but two different files can collide
on all three. Use it to skip an obvious duplicate; never as a storage key or a cache key.

## Every entry point feeds the same function

```js
// drag and drop — both preventDefault calls are mandatory
zone.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
zone.addEventListener('drop', (e) => { e.preventDefault(); addPhotos([...e.dataTransfer.files]); });

// paste a screenshot — three lines, and users expect it
form.addEventListener('paste', (e) => {
  const files = [...e.clipboardData.files];
  if (files.length) addPhotos(files);
});
```

**`addPhotos` is the only door.** Limits, deduplication and validation live there once, rather than
three times in three handlers — which is how a form ends up enforcing "five photos" through the
picker and accepting twelve by drag-and-drop.

⚠️ **`accept="image/*"` filters the picker's view and nothing else.** The user can switch it to *all
files*, and drag-and-drop ignores it entirely. It is a convenience, never a control
([04 · A file you cannot trust](./04-a-file-you-cannot-trust.md)).

## Previews: an object URL, and the revoke that goes with it

```js
`<img src="${record.previewUrl}" alt="" width="120" height="120" loading="lazy">`
```

**`URL.createObjectURL(file)` is the right preview** — it hands the browser a handle to bytes it
already has, and costs no read. `FileReader.readAsDataURL` reads the whole file into a base64 string
about a third larger than the original, to produce a preview that looks identical
([Phase 11 · 12 · 02 · Object URLs](../../phase-11-network-storage/12-blob-file-filereader/02-object-urls.md)).

🔴 **Every `createObjectURL` needs a matching `revokeObjectURL`.** The URL pins the file's bytes
until the document is discarded or you revoke it, so nothing is garbage-collected while the form is
open. The leak is invisible in development — one 4 MB photo — and entirely real on a phone, where a
user adds, removes and re-adds a dozen shots of the same sofa before choosing three.

```js
function removePhoto(id) {
  const i = photos.findIndex((p) => p.id === id);
  if (i === -1) return;
  const [record] = photos.splice(i, 1);
  record.controller?.abort();            // 🔴 stop the upload as well
  URL.revokeObjectURL(record.previewUrl);
  render();
}
```

🔴 **Removing a photo is three actions, not one.** Drop the record, abort its in-flight request, and
revoke its object URL. Skip the abort and the connection stays busy uploading something nobody will
ever see — and its success handler still runs, which is how a removed photo reappears in the
attachment list.

⚠️ **Revoke on submit too**, once the previews are gone. And revoke *late* rather than early: a URL
revoked while the `<img>` is still decoding gives a broken thumbnail.

**`width` and `height` on the thumbnail are not decoration.** They reserve the box before the image
decodes, so adding five photos does not shove the submit button down the page under the user's
cursor ([11 · 02 · Images that do not shift](../11-infinite-scroll-and-lazy-images/02-images-that-do-not-shift.md)).

## Rendering from the records

```js
function render() {
  list.innerHTML = photos.map(row).join('');
  submit.disabled = photos.some((p) => p.status === 'uploading');
}
```

**The list is a pure function of `photos`** — status text, progress, the retry button and the remove
button all read from the record. That is the payoff for modelling it as records in the first place:
there is exactly one place a photo's state lives, and the DOM is a view of it.

⚠️ **Do not re-render the whole list on every progress event.** Progress fires many times per
upload; replacing `innerHTML` each time destroys and rebuilds the `<img>` elements, which restarts
decoding and can blank the thumbnails. Update the one progress element in place and keep the full
`render()` for structural changes.

## Gotchas

**Symptom: picking more photos replaced the ones already attached.**
Cause — the handler assigns from `input.files` instead of appending to the records.
Fix — merge into the list; treat `input.files` as an input event, not as state.

**Symptom: `photos.map is not a function`.**
Cause — a `FileList` was kept where an array was expected.
Fix — `[...input.files]` at the boundary.

**Symptom: re-picking a photo the user just removed does nothing at all.**
Cause — the input's value did not change, so no `change` event fired.
Fix — `input.value = ''` immediately after reading `files`.

**Symptom: the drop target never fires `drop`.**
Cause — no `preventDefault()` on `dragover`, so the element is not a valid drop target.
Fix — prevent the default on both `dragover` and `drop`.

**Symptom: the five-photo limit is enforced in the picker but not on drop.**
Cause — the limit lives in the `change` handler rather than in the shared add function.
Fix — one entry point that every source calls.

**Symptom: memory climbs steadily as the user tries different photos.**
Cause — object URLs created for previews and never revoked.
Fix — `revokeObjectURL` on remove and on submit.

**Symptom: a removed photo reappeared in the submitted review.**
Cause — the record was spliced out but its request was never aborted, so the success handler pushed
the id back.
Fix — an `AbortController` per record, aborted on remove, and ignore `AbortError`.

**Symptom: thumbnails flicker or go blank while an upload runs.**
Cause — a full `innerHTML` re-render on every progress event.
Fix — update the progress element in place.

## Interview questions

**★ Why not just keep `input.files` as the form's state?**
Because it is replaced on every `change`, it is read-only and array-like, and it has nowhere to hold
per-photo status, progress, errors or server ids. A review form needs to remove one photo and retry
another, and neither is expressible against a `FileList`.

**★ What is the object URL for, and what does forgetting to revoke it cost?**
It gives an `<img>` a handle to bytes the browser already holds, with no read and no copy. Until it
is revoked, those bytes cannot be freed — so a form where the user tries a dozen photos holds all
twelve in memory, on the device least able to spare it.

**★ Why does clearing `input.value` matter?**
`change` fires only when the value changes. Without clearing, re-selecting the same file after
removing it produces no event, and the form silently ignores the user.

**★ What are the three things that must happen when a photo is removed?**
Drop the record, abort its in-flight request, revoke its object URL. Missing the abort wastes
bandwidth and can resurrect the photo; missing the revoke leaks its bytes.

**★ Why funnel the picker, drag-and-drop and paste through one function?**
So the count limit, deduplication and validation exist once. Duplicating them across handlers is how
a form enforces its rules on one path and not the others.

---

[Topic index](./README.md) · [02 · Uploading and submitting](./02-uploading-and-submitting.md) →
