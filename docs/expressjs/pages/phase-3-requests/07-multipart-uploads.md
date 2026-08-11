---
title: "Multipart uploads"
sidebar_label: "07 · Multipart"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

**`multipart/form-data` is not JSON. Use Multer 2.x (or equivalent) on Express 5.
Cap size, allow-list MIME types, and treat the file as untrusted input.**

## Boundary responsibilities

| Layer | Job |
|---|---|
| Multer (or peer) | Parse multipart, enforce counts/sizes, memory vs disk |
| Your handler | Validate MIME/extension, virus scan if needed, store |
| Object storage | Durable bytes — not your API process disk long-term |

```js
// conceptual mount — install multer@2 in the real app
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 5 * 1024 * 1024, files: 1},
  fileFilter(req, file, cb) {
    if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
      cb(new Error('unsupported type'));
      return;
    }
    cb(null, true);
  },
});

// app.post('/avatar', upload.single('avatar'), handler)
```

> Pin **multer@2** for Express 5 lines. Verify peer dependency notes when you
> install — do not copy Express 4-only examples blindly.

## Never trust Content-Type alone

Clients lie. Prefer file-signature checks for sensitive pipelines; at minimum
allow-list declared MIME **and** cap size. Filename from the client is hostile —
generate your own object keys.

## Trade-off

Memory storage is simple and blows RAM on large files. Disk/streaming storage
scales and needs cleanup on failure paths (Node large-payload patterns).

## Gotchas

**Symptom:** `Unexpected field`  
**Cause:** Field name mismatch (`avatar` vs `file`)  
**Fix:** Align client form field with `upload.single('…')`

**Symptom:** Files left in `/tmp` after errors  
**Cause:** No cleanup on failed handlers  
**Fix:** `try/finally` remove temp paths

**Symptom:** Parser hangs on huge upload  
**Cause:** No size limit  
**Fix:** `limits.fileSize` + reverse-proxy body limits

## Interview questions

**★ Why not `express.json` for file upload?**  
Wrong encoding — files use multipart streams.

**What must you configure on Multer for production?**  
Size limits, file count, storage choice, and type filtering.

**Where should large files live after upload?**  
Object storage (S3-compatible), not the API container’s writable layer.

---

← Prev: [raw and text](06-raw-and-text.md) · Next → [Cookies and helpers](08-cookies-and-helpers.md)
