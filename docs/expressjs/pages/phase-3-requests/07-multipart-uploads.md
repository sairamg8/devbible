---
title: "Multipart uploads"
sidebar_label: "07 · Multipart"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

**`multipart/form-data` is not JSON. Use Multer 2.x (or equivalent) on Express 5.
Cap size, allow-list MIME types, and treat the file as untrusted input.**

> Verified: 2026-08-14 against the documentation and the npm registry — **no sandbox
> run**. Express ships **no multipart parser**: the built-in list is `json`,
> `urlencoded`, `raw`, `text`, `static`, `Router`
> ([express reference](https://expressjs.com/en/5x/api/express/)), which is why this is a
> package decision at all. Multer's `latest` is **2.2.0** (checked on the registry
> 2026-08-14; `next` is a 3.0 alpha), so "Multer 2.x" is current advice.
> Two warnings are Multer's own, quoted from its
> [README](https://github.com/expressjs/multer): *"uploading very large files, or
> relatively small files in large numbers very quickly, can cause your application to
> run out of memory when memory storage is used"*, and *"never add multer as a global
> middleware since a malicious user could upload files to a route that you didn't
> anticipate."* Note `limits.fileSize` **defaults to `Infinity`** — an uncapped upload is
> the default, not an oversight you have to introduce.
>
> ⚠️ **Where the docs stop:** Multer's README carries **no** explicit warning about
> sanitising `originalname` or distrusting the client-supplied `mimetype`. Those two
> cautions on this page are standard input-validation reasoning, not quotable upstream
> guidance — treat them as this bible's advice.

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

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [multer](https://expressjs.com/en/resources/middleware/multer/) — expressjs.com: v2.4.0, built on busboy; no `dest` means memory storage; `limits`, `fileFilter`; "Never add multer as a global middleware" (*read*)
- **Beyond the docs:** [Handling File Uploads with Multer in Node.js](https://betterstack.com/community/guides/scaling-nodejs/multer-in-nodejs/) — Stanley Ulili, Better Stack, updated 11 Apr 2025: end-to-end disk versus memory storage, `fileFilter`, `limits` and `LIMIT_*` error handling in runnable code (its filter checks the extension only)
- **Read this:** [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — OWASP: sections on extension and Content-Type allowlists, file signature (not alone), filename safety, storage location, size limits (*read* those sections)
- **Beyond the docs:** [Secure API file uploads with magic numbers](https://transloadit.com/devtips/secure-api-file-uploads-with-magic-numbers/) — Tim Koschützki, Transloadit, 2 Jun 2025, updated 30 Sep 2026: Express plus Multer plus `file-type` endpoint that detects the real format from bytes, with 400/413/415 responses, a test plan for spoofed types, and an honest list of what signature checks do not catch

{/* LINKMAP:END */}

---

← Prev: [raw and text](06-raw-and-text.md) · Next → [Cookies and helpers](08-cookies-and-helpers.md)
