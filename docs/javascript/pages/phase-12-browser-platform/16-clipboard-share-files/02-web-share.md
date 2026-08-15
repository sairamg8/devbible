---
title: "02 · Sharing"
sidebar_label: "02 · Sharing"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Navigator.share()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share), [`Navigator.canShare()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare), [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API), [Transient activation](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation), [`Permissions-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy). Documentation-validated; **no timings and no console output**. ⚠️ MDN notes support is **limited and not available in all widely-used browsers** — feature-detect and read the compatibility table.

The hack this replaces is the row of share buttons: a Twitter intent URL, a Facebook sharer URL, a
`mailto:` link, a WhatsApp link — a maintenance list of other companies' URL formats, none of which
knows what the user actually has installed. `navigator.share()` hands the job to the operating
system's own share sheet instead.

## The whole API

```js
shareBtn.addEventListener('click', async () => {
  try {
    await navigator.share({ title: document.title, text: 'Worth a read', url: location.href });
  } catch (err) {
    if (err.name !== 'AbortError') fallbackToCopyLink();   // 🔴 cancelling is not an error
  }
});
```

`share(data)` takes `title`, `text`, `url` and `files` — all optional, but **at least one
recognised property must be present**, and unknown properties alone are a `TypeError`. It resolves
with `undefined` when the share has been handed off.

| Requirement | Detail |
|---|---|
| Secure context | HTTPS only |
| **Transient activation** | it must come from a real user gesture, never a timer or page load |
| `web-share` permission policy | must be allowed — the embedder decides for an iframe |
| Valid data | at least one of `title` / `text` / `url` / `files` |

## The rejections, and what each one means

| Name | Meaning |
|---|---|
| `AbortError` | 🔴 **the user cancelled — or there were no share targets at all** |
| `NotAllowedError` | permission policy blocked it, activation was missing, or the file share was refused for security |
| `TypeError` | the data could not be validated — a bad URL, only unknown properties, files unsupported |
| `InvalidStateError` | the document is not fully active, or a share is already in progress |
| `DataError` | the target could not be started or the data could not be transmitted |

🔴 **`AbortError` covers both "the user changed their mind" and "there was nothing to share to",
and you cannot tell them apart.** That is a deliberate privacy design — the page never learns what
the user has installed or what they chose. Treat it as a no-op: no error toast, no retry, no
analytics event claiming a share happened.

⚠️ **You never learn whether the share succeeded.** The promise resolves when the sheet has taken
the data. Anything downstream — whether it was actually posted, to where — is unknowable by design,
so "shares" is not a metric this API can give you.

## Sharing files: ask first

```js
const data = { files, title: 'Receipts', text: 'This month' };

if (navigator.canShare?.(data)) {
  await navigator.share(data);
} else {
  offerDownload(files);
}
```

`navigator.canShare(data)` is the registry check for the *payload*, not just the API — the platform
answers whether **these files, of these types** can be shared at all. MDN's list of commonly
shareable types covers images (JPEG, PNG, WebP, GIF, SVG, AVIF, TIFF, BMP, ICO), audio, video, and
documents including PDF, HTML, CSS, CSV and plain text.

🔴 **`canShare` is not the same as feature detection.** `'share' in navigator` tells you the API
exists; `canShare(data)` tells you *this particular data* is acceptable. A file share needs both,
and it is the second one that fails on desktop.

## The pattern that actually ships

```js
async function shareOrCopy(data) {
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';   // silent
      // fall through to the copy path on a real failure
    }
  }
  await navigator.clipboard.writeText(data.url);
  return 'copied';
}
```

The native sheet where it exists, a copied link where it does not, and cancelling that does nothing
at all. This is [12 · Feature detection](../12-feature-detection/README.md) in one function: a
capability check, a working fallback, and no browser sniffing anywhere.

⚠️ **Keep the fallback reachable.** A share button that vanishes on desktop is worse than one that
copies a link, and a "share" button that silently does nothing when the sheet is unavailable is the
version users report as broken.

## Gotchas

**Symptom: `NotAllowedError` every time.**
Cause — no transient activation (called from a promise chain, a timer, or on load), or the
`web-share` permission policy is not granted to the frame.
Fix — call it directly in the click handler; for an iframe, the embedder must allow it.

**Symptom: an error toast every time the user backs out of the share sheet.**
Cause — treating `AbortError` as a failure.
Fix — swallow `AbortError`; only real failures deserve UI.

**Symptom: `TypeError` on a share that looks fine.**
Cause — an invalid URL, or an object carrying only properties the API does not recognise.
Fix — send `title` / `text` / `url` / `files` only, with an absolute URL.

**Symptom: sharing works on the phone and the button does nothing on the laptop.**
Cause — no share targets, or files not supported on that platform.
Fix — `canShare(data)` before showing the native path, with copy-link as the fallback.

**Symptom: the share count in analytics is far higher than reality.**
Cause — logging a share when the promise resolves.
Fix — it cannot be measured; the promise only means the sheet accepted the data.

**Symptom: `navigator.share` exists but sharing files always fails.**
Cause — checking the API rather than the payload.
Fix — `navigator.canShare({ files })`.

## Interview questions

**★ What does the Web Share API replace?**
The hand-maintained row of per-network intent URLs. It hands the payload to the OS share sheet, so
the destinations are whatever the user actually has, and the page never learns which one they
picked.

**★ Why must `share()` be called from a click handler?**
It requires transient activation — a real, recent user gesture. That is what stops a page from
opening the share sheet on load or on a timer.

**★ How do you tell "the user cancelled" from "there was nowhere to share to"?**
You cannot. Both reject with `AbortError`, deliberately, so the page cannot fingerprint the
installed apps. Treat both as a silent no-op.

**★ What is the difference between `'share' in navigator` and `navigator.canShare(data)`?**
The first says the API exists; the second says *this payload* — usually these files — can be
shared. File sharing needs both checks.

**★ Can you measure how many users shared, and where?**
No. The promise resolves when the sheet takes the data; the outcome and the destination are never
reported back.

---

← [01 · The clipboard](./01-the-clipboard.md) · [Topic index](./README.md) · [03 · Files, properly](./03-file-system-access.md) →
