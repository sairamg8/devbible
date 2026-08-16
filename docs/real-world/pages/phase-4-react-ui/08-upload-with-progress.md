---
title: "Upload with progress"
sidebar_label: "08 · Upload with progress"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN (`XMLHttpRequest.upload`, `FormData`,
> `createImageBitmap`, canvas `toBlob`) and react.dev. Concept home:
> [JavaScript phase 18 — review uploads](../../../javascript/pages/README.md)
> owns the platform mechanics (File, resize, the untrusted-file story);
> the server half is [chapter 3·08](../phase-3-express-api/08-the-uploads-endpoint.md).

## The problem

The review form's photo field: pick up to three images, see per-file
progress, resize on-device before sending (a 12 MB phone photo into a
5 MB server limit — the resize is UX, [the server limit is
law](../phase-2-node-services/03-the-upload-service.md)), cancel mid-
flight, and survive one file failing without losing the others. The
platform work — reading Files, canvas resizing, why `fetch` still has no
upload progress and `XMLHttpRequest.upload` does — is JavaScript phase
18's material; this chapter is the React state machine over it.

## The implementation

```jsx
// src/lib/uploadImage.js — one file: resize, then XHR with progress
export function uploadImage(file, {reviewId, onProgress, signal}) {
  return new Promise(async (resolve, reject) => {
    try {
      const blob = await downscale(file, 2048);       // phase-18's technique
      const form = new FormData();
      form.append('image', blob, file.name);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/uploads/reviews/${reviewId}/images`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          const body = safeJson(xhr.responseText);
          reject(Object.assign(new Error(body?.title ?? `HTTP ${xhr.status}`),
            {code: body?.code}));
        }
      };
      xhr.onerror = () => reject(new Error('network error'));
      signal?.addEventListener('abort', () => {
        xhr.abort();
        reject(Object.assign(new Error('cancelled'), {name: 'AbortError'}));
      });
      xhr.send(form);
    } catch (err) { reject(err); }
  });
}

async function downscale(file, maxEdge) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) return file;
  const canvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({type: 'image/webp', quality: 0.85});
}

const safeJson = (t) => { try { return JSON.parse(t); } catch { return null; } };
```

```jsx
// src/hooks/useUploads.js — the per-file state machine
import {useRef, useState} from 'react';
import {uploadImage} from '../lib/uploadImage.js';

export function useUploads({reviewId, maxFiles = 3}) {
  const [files, setFiles] = useState([]);   // {id, name, status, progress, error, key}
  const controllers = useRef(new Map());

  const patch = (id, delta) =>
    setFiles((fs) => fs.map((f) => f.id === id ? {...f, ...delta} : f));

  function add(fileList) {
    const room = maxFiles - files.filter((f) => f.status !== 'error').length;
    for (const file of [...fileList].slice(0, room)) {
      const id = crypto.randomUUID();
      const controller = new AbortController();
      controllers.current.set(id, controller);
      setFiles((fs) => [...fs, {id, name: file.name, status: 'uploading',
                                progress: 0, error: null, key: null}]);
      uploadImage(file, {
        reviewId,
        signal: controller.signal,
        onProgress: (p) => patch(id, {progress: p}),
      }).then(
        (res) => patch(id, {status: 'done', progress: 1, key: res.images[0]}),
        (err) => {
          if (err.name === 'AbortError') {
            setFiles((fs) => fs.filter((f) => f.id !== id));   // cancelled = gone
          } else {
            patch(id, {status: 'error', error: err.code ?? 'FAILED'});
          }
        },
      ).finally(() => controllers.current.delete(id));
    }
  }

  const cancel = (id) => controllers.current.get(id)?.abort();
  const keys = files.filter((f) => f.status === 'done').map((f) => f.key);
  return {files, add, cancel, keys,
          busy: files.some((f) => f.status === 'uploading')};
}
```

The review form renders `files` as thumbnail rows with progress bars and
a cancel ✕; submit is disabled while `busy`, and the final review POST
carries `keys` — the uploads happened *before* submit, so the form's
last step is small and fast.

## The decisions

- **Resize before upload, and say why honestly.** On-device downscaling
  turns 12 MB into ~300 kB — the difference between a 30-second cellular
  upload and a one-second one. It is *not* a security measure: the
  server re-sniffs and re-limits every byte
  ([3·08](../phase-3-express-api/08-the-uploads-endpoint.md)), because
  this code runs on the attacker's machine.
- **XHR for the transfer, on purpose.** Upload progress events are still
  `XMLHttpRequest.upload` territory (fetch's request-stream story
  doesn't deliver progress portably) — a narrow, contained XHR island
  behind a promise interface, the one place in the app that isn't
  `fetch`. The JS-section pages carry the full comparison.
- **Upload-on-pick, not upload-on-submit.** The user picks photos, then
  writes the review text — the photos upload *during* the writing.
  Perceived wait collapses to zero; the cost is orphaned objects when
  a review is abandoned, which the
  [sweep design](../phase-2-node-services/05-scheduled-jobs.md) already
  prices in.
- **Cancelled files vanish; failed files stay.** A cancel is the user
  changing their mind — no residue. A failure is information they need
  (which file, retryable?) — it stays visible with its error until
  dismissed or retried. State machines encode UX policy; this is that
  policy, written down.

## Gotchas

- **Symptom:** progress jumps to 100% instantly, then hangs. **Cause:**
  progress measured on the *response* (`xhr.onprogress`) not the
  *upload* (`xhr.upload.onprogress`) — uploads are the sent direction.
  **Fix:** the `.upload` handler above; the JS-section page explains the
  two streams.
- **Symptom:** HEIC photos from iPhones fail with `BAD_TYPE`. **Cause:**
  `createImageBitmap` decoded it locally, but the un-resized fallback
  path (`scale === 1`) sent the original HEIC, which the server's
  allow-list rejects. **Fix:** always re-encode (`convertToBlob` to
  webp) even at scale 1 for non-allowed source types — one condition on
  `file.type`, and the server list stays the single source of what is
  acceptable.
- **Symptom:** three rapid picks upload five files. **Cause:** the room
  calculation read stale `files` (closure) while adds raced. **Fix:**
  compute room inside a functional `setFiles` update, or cap
  server-side anyway — which [3·08's `maxFiles`](../phase-3-express-api/08-the-uploads-endpoint.md)
  does regardless, because client caps are courtesy.

## Interview questions

1. **★ Why does client-side resizing not relax anything server-side?**
   Because the client is optional: an attacker posts multipart directly.
   The resize optimizes the honest path (upload time, mobile data); the
   server's stream limit and byte sniffing remain the enforcement for
   every path. Any control that only exists client-side is a UX
   feature, never a boundary — the whole track's recurring law.
2. **★ Why upload on pick rather than on submit?** It overlaps the
   transfer with the user's slowest activity (writing), so the wait
   effectively disappears; failures surface early enough to fix; submit
   becomes a tiny JSON POST that rarely fails. The trade — orphans from
   abandonment — moves cleanup to a scheduled sweep, which is cheap and
   already exists. This is latency *hiding*, the strongest kind of
   latency optimization.
3. **Per-file cancel needs what pieces?** An addressable in-flight
   registry (the `controllers` map keyed by file id), a transfer
   primitive that aborts (`xhr.abort` bridged from an `AbortSignal`),
   and a state decision for the aborted row. The interview follow-up —
   "why a Map in a ref, not state?" — answers itself: controllers are
   not renderable data, and storing them in state would re-render on
   bookkeeping.

---

← Prev: [Modal, portal and focus trap](07-modal-portal-focus.md) ·
Next → **Auth in the client** *(not written yet)*
