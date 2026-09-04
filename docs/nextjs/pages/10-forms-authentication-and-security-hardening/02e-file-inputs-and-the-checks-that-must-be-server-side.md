---
title: "A file upload arrives with three attacker-controlled strings — name, type and size — and `z.file().mime()` checks the one the browser was told to send, so the schema is where the UX lives and the server is where the truth is"
sidebar_label: "02e · File inputs"
sidebar_position: 107
description: "z.file() and its min/max/mime checks, why File.type is a claim rather than a fact, why the body cap fires before your schema does, never using the client's filename as a storage key, and why serving user uploads from your own origin is a stored-XSS decision."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the [Zod API reference — Files](https://zod.dev/api), the Next.js [`serverActions`](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) reference (`lastUpdated: 2026-06-25`), [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (`lastUpdated: 2026-06-25`), and MDN's [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) documentation. `z.file()` checks **probed on the installed package** (`zod` **4.4.3**).
> Target: **Next.js 16.3.4 · zod 4.4.3**. Documentation-verified; **no sandbox run**.

**A `File` that reaches your Server Action is a bag of bytes with three labels attached, and all three were written by the client. The name is a string the browser copied from the filesystem, the MIME type is usually the operating system's guess from the extension, and the size is the only one of the three the transport actually enforces. Validating a file therefore splits cleanly in two: the schema checks the labels, which is genuinely useful for telling a user they picked the wrong thing, and the server checks the bytes, which is the part that stops an attack.**

## What the schema can check

```ts
const fileSchema = z.file();

fileSchema.min(10_000); // minimum .size (bytes)
fileSchema.max(1_000_000); // maximum .size (bytes)
fileSchema.mime("image/png"); // MIME type
fileSchema.mime(["image/png", "image/jpeg"]); // multiple MIME types
```

Probed on zod 4.4.3: an undersized file produces a `too_small` issue and a disallowed type produces `invalid_value`, so both are ordinary field errors that render through the machinery in [02c](02c-field-errors-in-a-shape-the-form-can-render.md).

In a form schema:

```ts filename="lib/schemas/avatar.ts"
import { z } from 'zod'

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const AVATAR_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const

export const AvatarSchema = z.object({
  avatar: z
    .file()
    .min(1, { error: 'Choose a file.' })
    .max(MAX_AVATAR_BYTES, { error: 'Images must be under 2 MB.' })
    .mime([...AVATAR_MIME], { error: 'PNG, JPEG or WebP only.' }),
})
```

`.min(1)` is not decoration. **An empty file input still submits a `File`** — probed: it has `size` of `0` and an empty `name`, so a schema without a minimum accepts "no file chosen" as a valid upload.

## What the schema cannot check

**`File.type` is a claim.** The browser fills it in from the operating system's association for the extension; nothing inspects the bytes. Renaming `payload.html` to `payload.png` produces a `File` whose `type` is `image/png`, and `z.file().mime(['image/png'])` accepts it. The `accept` attribute on the input is weaker still — it filters the file picker's default view and can be bypassed by drag-and-drop or by any client that is not a browser.

So `.mime()` is a **user-experience check**: it tells someone who picked a PDF for their avatar what went wrong, immediately and in the right place. The control is a content check on the server:

```ts filename="data/avatars.ts"
import 'server-only'

const SIGNATURES: ReadonlyArray<{ mime: string; bytes: readonly number[]; offset: number }> = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP" after RIFF size
]

/** Reads only the header, not the whole file. */
export async function sniffMime(file: File): Promise<string | null> {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  for (const { mime, bytes, offset } of SIGNATURES) {
    if (bytes.every((b, i) => header[offset + i] === b)) return mime
  }
  return null
}

export async function assertRealImage(file: File, allowed: readonly string[]) {
  const actual = await sniffMime(file)
  if (!actual || !allowed.includes(actual)) {
    throw new Error('UNSUPPORTED_FILE_CONTENT')
  }
  return actual
}
```

Magic-byte sniffing is a floor, not a ceiling: a file can begin with a valid PNG signature and still contain something hostile further in. It rules out the trivial rename, which is the attack you will actually see. For anything that will be decoded — images especially — the stronger move is to re-encode server-side with a hardened library and store the output, so whatever the input was, what you keep is a file your own encoder produced.

## The size check that fires first

`z.file().max()` produces a field error. The transport-level cap does not: it rejects the request *before* your action runs, so the user gets a failed submission with no field message. The default is 1 MB and the arithmetic in [01e](01e-the-request-envelope-csrf-size-rate-limits-and-idempotency.md) applies — the limit covers the whole multipart body, envelope bytes included.

**Order the two limits so the schema is what speaks.** Set `bodySizeLimit` comfortably above the largest file the schema allows, and let `.max()` produce the message:

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: {
      // Schema allows 2 MB per image; leave room for other fields and multipart overhead.
      bodySizeLimit: '3mb',
    },
  },
}
```

Also add the client-side hint so the browser can reject an obviously oversized pick without a round trip — while remembering it is a hint:

```tsx
<input type="file" name="avatar" accept="image/png,image/jpeg,image/webp" />
```

For genuinely large files, do not raise the cap. The Backend for Frontend guide's advice is to take the bytes out of the action entirely:

> *"Store user-generated static assets in dedicated services. When possible, upload them from the browser and store the returned URI in your database to reduce request size."*

The action then issues a short-lived, scoped upload target and later receives a key rather than a payload:

```ts filename="app/media/actions.ts"
'use server'

import { requireSession } from '@/data/session'
import { storage } from '@/lib/storage'
import { AVATAR_MIME, MAX_AVATAR_BYTES } from '@/lib/schemas/avatar'

export async function createAvatarUploadTarget(contentType: string) {
  const session = await requireSession()
  if (!AVATAR_MIME.includes(contentType as (typeof AVATAR_MIME)[number])) {
    return { ok: false as const, code: 'UNSUPPORTED_TYPE' as const }
  }
  // Constrain the target: our key, our size limit, our content type, one minute.
  const target = await storage.createSignedUploadUrl({
    key: `avatars/${session.user.id}/${crypto.randomUUID()}`,
    contentType,
    maxBytes: MAX_AVATAR_BYTES,
    expiresInSeconds: 60,
  })
  return { ok: true as const, url: target.url, key: target.key }
}
```

Note that the key is derived from the session, not from anything the client sent — which is the same rule as everywhere else in this chapter.

## The filename is not a path

`file.name` is an arbitrary string chosen by whoever made the request. It may contain `../`, a null byte, a Windows drive letter, right-to-left override characters that make `evil.php.gnp` render as `evil.png`, or four kilobytes of Unicode. Using it to build a storage path is how directory traversal happens; using it as the served URL is how a user gets to choose the extension your web server maps to a handler.

```ts filename="data/avatars.ts"
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const EXTENSION_FOR_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
}

export function storageKeyFor(userId: string, sniffedMime: string) {
  const ext = EXTENSION_FOR_MIME[sniffedMime]
  if (!ext) throw new Error('UNSUPPORTED_FILE_CONTENT')
  // Our id, our extension, derived from the bytes — nothing from the client.
  return `avatars/${userId}/${randomUUID()}${ext}`
}

/** If you must keep the original name for display, keep it as data, never as a path. */
export function displayName(raw: string) {
  return path.basename(raw).replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E]/g, '').slice(0, 120)
}
```

The original name belongs in a database column, rendered as text and set as the `filename` in a `Content-Disposition` header when the file is downloaded. It never belongs in the key.

## Serving what you accepted

Where the uploaded file is served from is a security decision, not an infrastructure detail. A file served from your own origin runs in your origin: an SVG containing a `script` element, an HTML file, or anything a browser is willing to sniff as markup becomes stored cross-site scripting with access to your cookies and your session. The mitigations that matter:

- Serve user content from a **separate origin** — a different domain, not a path on yours — so the same-origin policy is doing the work.
- Send `Content-Disposition: attachment` and a `Content-Type` **you** chose from the sniffed type, never the client's.
- Send `X-Content-Type-Options: nosniff` so the browser does not second-guess it.
- Keep the chapter's Content Security Policy in place as the backstop: [10 · CSP with nonces](10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md) and [11 · CSP without nonces](11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md).
- If SVG must be accepted, sanitise it or rasterise it. There is no allow-list of SVG features that is both safe and useful.

## Gotchas

**★ Symptom: submitting the form with no file chosen creates an avatar record for a zero-byte file.** Cause: an empty file input still submits a `File` — probed on zod 4.4.3, `size` is `0` and `name` is the empty string, so a `z.file()` with no minimum accepts it. Fix: `.min(1)`, with a message that says "choose a file" rather than "file too small".

```ts
avatar: z.file().min(1, { error: 'Choose a file.' }).max(MAX_AVATAR_BYTES)
```

**★ Symptom: `.mime(['image/png'])` passes for a file that is not an image.** Cause: `File.type` is supplied by the client, derived from the extension by the operating system; renaming a file changes it. Fix: keep `.mime()` for the message and sniff the bytes in the Data Access Layer.

```ts
const actualMime = await assertRealImage(file, AVATAR_MIME) // throws on a rename
const key = storageKeyFor(session.user.id, actualMime)
```

**★ Symptom: a file just over the limit fails with a transport error and no field message.** Cause: `bodySizeLimit` is enforced before the action runs, so the schema never sees the request. Fix: set the transport cap above the schema's maximum plus the other fields plus multipart overhead, so the schema is the layer that reports the problem.

**★ Symptom: uploaded files land outside the intended directory, or one user's upload overwrites another's.** Cause: the storage key was built from `file.name`, which may contain `../` and is not unique. Fix: generate the key from the session user id, a UUID and an extension derived from the sniffed content type; keep the original name as a display string only.

**★ Symptom: an uploaded SVG steals sessions when another user views the gallery.** Cause: SVG is markup, it can carry script, and it was served from the application's own origin — so it executed with your cookies. Fix: serve user content from a separate origin with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`, and sanitise or rasterise SVG rather than storing it verbatim.

**Symptom: memory spikes when several users upload at once.** Cause: `await file.arrayBuffer()` materialises the whole file, and every concurrent request holds its own copy. Fix: read only what you need for validation, and stream the rest to storage.

```ts
const header = new Uint8Array(await file.slice(0, 16).arrayBuffer()) // 16 bytes, not 2 MB
await storage.putStream(key, file.stream(), { contentType: actualMime })
```

**Symptom: a 40 KB PNG exhausts the process when it is resized.** Cause: a decompression bomb — small compressed input, enormous decoded bitmap. Fix: cap decoded dimensions in the image library before processing, and treat decoding as untrusted work: bounded, timed and ideally not in the request path.

**Symptom: React Hook Form's value for a file field is not a `File`.** Cause: `register('avatar')` yields the input's `FileList`, not a single file. Fix: unwrap it in a client-only schema — `FileList` is a DOM type and does not exist on the server, so this variant must not live in the module both sides import.

```ts filename="lib/schemas/avatar.client.ts"
// Client-only: FileList is a browser type.
export const AvatarClientSchema = z.object({
  avatar: z
    .instanceof(FileList)
    .transform((list) => list.item(0))
    .pipe(z.file().min(1).max(MAX_AVATAR_BYTES)),
})
```

**Symptom: the `accept` attribute was treated as validation and a non-image arrived anyway.** Cause: `accept` filters the file picker's default view; drag-and-drop, "All files" and any non-browser client ignore it. Fix: keep it for the picker, and never let it be the reason a server-side check was skipped.

**Symptom: a user's original filename is rendered on the page and breaks the layout, or looks like a different file type than it is.** Cause: the name is arbitrary text — control characters, thousands of code points, right-to-left overrides that reverse the visible extension. Fix: normalise and truncate before display, as `displayName` above does, and show the type from the sniffed MIME rather than from the name.

## Interview questions

**★ Why is `z.file().mime([...])` not a security control?**
Because it validates `File.type`, and that value was set by the client. Browsers derive it from the file extension via the operating system's associations, so renaming a file changes what the schema sees; a non-browser client sets it to whatever it likes. The check is still worth having — it produces an immediate, specific message for the honest user who picked the wrong file — but the decision about whether the bytes are acceptable has to be made on the server by looking at the bytes, and ideally by re-encoding them with a library you control.

**★ A file just above your limit produces a transport failure instead of a field error. Why, and how do you fix it?**
Because `serverActions.bodySizeLimit` is enforced on the raw HTTP body before the action executes, so the request never reaches your schema. The fix is ordering: set the transport cap above the largest total request the form can legitimately produce — the schema's file maximum, plus the other fields, plus multipart boundary and header overhead — so that the schema's `.max()` is the layer that rejects an oversized file and can say so next to the input.

**★ Why must the storage key never be derived from the uploaded filename?**
Because the filename is attacker-controlled text with no guarantees. It can contain path segments that escape the intended directory, control characters, or a second extension that changes how a web server treats the file. It is also not unique, so two users uploading `avatar.png` collide. Generating the key from the session user id, a UUID and an extension derived from the sniffed content type removes all of that, and keeps the original name where it belongs — as a display string in a database column.

**★ What is wrong with serving uploaded files from your own origin?**
Anything the browser interprets as markup executes in your origin. An SVG can contain a script element; an HTML file obviously can; and content sniffing can promote an ambiguous file into one of those. The result is stored cross-site scripting with full access to the victim's session on your domain. Serving user content from a separate origin makes the same-origin policy do the work, and `Content-Disposition: attachment` plus `X-Content-Type-Options: nosniff` plus a Content Security Policy are the layers underneath.

**★ Where should the file validation live — the schema, the action, or the Data Access Layer?**
All three, doing different jobs. The schema checks the labels and produces the field errors the form renders, and it is the copy the client also runs for instant feedback. The action does nothing but hand the parsed value on. The Data Access Layer authorizes the caller, sniffs the actual content, derives the storage key and writes — because that is the layer that is `server-only`, that already holds the session, and that an auditor can read in one sitting.

**When would you not accept the file in the Server Action at all?**
As soon as the files are big enough that raising `bodySizeLimit` starts to matter, which in practice is anything beyond a few megabytes. The documented alternative is to upload from the browser to dedicated storage and store the returned URI, so the action issues a short-lived signed target scoped to a key you chose and a size you set, and later receives only a key. That keeps your server out of the byte path, keeps the request cap low for every other action, and moves the bandwidth to a service designed for it.

---

← [02d · React Hook Form and the resolver](02d-react-hook-form-and-the-resolver.md) · [Chapter 10 overview](01-explanation.md) · Next → [03 · Authentication patterns](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md)
