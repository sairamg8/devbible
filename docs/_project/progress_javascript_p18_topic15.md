---
name: devbible-javascript-p18-topic15
description: Live log for JavaScript phase 18 topic 15 · Review uploads — session 0e830881. Chunk plan, per-file state, the MDN claims and the traps.
metadata:
  type: progress
---

# JS phase 18 · topic 15 · Review uploads — session `0e830881`

🏁 **COMPLETE, 2026-08-15 — 4 chunks + index, 1,118 lines, 0 over the 300-line cap, every link
resolved.** This was **the last unwritten topic in the whole JavaScript corpus**: topic 12 landed
the same day from session `78e4bc26`, so **phase 18 closed at 10/10 in scope and JavaScript's active
queue is empty**. 🔴 **Stop here** — do not pick up another language and do not un-park phases
13–15 without a new instruction.

⚠️ **It closed link-checked, not built** (rule 12 — no unclaimed build). Every `.md` target in all
five files was resolved against the filesystem; a Docusaurus build has **not** run over them.

Commits: `60aa5b10` (01) · `9e151a37` (02) · `4cb4072c` (03) · `d6507fa2` (04) · `915de874`
(index + all four boards).

**Syllabus row (Understand):** *Review uploads — `FormData`, upload progress, client-side image
resize through Canvas, and validating a file you cannot trust.*

## The chunk plan — 4 files, not 3

`docs/javascript/pages/phase-18-storefront/15-review-uploads/`

| # | File | State | Lines | Covers |
|---|---|---|---|---|
| 01 | `01-the-photo-list.md` | ✅ committed `60aa5b10` | 232 | records vs `FileList`, append-never-replace, `input.value=''`, dedupe by name+size+lastModified, one entry point for picker/drop/paste, object-URL previews and the revoke, remove = drop + abort + revoke, render from records |
| 02 | `02-uploading-and-submitting.md` | ✅ committed `9e151a37` | 292 | one request per photo (table of why), the two `FormData` traps, `postWithProgress` via `xhr.upload`, cancel/retry, the ids-not-bytes submit, `beforeunload` + draft persistence, a11y |
| 03 | `03-resizing-before-upload.md` | ✅ committed `4cb4072c` | 292 | `createImageBitmap` (`imageOrientation` default `from-image`, `resizeWidth`/`resizeQuality`), canvas + `toBlob`, `OffscreenCanvas.convertToBlob` in a worker, format/quality choice, canvas max size, when NOT to resize |
| 04 | `04-a-file-you-cannot-trust.md` | ✅ committed `d6507fa2` | 239 | the validation ladder (type/size/count → magic bytes → decode → server), re-encode strips EXIF/GPS, SVG, untrusted `name`, serving user content back safely, what only the server can do |
| — | `README.md` + `_category_.json` | ✅ committed `915de874` | 63 | chunk table, four carry-out facts, phase gate, "Where this connects" |

**Boards updated in `915de874`:** `src/data/progress.js` (phase 18 → `pages: 10`, `pagesPlanned`
dropped) · `phase-18-storefront/README.md` (row 15 linked, status → 10/10 COMPLETE, banner and
verification note) · `docs/javascript/pages/README.md` (phase row, chunk-D row → FINISHED, START
HERE table) · `docs/README.md` (chunk-D claim row, JavaScript technology row → **268 of 316 in
scope / 526 leaf pages**, active queue empty).

⚠️ **It was going to be 3 chunks.** The first draft of "the review form" came out at **310 lines**,
over the cap, so it was split on the concept boundary — the *list* of photos vs *sending* them —
rather than trimmed. Rule 1, working as intended.

## Load-bearing claims, all MDN-validated 2026-08-15

- **`FormData.append(name, value, filename)`** — *"The default filename for `Blob` objects is
  `"blob"`. The default filename for `File` objects is the file's filename."* 🔑 **This is the trap
  the resize chunk creates**: a canvas `Blob` uploads as `blob` unless the third argument is passed.
- **Never set `Content-Type` on a `FormData` body** — the browser adds the boundary parameter; a
  hand-written header has none and the server parses no fields.
- **`fetch` has no upload progress**; `xhr.upload`'s `progress` event does, and `lengthComputable`
  can be `false`. `Request.duplex: "half"` + `ReadableStream` body is the standards-track
  alternative and MDN marks it **experimental, not Baseline**.
- **`createImageBitmap` options** — `imageOrientation` defaults to **`"from-image"`** (*"Image
  oriented according to EXIF orientation metadata, if present (default)"*); `"none"` ignores EXIF.
  Also `resizeWidth`, `resizeHeight`, `resizeQuality` (`pixelated|low|medium|high`, default `low`),
  `premultiplyAlpha`, `colorSpaceConversion`. Accepts a `Blob` directly.
- **`drawImage` and EXIF** — MDN's own page says *"In some older browser versions, `drawImage()`
  will ignore all EXIF metadata in images, including the Orientation. This behavior is especially
  troublesome on iOS devices."* → prefer `createImageBitmap` over `<img>` + `drawImage`.
- **CSS `image-orientation` initial value is `from-image`**, so `<img>` previews are rotated
  correctly by default — which is exactly why a canvas that ignores EXIF produces a *sideways* copy
  of a preview that looked upright.
- **`canvas.toBlob(callback, type, quality)`** — default `image/png`, also used *"if the given type
  isn't supported"*; `quality` 0–1 applies only to lossy formats; **the callback may receive
  `null`** if the image cannot be created.
- **`OffscreenCanvas.convertToBlob({type, quality})`** returns a promise, is available in workers,
  and rejects with `InvalidStateError` / `SecurityError` / `IndexSizeError` / `EncodingError`.
- **Canvas max size** — MDN: *"in most cases the maximum dimensions exceed 10,000 x 10,000 pixels,
  notably iOS devices limit the canvas size to only 4,096 x 4,096 pixels"*, and *"Exceeding the
  maximum dimensions or area renders the canvas unusable — drawing commands will not work."*
- **`HTMLImageElement.decode()`** rejects with **`EncodingError`** when the data is corrupted — the
  documented basis for a client-side "does this actually decode as an image?" check.

## Rules this session is working under

- **No sandbox, no console blocks, no timings** (rule 8) — every page is documentation-validated
  with the MDN pages named on the `> Verified:` line.
- 🔴 **Rule 12 (new, 2026-08-15): no dev server, no build without claiming the registry row.** This
  session registered in `shared/session_build_devserver_registry.md` as running **neither**, and
  verifies links by resolving each `.md` target against the filesystem plus `wc -l` for the cap.
  ⚠️ **The topic will close link-checked, not built** — say that plainly rather than implying a
  green build.
- **Per-file cadence** — write a file → `wc -l` + link-check → commit → memory.
- **Shared files:** `phase-18-storefront/README.md`, `src/data/progress.js`,
  `docs/javascript/pages/README.md`, `docs/README.md`. Edit **only topic 15's row** and the counts
  that follow from it. **Never `git add -A`.**
- **No link to topic 12** — bold plain text with *(not written yet)* until its files land.

## Overlap map — what this topic must NOT re-teach

Phase 11 already owns the mechanics, in depth:

- `11-uploading-files/01-getting-the-file.md` — input, `FileList`, `accept`, drag/drop, paste,
  magic bytes, untrusted `name`
- `11-uploading-files/02-sending-it.md` — `FormData`, the `Content-Type` trap, `xhr.upload`, abort
- `11-uploading-files/03-scale-and-the-server.md` — chunking, presigned URLs, the five server rules
- `12-blob-file-filereader/*` — `Blob`/`File`, `slice`, object URLs and revoking

**So topic 15 is the *feature*:** the per-photo record model, the upload-early/submit-ids
architecture, the canvas resize pipeline (**genuinely new — nothing else in the corpus covers it**),
and the trust ladder framed as a storefront problem. Where a mechanic is needed, it is restated in
one line and linked, not re-explained.

Related: [[devbible-javascript-split-4way]] · [[session-build-devserver-registry]]
