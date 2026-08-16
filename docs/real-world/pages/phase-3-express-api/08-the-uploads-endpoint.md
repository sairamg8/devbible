---
title: "The uploads endpoint"
sidebar_label: "08 · The uploads endpoint"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the busboy docs and Express 5 docs. Concept home:
> the [upload service](../phase-2-node-services/03-the-upload-service.md) this
> endpoint feeds, and
> [Node — request bodies are streams](../../../nodejs/pages/phase-5-http-processes/02-request-bodies.md).

## The problem

Phase 2's upload service consumes a stream and does everything hard —
limits, sniffing, atomic writes. This chapter is the HTTP skin: multipart
parsing that *stays* streaming, per-surface rules (admin product images vs
customer review photos), and the metadata write that ties an object key to
its row. Thin on purpose — the mistakes here are all about accidentally
buffering or trusting the wrapper to do the service's job.

## The surface

| Route | Auth | Accepts | Writes |
|---|---|---|---|
| `POST /uploads/products/:id/images` | admin | up to 8 images | `product_images` rows |
| `POST /uploads/reviews/:id/images` | owner of the review | up to 3 images | `review_images` rows |
| `GET /uploads/images/:key` | public | — | streams the object out |

## The implementation

```js
// src/routes/uploads.js
import express from 'express';
import busboy from 'busboy';
import {ApiError} from '../middleware/errors.js';
import {requireAuth, requireRole} from '../middleware/require.js';

export function buildUploadRoutes({uploads, pool}) {
  const router = express.Router();

  function multipartImages({maxFiles}) {
    return (req, res, next) => {
      const bb = busboy({
        headers: req.headers,
        limits: {files: maxFiles, fields: 0, fileSize: 5 * 1024 * 1024},
      });
      const stored = [];
      const work = [];

      bb.on('file', (_name, stream) => {
        // hand the stream STRAIGHT to the service — never a buffer
        work.push(
          uploads.put(stream)
            .then((r) => stored.push(r))
            .catch((err) => { stream.resume(); throw err; }),
        );
      });
      bb.on('filesLimit', () =>
        work.push(Promise.reject(
          new ApiError(400, 'TOO_MANY_FILES', `max ${maxFiles} images`))));
      bb.on('close', async () => {
        try {
          await Promise.all(work);
          req.uploaded = stored;
          next();
        } catch (err) {
          // best-effort undo of the ones that landed
          await Promise.allSettled(stored.map((s) => uploads.remove(s.key)));
          next(err);
        }
      });
      bb.on('error', next);
      req.pipe(bb);
    };
  }

  router.post('/products/:id/images', requireRole('admin'),
    multipartImages({maxFiles: 8}), async (req, res, next) => {
      try {
        const values = req.uploaded.map((u, i) =>
          [req.params.id, u.key, i]);
        for (const [productId, key, pos] of values) {
          await pool.query(
            `insert into product_images (product_id, object_key, position)
             select id, $2, coalesce((select max(position) + 1
                from product_images where product_id = $1), 0) + $3
               from products where id = $1`,
            [productId, key, pos]);
        }
        res.status(201).json({images: req.uploaded.map((u) => u.key)});
      } catch (err) { next(err); }
    });

  router.get('/images/:key(*)', async (req, res, next) => {
    try {
      const stream = await uploads.createReadStream(req.params.key);
      res.set('cache-control', 'public, max-age=31536000, immutable');
      stream.on('error', () =>
        next(new ApiError(404, 'NOT_FOUND', 'image not found')));
      stream.pipe(res);
    } catch (err) { next(err); }
  });

  return router;
}
```

The review-images route is the same shape with `maxFiles: 3` and an
ownership check ([chapter 04's `ForUser` rule](04-authorization.md)) on the
review id — the position cap `0..2` is already the
[schema's constraint](../phase-1-database/01-the-schema/02-carts-orders-reviews-outbox.md).

## What to notice

- **The router adds *count* limits; the service owns *byte* and *type*
  limits.** busboy's `fileSize` limit is a belt over the service's
  braces — but the sniffing and the atomic write stay in one place. Two
  layers enforcing the same 5 MB is fine; two layers *owning* it would
  drift.
- **`fields: 0`** — these routes take files only. Multipart fields that
  need parsing alongside files are the classic scope creep; metadata
  (alt text, ordering) travels as JSON in a separate PATCH, keeping each
  request one discipline.
- **Failure undoes the batch.** If image 3 of 4 fails sniffing, the two
  already stored are removed and the response is one error — partial
  upload state pushed to the client ("some succeeded, guess which") is
  the API design that generates support tickets. The `.tmp`-sweep
  backstop ([2·05](../phase-2-node-services/05-scheduled-jobs.md)) catches
  what the best-effort undo misses.
- **Immutable cache headers on `GET`.** Keys are
  [random and never reused](../phase-2-node-services/03-the-upload-service.md),
  so a year of `immutable` is simply true — and it is what lets Nginx or a
  CDN take this route over without any API change.
- **The stored `contentType` is what gets served** — never sniffed again,
  never derived from the key. One sniff at write time, trusted thereafter.

## Gotchas

- **Symptom:** uploads over ~100 kB fail with `PayloadTooLargeError` before
  reaching busboy. **Cause:** the global `express.json({limit:'100kb'})`
  caught the multipart body — mount order or path matching is off.
  **Fix:** [the structure chapter's rule](01-project-structure.md): the
  uploads router owns its own body handling; `express.json` must not match
  these routes (it checks `Content-Type`, so a correct global mount is
  safe — the failure appears when someone adds a permissive
  `type: () => true`).
- **Symptom:** memory spikes on concurrent large uploads despite the
  streaming service. **Cause:** a "progress" middleware buffering chunks,
  or `bb.on('file')` collecting streams into an array *for later* — a
  paused stream buffers in the socket, a collected one in heap. **Fix:**
  streams are consumed the tick they arrive (the `work.push` shape);
  anything "for later" must be the *result*, never the stream.
- **Symptom:** the undo left orphaned objects when the process crashed
  mid-batch. **Cause:** best-effort cleanup is best-effort. **Fix:** by
  design — orphaned *objects* (stored, no DB row) are swept by comparing
  `object_key`s against the tables in the weekly variant of the sweep
  job; the invariant that matters (no DB row without its object) is
  preserved by writing rows only after `put` succeeds.

## Interview questions

1. **★ Why must the file stream go straight from busboy to the service?**
   Every intermediate representation is a buffer: an array of chunks, a
   temp copy, a base64 field. The service was built to consume a stream
   with constant memory and abort mid-flight; anything between the socket
   and it either re-buffers (defeating the memory bound) or re-implements
   limits (defeating the single-owner rule).
2. **★ Why do rows get written after storage, not before?** Order decides
   the orphan type. Row-first leaves rows pointing at nothing — user-visible
   broken images. Storage-first leaves unreferenced objects — invisible,
   swept later. When a two-step write must fail somewhere, choose the
   failure users can't see; it is the upload-shaped version of the
   [outbox's send-then-mark](../phase-2-node-services/04-outbox-relay-and-email.md)
   reasoning.
3. **Why is `GET /uploads/images/:key` in the API at all if Nginx should
   serve files?** The API is the *contract*; the serving location is
   deployment detail. Shipping the route makes development and small
   deployments whole, and the immutable-cache + opaque-key design means
   moving it behind Nginx (or a CDN, or S3 URLs) later changes
   infrastructure, not clients. Premature "the CDN will do it" leaves dev
   broken now for a topology that may change twice more.

---

← Prev: [The checkout endpoint](07-the-checkout-endpoint.md) ·
Next → **The error contract** *(not written yet)*
