---
title: "16 · Clipboard, Web Share and File System Access"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API), [`ClipboardItem`](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardItem), [`Element: paste` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/paste_event), [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API), [`Navigator.canShare()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare), [File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API), [`FileSystemHandle.requestPermission()`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission). Documentation-validated; **no timings and no console output**. ⚠️ Support for Web Share and parts of the File System API is **limited** — feature-detect and read the compatibility tables.

The syllabus row calls these *the modern replacements for three hacks*, and it is worth naming the
three:

| The hack | What replaced it |
|---|---|
| A hidden `<textarea>`, `select()`, `document.execCommand('copy')` | `navigator.clipboard` |
| A row of Twitter / Facebook / `mailto:` intent URLs | `navigator.share()` and the OS share sheet |
| `<input type="file">` in, `<a download>` out — never the same file | **File System Access** handles |

🔴 **One rule runs through all three: the user's gesture is the permission.** Every one of these
APIs is secure-context only and gated on transient activation, because each is a way for a page to
reach *out* of itself — into the clipboard, into another app, onto the disk. Design around the
click, and most of the error handling writes itself.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The clipboard](./01-the-clipboard.md)** | `writeText` and the three rules that make it work; `ClipboardItem` and **writing every representation**; `ClipboardItem.supports()`; why **reading** is gated differently in every browser and there is no reliable "read the clipboard" button; the `paste`/`copy`/`cut` events, which need **no permission at all** |
| 02 | **[Sharing](./02-web-share.md)** | `share()`'s four data properties and four requirements; the rejection table, and 🔴 why `AbortError` means *either* cancelled *or* nowhere to share to; why a share can never be measured; `canShare(data)` checking the **payload** rather than the API; the share-or-copy fallback that actually ships |
| 03 | **[Files, properly](./03-file-system-access.md)** | Handles instead of paths; 🔴 nothing reaches the file until `close()`; `keepExistingData`, `seek`/`truncate`, `exclusive` vs `siloed` writers; persisting a handle in IndexedDB and re-granting permission **inside a gesture**; the origin private file system and worker-only synchronous access handles; the decision table |

## Three facts worth carrying out of this topic

- **`AbortError` is not a failure.** The user cancelling a share or a file picker is the most
  ordinary outcome there is — swallow it.
- **Check the payload, not just the API.** `ClipboardItem.supports(type)` and
  `navigator.canShare(data)` answer a question `'share' in navigator` cannot.
- **Every one of these needs a fallback that still works**: a selectable link, a copy button, a
  file input and a download. The enhanced path is the extra, never the only path.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [12 · Feature detection and progressive enhancement](../12-feature-detection/README.md) — the
  capability-check-then-fallback shape all three of these use
- [15 · Cross-tab coordination](../15-cross-tab-coordination/README.md) — two tabs with the same
  file open, and the lock that stops them
- [14 · Yielding to the main thread](../14-yielding-to-the-main-thread.md) — why synchronous file
  access handles are workers-only
- [Phase 11 · 11 · Uploading files](../../phase-11-network-storage/11-uploading-files/README.md) —
  the other direction: a file leaving the browser
- [Phase 11 · 12 · `Blob`, `File` and object URLs](../../phase-11-network-storage/12-blob-file-filereader/README.md)
  — what a handle's `getFile()` actually hands you

---

Start → [01 · The clipboard](./01-the-clipboard.md)
