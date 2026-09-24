---
name: devbible-javascript-split-4way
description: The FOUR-way JavaScript split (chunks A B C D) — per-chunk cursor, worklist and rules. Open this on "pick javascript A".
metadata:
  type: progress
---

🔴 **This is the live cursor for JavaScript.** It replaces the two-lane split. Open it the moment
the user says *"pick javascript A"* (or B, C, D) and start at that chunk's cursor.

## 🔴🔴 START HERE — "give the phase, say continue" (set 2026-08-15)

> *"if start new session i just need to give the phase and i should just say continue it should
> take care"*

**A session is started by a phase number and the word *continue*, and nothing else.** *"JS phase 18,
continue"* · *"javascript 18"* · *"phase 18 continue"* all mean the same thing: open this file, read
the row below, start writing at the topic it names. **No plan, no confirmation, no clarifying
question.**

| Phase | State | 🔴 Start at | Held by |
|---|---|---|---|
| **18 · Storefront** | ✅ **11 · Infinite scroll and lazy images** — WRITTEN 2026-08-15 | — | session `dbaa68e7` (done) |
| **18 · Storefront** | ✅ **12 · Long lists without freezing** — **COMPLETE 2026-08-15**: 4 files / 782 lines, 0 over the cap, 0 broken links, boards updated | — nothing to continue | session `78e4bc26` |
| **18 · Storefront** | ✅ **15 · Review uploads** — **COMPLETE 2026-08-15**: **4 chunks + index / 1,118 lines**, 0 over the cap, every link resolved (⚠️ **link-checked, not built** — rule 12), boards updated | — nothing to continue | session `0e830881` — per-file log: [[devbible-javascript-p18-topic15]] |
| 0–17 | ✅ **ALL COMPLETE at every in-scope tier** | — nothing to continue | — |

🏁🏁 **JAVASCRIPT IS DONE, 2026-08-15.** Phase 18 closed at **10/10 in scope** when topics 12 and 15
landed the same day. **There is no next topic.** If a session is told *"JavaScript, continue"*, say
the language is finished and let the user choose — do **not** pick up another language, and do
**not** un-park phases 13–15 or un-drop 16 without a new instruction.

⛔ **Every other JavaScript phase is finished.** 0, 1, 2, 3, 4, 9, 10 were done before today;
**5, 6, 7, 8, 11, 12, 17 all closed on 2026-08-15**. Phases **13, 14, 15 are PARKED** and **16 is
DROPPED** — a phase number in that set is *not* work to continue; say so and ask, because reopening
them reverses the user's 2026-08-14 scope cut.

🔴 **When phase 18's three topics are written, JavaScript is DONE — stop and report.** The user's
instruction on 2026-08-15 was *"Stop — JavaScript is done"*: do not pick up another language and do
not un-park anything without a new instruction.

### The topic-level split inside phase 18 — how two sessions share one phase directory

| Owner | Topics | Files it may stage |
|---|---|---|
| session `dbaa68e7` | ✅ **11** — done | `11-infinite-scroll-and-lazy-images/` |
| session `78e4bc26` | **12** | `12-long-lists-without-freezing/` |

### ✅ Topic 12 · Long lists without freezing — session `78e4bc26`, **COMPLETE 2026-08-15**

**4 files, 782 lines, 0 over the 300-line cap, 0 broken links** (every relative target resolved
against the filesystem), no `</content>` leak. Three chunks + index, Understand tier,
documentation-validated against MDN. 🔴 **No build and no dev server were run** — per hard rule 12
and `shared/session_build_devserver_registry.md`, so the pages are **link-checked, not built**.

| File | Lines | State | Covers |
|---|---|---|---|
| `01-why-a-long-list-freezes.md` | 228 | ✅ committed `e6b11d70` | the **build freeze vs the scroll freeze**; fix 0 don't render it (paginate/search/export), fix 1 cheaper rows (delegation, flatten, image dimensions), fix 2 one `DocumentFragment` insert (⛔ `innerHTML +=` is quadratic), fix 3 🔴 **`content-visibility: auto` + `contain-intrinsic-size`** — MDN: skipped content stays available to find-in-page, tab order, focus, a11y tree, fix 4 chunk + `scheduler.yield()` (**limited availability, feature-detect**); 🔴 **the point at which windowing wins**, given as *signals*, not an invented row count |
| `02-windowing-from-scratch.md` | 263 | ✅ committed `c4e28cd5` | viewport / **empty sizer** / transformed layer; `windowFor()` maths with **overscan**; rAF-coalesced scroll (MDN: scroll "can fire at a high rate"); ⚠️ read only `scrollTop`, cache viewport height via `ResizeObserver`; **node pool + the early-return path that writes one transform**; ⚠️ recycled-node state bleed; 🔴 **`aria-setsize` / `aria-posinset`** with MDN's exact "override the browser's incorrect count" rationale |
| `03-what-windowing-breaks.md` | 234 | ✅ committed `60c1ad6b` | variable heights (measure + cache + `ResizeObserver`, estimated total, correction jump); what it breaks: Ctrl+F find-in-page, text selection across rows, printing, focus loss on recycled nodes, sticky headers, scroll anchoring, deep-link/scroll restoration; browser max element-height limit (state as implementation-defined, no invented number); when to use a library instead |

✅ **`README.md` (57 lines) and all four boards done** — commit `dc1aaf59`: `progress.js` phase-18
`pages: 8 → 9`, the phase README's topic 12 row + status line, `docs/javascript/pages/README.md`
(phase row, chunk D row, START HERE row), `docs/README.md` (chunk D row + the JavaScript technology
row, whose leaf-page count was **stale at 495 and is now the measured 525**).

⚠️ **The phase-18 CLOSE is not mine.** Topic 15 landed after topic 12, so by the "whichever session
finishes last does the close" rule it belongs to session `0e830881` — they were seen updating the
phase row to **✅ COMPLETE 10/10** while this was being written. Do not race them on those rows.

⚠️ **Topic 15 belongs to session `0e830881`** — do not touch `15-review-uploads/`, and edit only
topic 12's row in the shared phase README.
| a third session | **15** | `15-review-uploads/` |

🔴 **Re-split 2026-08-15, on the user's instruction** (*"All the work your doing in chunk d i want to
split the pending tasks with other sessions"*): **both remaining topics were handed out.** Topic 11
was already complete when the instruction came, so `dbaa68e7` keeps no queued writing work — it
holds only the phase-18 close (final build + the phase README's completion status) once 12 and 15
land, and **whichever session finishes last may do that close instead**.

⚠️ **`docs/javascript/pages/phase-18-storefront/README.md` is now SHARED by two sessions.** Edit
**only your own topic's row** and the counts that follow from it, stage that one file explicitly,
and if a `git add` shows the other session's row already changed, leave it. Same for
`src/data/progress.js` (phase 18 row), `docs/javascript/pages/README.md` and `docs/README.md`.
🔴 **Never `git add -A`.** Cross-topic links between 11/12 and 15 must be **bold plain text with
*(not written yet)*** until the other topic's files exist on disk.

⛔ **The old lane letters are DEAD.** [[devbible-javascript-build-progress]] (lane A = phases 3–8)
and [[devbible-javascript-lane-b]] (lane B = phases 9–12, 17, 18) are **history only** — read them
for traps and concepts, never for "which phases are mine". Phases 3, 4, 9 and 10 finished under
that split, so it no longer divides the remaining work evenly.

## The split — set 2026-08-15

> *"I want to split more chunks of pending javascript and upto 4 chunks of pending task i want to
> give prompt to 4 different sessions to complete those"* · *"when i start new session i just to
> say pick javascript a like that thats it"*

**94 in-scope topics left, split four ways, WHOLE PHASES ONLY** — so no two sessions ever write in
the same phase directory or touch the same phase `README.md`. Counted 2026-08-15 by parsing every
tier badge in `docs/javascript/syllabus/*.md` against the written topic numbers on disk, then
subtracting the 2026-08-14 scope cut. It agrees exactly with the old lanes' own totals (44 + 50).

| Chunk | Phases | Left | Why these two are paired |
|---|---|---|---|
| **A** | ✅ **5 DONE 26/26** · ✅ **11 DONE 21/21** | ✅ **0 — FINISHED** | `structuredClone`, typed arrays and `TextEncoder` in phase 5 are exactly what phase 11's `postMessage`, `Blob` and streams pages lean on |
| **B** | **6** · Iteration, destructuring and generators (10) · **17** · Machine coding (14) | **24** | Generators and the iteration protocols are the machinery the implement-it-yourself phase builds on |
| **C** | ✅ **7 · DONE 22/22** · ✅ **8 · DONE 18/18** | ✅ **0 — CHUNK C FINISHED** | The natural pair — the event loop, error handling and the build sit either side of one seam |
| **D** | **12** · The browser platform (19) · **18** · Storefront (3) | **22** | The three kept storefront topics are the observer / worker / File work phase 12 covers |

**Off the board entirely:** phases **0, 1, 2, 3, 4, 9, 10** are complete at every tier. Phases
**13, 14, 15** are **parked** and **16** is **dropped** — they belong to no chunk and are not
picked up without a new instruction.

## Cursors — update your own row and nothing else

| Chunk | Phase | Written | 🔴 Start at | Held by |
|---|---|---|---|---|
| **A** | 5 | ✅ **26/26 COMPLETE** | — every tier done 2026-08-15 | 🔴 session `3d9f98b8`, 2026-08-15 (took over from `21d2f5de`) |
| **A** | 11 | ✅ **21/21 COMPLETE** | — 🏁 **CHUNK A IS FINISHED 2026-08-15**; nothing queued | 🔴 session `3d9f98b8`, 2026-08-15 |
| **B** | 6 | ✅ **13/13 COMPLETE** | — phase 6 is done (2026-08-15) | session `233dede7` (was `7c6611b4`) |
| **B** | 17 | ✅ **18/18 COMPLETE** | 🏁 **CHUNK B IS FINISHED — no work left** (phase 6 13/13 · phase 17 18/18, closed 2026-08-15) | 🔴 session `233dede7`, 2026-08-15 (took over from `7c6611b4`) |
| **C** | 7 | ✅ **22/22** | ✅ **COMPLETE at every tier, 2026-08-15** — 69 files, 11,962 lines | 🔴 session `f6dffd4a`, 2026-08-15 |
| **C** | 8 | ✅ **18/18** | ✅ **CHUNK C IS COMPLETE** — phase 7 22/22 and phase 8 18/18, 2026-08-15. Nothing queued; if the user says "javascript C", say so and let them pick | ✅ session `f7bca7a9`, 2026-08-15 (from `f6dffd4a`) |
| **D** | 12 | ✅ **21/21 COMPLETE** | — every tier done 2026-08-15 (15–21 written this session) | 🔴 session `dbaa68e7`, 2026-08-15 |
| **D** | 18 | 7/18 | 🔴 **11 · Infinite scroll and lazy images** — the chunk's ONLY remaining work (11, 12, 15) | 🔴 session `dbaa68e7`, 2026-08-15 |

## The worklists, in order

Inside a phase: **Understand → Know → When Needed**, lowest unwritten number first. Finish a phase
before starting the chunk's second phase.

**A · phase 5** (Understand) ~~18 `Object` statics~~ ✅ **written 2026-08-15** (4 chunks + index,
1,045 lines: the-map-and-the-four-axes · seeing-everything · descriptors-and-faithful-copies ·
grouping-and-the-gaps; MDN `Object`, `getOwnPropertyNames`/`Symbols`, `Reflect.ownKeys`,
`getOwnPropertyDescriptors`, `groupBy`, `Map.groupBy`, Enumerability-and-ownership guide) ·
~~19 `Date`~~ ✅ **written 2026-08-15** (4 chunks + index, 1,070 lines:
the-model-and-making-one · parsing-and-the-one-day-bug · reading-writing-and-arithmetic ·
formatting-and-why-a-library; MDN `Date`, Date Time String Format, `Date.parse`, `toISOString`,
`getTimezoneOffset`, `Symbol.toPrimitive`, `Intl.DateTimeFormat`, `Temporal`) ·
~~20 `Intl`~~ ✅ **written 2026-08-15** (3 chunks + index, **918 lines**:
the-shape-and-numberformat 288 · dates-and-relative-time 263 ·
text-collator-list-plural-segmenter 286). All seven constructors in the syllabus row covered
(`NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `Collator`, `ListFormat`, `PluralRules`,
`Segmenter`), plus `supportedValuesOf` and a pointer at `DisplayNames`/`Locale`/`DurationFormat`.
🔑 **Load-bearing claims, all MDN-validated:** constructing a formatter is the expensive part and
`toLocaleString`/`localeCompare` are hidden constructor calls (build once, reuse); `dateStyle`/
`timeStyle` **throw a TypeError** if mixed with component options; `style:"percent"` **multiplies
by 100**; `currency` is required with `style:"currency"`; significant-digit options **override**
fraction-digit ones; `RelativeTimeFormat` needs `numeric:"auto"` for *yesterday* and does **not**
pick the unit; CLDR has **six** plural categories and English ordinals need `type:"ordinal"`
(the `%10` hand-rule gets 111 wrong); `.length` counts UTF-16 units and spreading counts code
points — only `Segmenter` grapheme granularity counts characters.
· ~~21 `structuredClone`~~ ✅ **written 2026-08-15** (ONE flat file, 207 lines —
not chunked, and that is correct: phase 4/04/02 owns the mechanics at Master depth).
🔑 **The angle that gave it a reason to exist:** `structuredClone` **is** the HTML
structured clone algorithm, the same one behind `postMessage` (worker / iframe /
BroadcastChannel), IndexedDB `put` and `history.pushState` — so it is a **synchronous
DataCloneError test** for every one of those boundaries, and what it refuses is one
limitation rather than six. Also carries the five-way copy decision table
(spread · descriptor clone · JSON · structuredClone · Class.from) and the note that
`JSON.parse(JSON.stringify(x))` now has **no remaining niche**. ⚠️ It is an **HTML-spec
global, not ECMAScript** — no `Object.structuredClone` exists.
⛔ **Do not re-expand this into a directory** — the depth is deliberately in phase 4. ·
~~22 Array-likes and iterables~~ ✅ **written 2026-08-15** (2 chunks + index, 569 lines:
the-two-contracts 262 · converting-correctly 244). CONCEPT and CHOICE again — phase 3/02/02 owns
`arguments`, phase 5/01 owns `Array.from`, phase 9/07 owns the DOM collections.
🔑 **Load-bearing claims:** array-like and iterable are **two independent contracts**;
`{length:2}` is array-like not iterable and `Set` is iterable not array-like; **a function is
accidentally array-like** because its `length` is its arity, which is why no reliable
"is array-like" test exists; **`HTMLCollection` has no `forEach`** (`NodeList` does);
`querySelectorAll` is **static** while `childNodes`/`getElementsBy*`/`element.children` are
**live**, and the live ones make a removal loop skip half its elements; a string's **index view
is code units and its iteration view is code points**, and neither is a character count;
**spread needs an iterable, `Array.from` takes either** — the one forced choice;
`Array.from({length:n},(_,i)=>i)` is the range idiom because `new Array(n)` makes holes that
every iteration method skips; **`Array.isArray` beats `instanceof Array`** cross-realm.
— (Know) ~~23 `WeakMap`/`WeakSet`~~ ✅ **written 2026-08-15** (2 chunks + index, 485 lines:
the-weak-collections 267 · weakref-and-finalizationregistry 167).
🔑 Key claims: the leak is a `Map` keyed by DOM nodes; **no iteration / no `size` / no `clear`
because that would make GC observable**; keys must be objects (primitives throw — so "cache by
id" is impossible); ⚠️ **the VALUE is held strongly**, so a value pointing at another key
rebuilds the leak, though a value pointing at its **own** key is safe by spec; **MDN itself
advises avoiding `WeakRef`/`FinalizationRegistry`** — unspecified timing, a `deref()` that pins
the object for the rest of the event-loop turn, a callback that may never run and is **not**
called on unload, and the held-value-references-the-target mistake that guarantees it never runs.
· ~~24 `Temporal`~~ ✅ **written 2026-08-15** (2 chunks + index, 547 lines: the-types 227 ·
arithmetic-zones-and-adoption 260). 🔑 Claims: eight types + `Temporal.Now` per-type entry points;
**months are 1-based**, no 0–99 year rule, `overflow:'reject'` for user input; **immutable, no
setters**; **a `PlainDate` cannot become an `Instant` without an explicit zone AND time** — the
one-day bug caught at the type level; `until(end,{largestUnit})` is the calendar-aware duration
`Date` cannot express; `Type.compare` + `.equals()` and **no coercion at all** (deliberate fix for
`Date`'s `<` working but `===` not); the **DST `disambiguation`** table with `'reject'` as the
right default for scheduling; `ZonedDateTime.toString()` keeps the bracketed zone; `Date` maps
**only** to `Instant`. ⚠️ Adoption written honestly — availability varies, polyfill has a real
cost, `Date` cannot be removed, **do not rewrite working timestamp-and-format code**.
· ~~25 typed arrays, `ArrayBuffer`, `DataView`~~ ✅ **written 2026-08-15** (2 chunks + index,
534 lines: buffers-and-views 262 · dataview-and-endianness 215). 🔑 Claims: a buffer is
**uninterpretable bytes**; **`slice` copies, `subarray` aliases**; offset views must be
**element-aligned** and `DataView` is the one that is not; **out-of-range writes wrap and
out-of-bounds writes are silently dropped, nothing throws**; `Uint8ClampedArray` clamps+rounds
and is what canvas `ImageData` uses; **`Array.isArray` false / `ArrayBuffer.isView` true**;
`sort()` is **numeric** here; a **transferred** buffer is detached (`byteLength` 0). 🔴 The
endianness trap: **typed arrays use the PLATFORM's order, `DataView` defaults to BIG-endian**,
network byte order is big — so anything from outside the process needs an explicit `DataView`
call. Node's `Buffer` is a `Uint8Array` subclass. Honest note included: typed arrays are a data
model, **not** a general "faster array".
· ~~26 Text encoding~~ ✅ **written 2026-08-15** (2 chunks + index, 478 lines:
textencoder-and-textdecoder 198 · base64 222).
🔑 Claims: **`TextEncoder` is UTF-8 only and takes no argument**, `TextDecoder` takes a label;
**byte count ≠ `str.length`** — the number that matters for byte-denominated limits;
`{fatal:true}` throws instead of emitting U+FFFD; 🔴 **`{stream:true}` + a final bare `decode()`**
is mandatory for chunked decoding (the decoder is **stateful**, one per stream) —
`TextDecoderStream` packages it; `normalize("NFC")` before hashing. 🔴 **`btoa` takes a BINARY
STRING, not text** — it throws on any code unit above 255, which ASCII test data hides; the
correct pair is `TextEncoder` → loop → `btoa` (**never** `String.fromCharCode(...bytes)`, which
blows the argument limit); `Uint8Array.prototype.toBase64()`/`fromBase64()` replace all of it
where available; **base64url** (`-` `_`, no padding) is why hand-decoding a JWT fails
intermittently; `createObjectURL` beats a data URL for anything but a tiny icon; base64 costs
**~33%** and hides nothing.

🏁🏁 **PHASE 5 IS COMPLETE — 26/26, every tier (Master 8/8 · Understand 14/14 · Know 4/4),
closed 2026-08-15.** This session wrote topics **18–26: 30 files, 5,853 lines, 0 over the
300-line cap**, all documentation-validated against MDN with **no sandbox and no console
blocks**. 🔴 **Chunk A's remaining work is PHASE 11 ONLY — 14 topics, 08–21, starting at
08 · Aborting and timing out.**

⚠️ **Phase 11 can now lean on phase 5 and should link rather than re-explain:** typed
arrays/`ArrayBuffer`/detached-after-transfer (25), `TextEncoder`/`TextDecoder` + the
`{stream:true}` chunked-decoding trap and base64 (26), `structuredClone` as the shared
serialisation algorithm behind `postMessage`/IndexedDB (21), and `AbortSignal` groundwork that
topic 08 opens.

🔑 **Concepts locked in by 19 `Date`, so 20 `Intl` and 24 `Temporal` build on them and do not
repeat them:** a `Date` is one epoch-ms number with the calendar projected through the *host's*
local zone; the **date-only = UTC vs date-time-without-offset = local** asymmetry is the one-day
bug; **instant vs plain date** is the modelling distinction (birthdays are text, not `Date`s);
`Date` can **display** any IANA zone via the `timeZone` format option but can **compute** in only
local and UTC; `+` concatenates while `-` subtracts, because `Date`'s `Symbol.toPrimitive` prefers
a string for the default hint. Topic 20 should own the `Intl.DateTimeFormat` **option surface**
(`dateStyle`, `formatRange`, `RelativeTimeFormat`, reuse-the-formatter) — topic 19 only points at
it. Topic 24 should own the `Temporal` **types**; topic 19 names them and stops.

⚠️ **Phase 5's Understand topics overlap phase 4 heavily, and that is by design.** Phase 4 owns
`keys`/`values`/`entries`/`fromEntries` (4/08), `assign` and spread (4/04), `Object.create(null)`
(4/14/02), descriptors (4/11), `freeze`/`seal` (4/12) — all at **Master** depth. So topic 18 was
written as **the family map plus the corners with no other home** (the see-everything trio, the
descriptor clone, `groupBy`), never as a second implementation. Expect the same shape for 21
`structuredClone`, which phase 4/04/02 already covers in depth — write it as **concept and
choice**, then link.
🏁 **PHASE 5 STATUS after 2026-08-15: 22/26 — Master 8/8 ✅ and Understand 14/14 ✅ both
CLOSED.** Only the four **Know** topics remain: 23 `WeakMap`/`WeakSet` · 24 `Temporal` ·
25 typed arrays/`ArrayBuffer`/`DataView` · 26 text encoding. ⚠️ **25 and 26 are the ones phase 11
leans on** (`Blob`, streams, `postMessage`, `TextEncoder`) — that pairing is why chunk A holds
both phases, so write them before starting phase 11 rather than after.

**A · phase 11** (Understand) ~~08 Aborting and timing out~~ ✅ **written 2026-08-15**
(2 chunks + index, 565 lines: the-controller-and-the-signal 246 · cancellation-as-a-lifecycle 262).
🔑 Claims: the **controller/signal split is a capability boundary**; an aborted `fetch` **rejects**
with a `DOMException` named **`AbortError`** while `AbortSignal.timeout()` gives **`TimeoutError`**
— `instanceof` cannot tell them apart, only `name`; 🔴 reporting a user-cancelled request as an
error is the common bug and swallowing everything is the opposite one; **`AbortSignal.timeout()`
starts counting at creation** so never at module scope; `AbortSignal.any()` combines cancel+timeout
and preserves the firing source's reason; **cancellation is cooperative**; 🔴
**`addEventListener(h,{signal})`** removes every listener at once and makes inline arrows
removable; a **per-effect-run controller makes the stale-response race impossible**, not merely
unlikely; **a controller cannot be reused** once aborted; 🔴 **abort cannot un-send a request** —
a cancelled `POST` is ambiguous and must not be read as "it did not happen".
⚠️ Phase 11's README had said "lane B owns this phase" — corrected to chunk A. ·
~~09 Cookies~~ ✅ **written 2026-08-15** (2 chunks + index, 497 lines:
the-api-and-the-attributes 234 · tokens-and-samesite 205).
🔑 Claims: reading `document.cookie` gives **name=value only, no attributes, no `HttpOnly`**;
writing **sets exactly one cookie**; parse by splitting on the **first `=` only**; an unencoded
**`;` truncates the value**; **`Path` defaults to the setting page's directory** and **`Domain`
WIDENS to subdomains**; **JS cannot set `HttpOnly`**; 🔴 **deletion needs a matching
`Path`+`Domain` or it creates a duplicate**; ~4 KB and count limits **fail silently**; the real
cost is **upload bandwidth on every request**. `SameSite` **Lax is the default** and the right
session choice (Strict logs users out when arriving from an email); **`None` requires `Secure`**;
`SameSite` does **not** retire CSRF tokens (top-level GETs still pass; sibling subdomains are
same-site); credentialed CORS needs **both** `credentials:'include'` **and** a specific
non-wildcard origin. 🔴 **The honest HttpOnly line, written deliberately:** it converts **token
theft into session riding** — smaller blast radius, **not** a fix — so the real lever is
preventing injection (CSP, escaping), not choosing a storage bucket.
· ~~10 `localStorage`/`sessionStorage`~~ ✅ **written 2026-08-15** (2 chunks + index, 520 lines:
the-api-and-what-it-costs 268 · the-storage-event-and-choosing 191).
🔑 Claims: **strings only**; **`getItem` returns `null`** and a bare `JSON.parse(getItem(k))` is a
latent crash; **treat stored data as untrusted** — it outlives deploys; 🔴 **`setItem` THROWS**
(quota, private mode, and blocked storage that throws on *access*, so the feature test itself must
be in a `try`); **synchronous, main-thread only** — absent from workers, which is why IndexedDB
exists; **"session" means the TAB**; scoped by origin **including the port** (no subdomain sharing,
unlike cookies); 🔴 **the `storage` event does NOT fire in the writing tab** so the write path and
the cross-tab path are separate code, and `clear()` fires one **all-null** event that `e.key`
filters silently ignore; the storage-as-bus trick is superseded by **`BroadcastChannel`**; nothing
in web storage may be **trusted later without re-checking**.

~~11 Uploading files~~ ✅ **written 2026-08-15** (**3 chunks + index, 684 lines**:
getting-the-file 248 · sending-it 211 · scale-and-the-server 169).
⚠️ **Chunk 02 first landed at 301 lines and was SPLIT on a concept boundary (sending vs scale),
not trimmed** — the cap rule working as intended; the topic ended up better for it.
🔑 Claims: a **`File` IS a `Blob` with a name** — a handle, nothing read, so never base64 it
(~33% + a full read + a blocked main thread); 🔴 **never set `Content-Type` with `FormData`** (the
browser must add the multipart boundary) and **the usual cause is a fetch wrapper that adds JSON
headers to everything**; 🔴 **`fetch` has no upload progress** — XHR's **`xhr.upload`** target owns
it, and listening on `xhr` itself is why bars jump to 100%; check `lengthComputable`;
`input.value = ""` or re-picking the same file fires nothing; drag-and-drop needs
`preventDefault()` on **both** `dragover` and `drop`; **`file.type` is a guess from the extension**
and **`file.name` is attacker-controlled** (never a path/key); `Blob.slice` gives chunked/resumable
uploads (buys resumability, progress, past size limits — costs part tracking and retry logic;
pointless under a few MB); presigned direct-to-storage needs **bucket CORS** + a short-lived
constrained URL; and the five server-only rules, ending with **serving user content back without
creating stored XSS** (separate origin, explicit `Content-Type`, `nosniff`).
· ~~12 `Blob`/`File` + object URLs~~ ✅ **written 2026-08-15** (2 chunks + index, 487 lines:
blob-and-file 206 · object-urls 224). 🔑 Claims: **a `Blob` is a HANDLE to bytes the browser
holds**; **`slice()` reads nothing** (hence magic-byte checks and chunked uploads on huge files);
`type` is a **label, not a fact**; the four read methods are a **memory decision** and
**`blob.text()` assumes UTF-8 unconditionally**; `FileReader` survives only for `readAsDataURL`
and its progress event (`FileReaderSync` in workers); 🔴 **`createObjectURL` registration IS the
reference** — forgetting `revokeObjectURL` leaks the `Blob` and **never shows up in testing**,
while revoking too early breaks the image/download (safe points: after `load`, or a
`setTimeout(…,0)` after a click); **`readAsDataURL` for a preview is the common wrong turn**;
`download` only works same-origin which is why the `blob:` pattern exists; **IndexedDB stores a
`Blob` directly** and `postMessage` accepts one via structured clone.
· 🚧 **13 WebSocket** — 🔴 **RE-PLANNED TWICE 2026-08-15 by session `3d9f98b8`, and it is now FOUR
chunks**: the planned 01 came in at **284 lines covering connecting alone**, and the planned
"messaging and closing" came in at **325 — over the cap — so it was SPLIT on the messaging/closing
boundary, not trimmed**. That is the cap rule working exactly as written, twice in one topic.
Files: **01-connecting.md ✅ (285) · 02-messaging.md ✅ (248) · 03-closing.md ✅ (213) ·
04-staying-connected.md ✅ (284) · 05-when-not-to.md ✅ (223)** — 🏁 **TOPIC 13 IS COMPLETE:
6 files, 1,320 lines, 0 over the cap.**
🔑 **Chunk 05's load-bearing claims:** 🔴 **the constructor takes ONLY `(url, protocols)` — there is
no headers option**, so `Authorization: Bearer` is impossible from a browser; the four ways through
are **cookies** (automatic, `HttpOnly`-compatible, and exactly what makes **CSWSH** possible since
there is no CORS — so the server MUST check `Origin`, and `SameSite=Lax` is not attached because a
handshake is not a top-level navigation), **query-string token** (works, but ⚠️ **the URL lands in
access/proxy/error logs**, so a session token there is a credential to rotate), **the
`Sec-WebSocket-Protocol` hack**, and ✅ **the short-lived single-use TICKET minted by an
authenticated HTTP call** — the recommended answer, and ⚠️ **mint one per reconnect attempt**, not
at startup. **First-message auth** keeps the token out of the URL but ⚠️ **the connection exists
before anyone is authenticated** (rate-limit + close on a short timer). 🔴 **A socket outlives its
token and nothing re-checks it** — the server must, closing with a fatal `4xxx`.
🔑 **The comparison, the part the topic exists for:** `EventSource`/**SSE gives you free exactly
the two hardest things in chunk 04** — MDN: "if the connection between the client and server closes,
the connection is restarted automatically", plus `retry:` and **`Last-Event-ID`** resumption — but
is 🔴 **one-way** ("you can't send events from a client to a server"), **text only** (base64 = ~33%),
**cannot set headers either** (only `withCredentials`), and 🔴 hits the **HTTP/1.1 six-connections-
per-browser+domain limit** (HTTP/2 negotiates streams, default 100). ⚠️ **SSE IS subject to CORS,
WebSocket is not** — a real security advantage. `WebTransport` = HTTP/3 + **unreliable datagrams**,
MDN "Baseline 2026 · newly available since March 2026". The costs of a persistent connection:
`Upgrade`-aware infrastructure and idle timeouts, **a pub/sub bus the moment there is >1 server**,
no caching/CDN/status codes, worse observability, capacity measured in **connections not RPS**.
🔴 **The honest default written into the page: if only the server talks, do not open a WebSocket.**
🔴 **The topic is FIVE chunks** (planned as two): the reliability chunk was itself too big, so auth
+ the alternatives comparison were split out into 05. Index table, footers and every "chunk N"
reference renumbered each time.
🔑 **Chunk 04's load-bearing claims:** the browser does **nothing** on disconnect — no reconnect, no
replay, no queue (unlike `EventSource`). 🔴 **Backoff protects the server from ONE client; JITTER
protects it from all of them at once** — a deploy disconnects everyone in the same instant, so
without randomness the retries arrive in waves; full jitter = `Math.random() * min(CAP, BASE*2**n)`,
and the **cap** is what stops an app never recovering after a long outage. ⚠️ **Do NOT reset the
attempt counter on `open`** — a server that accepts then immediately drops makes every attempt
"succeed" and degenerates into a tight loop; **reset after a stability window**. Reconnect sooner on
**`online`** and **`visibilitychange`**, but ⚠️ **`navigator.onLine` only means an interface exists**
(captive portal reports `true`), and **hidden-tab timers are throttled**. 🔴 **Half-open connections:
`readyState` stays `OPEN` forever when the network vanishes between packets** — TCP has no traffic to
fail on. The protocol HAS ping/pong **control frames (opcodes `0x9`/`0xA`, MDN's server guide is the
citable quote)** but 🔴 **the browser API exposes NO `ping()` and NO `pong` event** — the `WebSocket`
interface is only `send`/`close` + `readyState`/`bufferedAmount`/`binaryType`/`protocol`/`extensions`
/`url` — so a browser heartbeat is an **application message**. It does **two** jobs: detection (**a
heartbeat with no timeout is decoration** — on a missed pong call `ws.close()` and let the normal
close path reconnect) and keeping **NAT/proxy idle timeouts** from silently killing the connection;
**any inbound message counts as a sign of life**. Outboxes must be **bounded**, and the replay
decision is per message kind — **drop** presence/cursor, **re-derive** subscriptions, **replay only
with an idempotency key** (the same just-before-death ambiguity as a cancelled `POST`).
🔴 **A reconnected client is a NEW client — reconnecting is not resuming:** `open` must
re-authenticate, re-subscribe **from application state** (never from a queued subscribe), and close
the gap via `resume {since: lastSeq}` — and **the server's "gap too old" branch is mandatory**, or
it works in dev and serves stale state in production; buffer live messages while the snapshot
request is in flight.
🔑 **Chunk 03's load-bearing claims, all MDN-validated:** **closing is a HANDSHAKE**, which is why
`CLOSING` exists and why "I closed it" ≠ "it is closed"; a client may send **only `1000` or
`3000`–`4999`** — anything else throws **`InvalidAccessError`** — and an omitted code is filled in
by the browser from `1000`/`1001`–`1015`; 🔴 **`reason` is 123 BYTES of UTF-8, not characters**,
over-length throws **`SyntaxError`**, and MDN itself gives the "123-character non-ASCII reason"
example — so a reason built from user/server text is a latent crash (use a constant, or truncate by
encoded bytes and accept the split-character caveat). **`close()` does NOT discard already-sent
messages** (the handshake starts after they go out), **is idempotent when already `CLOSED`**,
returns immediately at `CLOSING`, and **may be called while `CONNECTING`** (a `close` with no
`open`). 🔴 **Teardown belongs in the `close` handler, never beside the `close()` call** — it is
the one event that fires whether you, the server or the network closed it, and it must **reject and
clear the `pending` map** or request promises hang forever. `wasClean` is the honest field.
🔴 **`1005`/`1006`/`1015` are reserved and NEVER travel on the wire** — they are the browser's
local report, so **`1006` + `wasClean:false` = "it broke and the browser cannot tell you why"**,
covering refused handshake, dead network and proxy timeout alike; the one useful variant is
**`1006` with no preceding `open`**, which points at URL/mixed content/CSP/`Upgrade` forwarding.
**`4000`–`4999` is the only range that survives the round trip**, so fatal-vs-retryable policy is
built there; ⚠️ **"not 1000" must NOT mean "retry"** (expired token → infinite reconnect loop from
every tab), and **never parse `e.reason`** — free text, often empty, truncated. The index chunk table, every footer and every in-text
"chunk N" reference were renumbered to match. ⚠️ **Two DEAD filenames — `01-connecting-and-
messaging.md` and `02-messaging-and-closing.md`** — neither exists; do not link them.
🔑 **Chunk 02's load-bearing claims, all MDN-validated:** `send()` takes **string / ArrayBuffer /
TypedArray or DataView / Blob**, a string is **UTF-8 so `bufferedAmount` grows in BYTES**, and
**`Blob.type` is ignored** on the wire. 🔴 **The two failure modes are asymmetric and that is the
trap** — `send()` in **`CONNECTING` throws `InvalidStateError`**, in **`CLOSING`/`CLOSED` it
SILENTLY DISCARDS**; the silent half is the one that reaches production. **`send()` is
asynchronous** — returning is not delivery — and **"if the data can't be sent… the socket is closed
automatically"**, so flooding the outbound buffer drops the connection rather than throwing.
`binaryType` defaults to **`"blob"`**, `"arraybuffer"` when you will parse now — choose by what you
do next (same handle-vs-bytes call as 12/01), and **set it immediately after construction** because
it only affects later frames. **A bare `JSON.parse(e.data)` is a latent crash** (proxy text, binary
frames, newer server) and it throws inside an event handler. 🔴 **Framing:** WebSocket gives
**message boundaries and nothing else** — no type, no id, no ack, no seq, no version — so every app
reinvents the `{type,id,ts,seq,payload}` envelope; request/response needs a **`pending` Map** that
**must be rejected on close and timed out**, or promises hang forever; **ordering holds within one
connection only**. `bufferedAmount` **resets to 0 when drained but NOT when the socket closes** —
"if you keep calling `send()`, this will continue to climb" — so it is not a health check; there is
**no drain event**, and for high-rate data **coalescing beats queueing**. 🔴 **Inbound there is NO
backpressure at all** and MDN says so outright ("fill up the device's memory… 100% CPU usage, or
both") — defences are a cheap handler, batching on a frame, subscribing to less, or a worker.
**`WebSocketStream` does apply backpressure automatically but is experimental and non-standard** —
name it, do not ship it. Framing line still holds:
the API is four events + `send`/`close`/`readyState`, and **everything hard is outside it** —
reconnection with **backoff AND jitter**, application-level **heartbeats** (TCP will not tell you
the connection died), queueing + resync after a gap, auth without headers.
🔑 **Chunk 01's load-bearing claims, all MDN-validated:** **constructing IS connecting** (no
`connect()`, cannot be awaited, so a module-scope socket connects at import time); the URL accepts
**`ws:`/`wss:`/`http:`/`https:`**, allows a **relative** URL, and throws **`SyntaxError` on a
fragment**, a bad scheme or a duplicated sub-protocol; `wss:` is effectively mandatory (mixed
content, and the `localhost` exemption is why the bug survives development); the handshake is HTTP
→ **`101 Switching Protocols`**, `Sec-WebSocket-Accept` = base64(SHA-1(key +
`258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)) — **proof of comprehension, not security**; therefore
**cookies are sent**, **proxies must forward `Upgrade`** (a `200`/`400` handshake is an
intermediary, never app code), and after the `101` **nothing HTTP applies**. 🔴 **NOT subject to
CORS** — the `Origin` header is sent but **the browser enforces nothing**, so the server must check
it or it is open to **CSWSH**; MDN's *Writing WebSocket servers* is the citable source, including
"non-browser agents can send a faked `Origin`". The client-side lever is **CSP `connect-src`**, and
⚠️ **`connect-src 'self'` does not resolve to websocket schemes in all browsers** — name the `wss:`
origin. **At most ONE sub-protocol per connection**, read `ws.protocol` only after `open`.
`readyState` is **one-way 0→1→2→3** and **a closed socket cannot be reopened** (reconnect = a new
object, which is why the reconnect logic owns the reference). 🔴 **`error` is a bare `Event` with
no detail, by design**, and **a `close` always follows** — so recovery lives in `close` ONLY, else
two reconnects per drop. Teardown uses the `{signal}` listener form from 08/01; 🔴 **close on
`pagehide`** because an open socket can disqualify the page from **bfcache**.
⚠️ **`15 · CSP` is unwritten**, so chunk 01 references it as bold plain text — not a link. ·
🚧 ✅ **14 Same-origin and `postMessage`** — 🏁 **COMPLETE
2026-08-15**: `14-same-origin-and-postmessage/` = index + `01-what-an-origin-is.md` (192) +
`02-postmessage.md` (277) = **525 lines, 2 chunks, 0 over the cap**.
🔑 **Chunk 02's claims, MDN-validated:** four call forms incl. the **options object**
`{targetOrigin, transfer}`; the message is **structured-cloned** (same algorithm as
`structuredClone`, so no functions/DOM/prototypes and a synchronous **`DataCloneError`**).
🔴 **`targetOrigin` is a SECURITY CHECK, not an address** — MDN says it twice in bold, and the
attack is: you cannot read the target's location cross-origin, so if anything navigated that
window `"*"` hands the payload to whoever is there ("A malicious site can change the location of
the window without your knowledge"). The match is **exact incl. port**, and a mismatch **silently
does not dispatch** — the usual cause of "the message never arrives". ⚠️ **Omitting the argument
defaults to `"/"` = the sender's own origin.** Receiving needs **THREE** checks: `origin`
(**"Any window… can send a message to any other window within the iframe hierarchy"**), `source`
(right origin, wrong window), and **the SHAPE of `data`** — MDN: "a security hole in the site you
trusted… could then open a cross-site scripting hole in your site", so never route into
`innerHTML`/`eval`/a redirect. ⚠️ **`e.origin` can be the string `"null"`** (sandboxed frame,
`data:`) — unallow-listable; hand that frame a **`MessagePort`** instead. `e.source.postMessage(…,
e.origin)` is the reply idiom (**reply to `e.origin`, never `"*"`**). Transferables **move
ownership** ("no longer usable on the sending side") and 🔴 **the transfer array is a PERMISSION,
not the payload** — the object must also be in the message; ⚠️ **typed arrays are not
transferable, their `ArrayBuffer` is**, and detaching it detaches every view.
🔴 **`MessageChannel` = a private two-party pipe** (the `window` listener is a public door);
**`port.start()` is REQUIRED with `addEventListener` and implied by `onmessage`** — messages queue
silently otherwise, which is the classic "listener never fires, no error". Worker `postMessage`
has the same clone/transfer rules but **no origin at all**; cross-tab is `BroadcastChannel`.
⚠️ **The ordering trap:** a message posted before the frame has a listener is **dropped, not
buffered** — wait for `load` or use a `{type:"ready"}` handshake.
🔑 **Chunk 01's claims, MDN-validated:** an origin is the **scheme/host/port tuple** and **the
default port counts as that port** (`x.com` == `x.com:80`, `:8080` is a third party) — the reason
`:3000` cannot read `:8080` on the same `localhost`; ⚠️ **same-origin ≠ same-site**, which is
exactly why cookies (site) and `localStorage` (origin) disagree. **Opaque origins:** `about:blank`
and `javascript:` **inherit** the embedder's origin, `data:` gets "a new, empty security context",
**`file:///` is opaque** ("files from the same folder are not assumed to be same-origin"), and a
**sandboxed iframe without `allow-same-origin`** posts with 🔴 **`event.origin === "null"` (the
STRING)** — unallow-listable, and chunk 02's sharpest edge. 🔴 **The policy is three categories,
not one:** cross-origin **writes ✅ allowed**, **embedding ✅ allowed**, **reads ❌ disallowed** —
and MDN's own line "read access is often leaked by embedding" is the whole model (a cross-origin
`<script>` runs with YOUR origin's privileges; `window.onerror` gives only `"Script error."`
without CORS + `crossorigin`). The cross-origin `Window` surface is a **fixed allow-list**
(`postMessage`/`blur`/`focus`/`close`, a few read-only props, `location.replace()`), with
🔴 **`location.href` WRITE-ONLY** — which is precisely why `targetOrigin` must be explicit, since
"a malicious site can change the location of the window without your knowledge". `window.opener`
is a live handle back (→ `rel="noopener"`); `iframe.contentDocument` is **`null`**, not a catchable
error. 🔴 **`document.domain` is DEAD** — deprecated, both sides must set it, **assignment nulls
the port**, throws in a sandboxed iframe, and **does not affect `localStorage`/`indexedDB`/
`BroadcastChannel`/`SharedWorker`**. Framing protection is a **response header** —
`frame-ancestors` (modern) or `X-Frame-Options`; a JS frame-bust is not a defence; and
⚠️ **`sandbox="allow-scripts allow-same-origin"` on same-origin content removes the sandbox**.
⚠️ `15 · CSP` is unwritten → referenced as bold plain text. · 🚧 **15 CSP** — dir `15-csp/`, planned as **2 chunks**;
🏁 **COMPLETE 2026-08-15** — index +
`01-what-a-policy-breaks.md` (231) + `02-nonces-and-strict-dynamic.md` (238) = **521 lines**.
🏁🏁 **THAT CLOSES PHASE 11's UNDERSTAND TIER (06–15). Only the SIX Know topics remain: 16–21.**
🔑 **Chunk 02's claims, MDN-validated:** a nonce must be **different every response AND
unpredictable**, and MDN draws the consequence — **"the server cannot serve static HTML, because it
must insert a new nonce each time"**; a nonce authorises **inline scripts and can authorise
external ones**, but **never an inline event handler** (`script-src-attr`); browsers hide the
attribute from `getAttribute("nonce")`, so frameworks read **`document.currentScript.nonce`**.
Hashes: 🔴 **do NOT include the `<script>` tags**, and **"capitalization and whitespace matter,
including leading or trailing whitespace"** — so hashes must be **build-generated, never hand-
maintained**; `sha384`/`sha512` valid; for external scripts the `integrity` hash must ALSO be in
the header (where CSP meets SRI). **`'unsafe-hashes'`** exists because **hashes do not cover event
handlers** — a migration crutch, far better than `'unsafe-inline'`, far worse than deleting the
handler. 🔴 **`'strict-dynamic'` IGNORES the allow-list, `'self'` and `'unsafe-inline'` entirely**
(MDN's own wording) — trust comes only from a nonce/hash on a root script and **propagates through
`createElement`+`appendChild` but NOT through `document.write`/`innerHTML`**, which is exactly why
tag managers break. ⚠️ Honest cost stated: a trusted script talked into creating a script element
from attacker input inherits the trust → which is what **Trusted Types** then closes. ⚠️ A policy
keeping `https:`/`'unsafe-inline'` at the end is **deliberate backwards compatibility** — modern
engines ignore them. **Migration order (never skip to enforcing):** report-only → fix by category →
nonces → `'strict-dynamic'` + drop the allow-list → enforce → `require-trusted-types-for 'script'`.
Trusted Types = **`TypeError` on passing a string into an HTML/JS/script-URL sink**, MDN status
**Baseline 2026, "Since February 2026"**, available in workers.
🔑 **Chunk 01's claims, MDN-validated:** CSP **does not stop injection, it stops injected script
from running** — second line of defence. Delivery: **header (full support)** vs `<meta http-equiv>`
("does not support all CSP features" — `frame-ancestors`/`report-uri`/`sandbox` are header-only)
vs **`-Report-Only`, which cannot be delivered in a `<meta>` at all**; ⚠️ **multiple policies
INTERSECT, never union** — a second header can only forbid more. 🔴 **`connect-src` governs
`fetch`/`XHR`/**`WebSocket`**/`EventSource`/`sendBeacon`/`<a ping>`** — the only browser-side
control over a socket, and ⚠️ **`'self'` does not resolve to websocket schemes in all browsers**.
🔴 **`default-src` is a fallback for FETCH directives only, and NINE never fall back**: `base-uri`,
`form-action`, `frame-ancestors`, `sandbox`, `report-uri`, `report-to`, `trusted-types`,
`require-trusted-types-for`, `upgrade-insecure-requests` — so `default-src 'self'` alone leaves an
injected `<base>` free to re-point every relative URL, which is why strict policies always carry
`base-uri 'none'` and `object-src 'none'`. Blocked from JS's side: **inline `<script>`, inline
event handlers (`script-src-attr`), `javascript:` URLs, and `eval`/`Function`/STRING-form
`setTimeout`** — and 🔴 **it blocks YOUR inline script too, which is the feature**, since the
browser cannot tell them apart. ⚠️ Runtime template compilers need `'unsafe-eval'` — a build
config problem, not a CSP problem. 🔴 **A domain allow-list is weak**: one JSONP endpoint, open
redirect or vulnerable library on an allowed origin defeats it → nonces + `'strict-dynamic'`.
Rollout = **enforce + report-only side by side**; the `securitypolicyviolation` event gives
`blockedURI`, `effectiveDirective` (**`violatedDirective` is a historical alias**), **`disposition`
("enforce" vs "report" — conflating them makes a report-only rollout look like an outage)**, and
**`sample` = ~first 40 chars, INLINE ONLY**; it fires on element/document/worker and bubbles.
⚠️ It cannot see violations before your script runs — `report-to` is the complete channel.
 — (Know) ✅ **16 IndexedDB** — 🏁 **written 2026-08-15**, `16-indexeddb/` =
index + `01-the-shape-of-it.md` (232) = **288 lines, ONE chunk** (Know tier — shape and traps, not
API memorisation).
🔑 **Claims, MDN-validated:** it exists because **`localStorage` is synchronous, string-only, small
and ABSENT FROM WORKERS**; IndexedDB is async, transactional, indexed, worker-available and stores
anything **structured-cloneable** (incl. **`Blob`/`File` DIRECTLY — no base64, no ~33%**).
🔴 **`onupgradeneeded` is "the only place where you can alter the structure of the database"** — the
version number IS the migration id. ⚠️ **`onblocked` is the multi-tab case and is not rare** —
another tab on the old version blocks the upgrade "until they are closed or reloaded"; the old
connection should listen for **`versionchange`** and `db.close()`. 🔴🔴 **THE bug: "Transactions are
tied very closely to the event loop. If you make a transaction and return to the event loop without
using it then the transaction will become inactive."** — so an `await` on unrelated work inside a
transaction gives **`TransactionInactiveError`**; fetch FIRST, then open the transaction. It
**auto-commits**; success is **`tx.oncomplete`, not `request.onsuccess`**; an unhandled request
error or `abort()` **rolls the whole transaction back**, so multi-store writes are genuinely atomic.
`readonly` is the DEFAULT mode. Cursors need **`cursor.continue()`** (directions `next`/`prev`/
`nextunique`/`prevunique`), `IDBKeyRange.only/lowerBound/upperBound/bound` with exclusive flags.
⚠️ **`get` on a missing record resolves to `undefined` — not an error.** ⚠️ **Valid KEYS are a
NARROWER set than valid values**: numbers, strings, dates, binary, arrays of those — **no booleans,
no `null`, no plain objects**. 🔴 **Quota-managed and EVICTABLE** — handle `QuotaExceededError` and
treat the whole store as a **cache, not a store of record**; `navigator.storage.persist()` is a
request, not a guarantee. Honest note kept: the API predates promises — wrap it, or use `idb`.
 · ✅ **17 Service workers and the Cache API** — 🏁 **written
2026-08-15**, `17-service-workers/` = index + `01-the-lifecycle-and-the-cache.md` = **263 lines,
ONE chunk**.
🔑 **Claims, MDN-validated:** the framing that makes everything else obvious — **it is a PROXY you
deploy to users' browsers, not a library you import**; hence **HTTPS-only (`localhost` exempt)**,
and **scope defaults to the worker file's directory and cannot be broader without
`Service-Worker-Allowed`** (why `sw.js` lives at the root). It is a **worker — no DOM, no `window`,
no `localStorage`** → `postMessage` + Cache API/IndexedDB. 🔴 **The two rules that catch everyone:**
a new worker **installs then WAITS** while an old one is active (a page never has its proxy swapped
mid-session), and it **"controls pages opened after successful registration" — "existing pages must
be reloaded"**, INCLUDING the page that registered it. `skipWaiting()` + `clients.claim()` override
both, and the page is written to say plainly that this is a **correctness trade** (page JS and
worker assets can disagree), with prompt-then-reload as the safer pattern. **`event.waitUntil()`**
keeps the worker alive across async install/activate work. `respondWith()` replaces the browser's
fetch. **Cache-first for static assets, network-first for dynamic** — 🔴 **NEVER cache-first the
HTML**, or users are pinned to an old shell until they clear site data. Cache API stores
**`Request`/`Response` pairs (headers + status), is NOT the HTTP cache and ignores `Cache-Control`**;
🔴 **a `Response` body is a stream read once → `response.clone()` before caching**; ⚠️
**`cache.addAll()` is ATOMIC — one 404 fails the whole install**, so the asset list belongs in the
build; ⚠️ **versioning is entirely manual** (new cache name per release, delete the rest in
`activate`). Push/Background Sync hang off it because it is the only script that runs with the page
closed. · ✅ **18 Server-sent events** — 🏁 **written 2026-08-15**,
`18-server-sent-events/` = index + `01-eventsource-and-the-stream-format.md` = **230 lines, ONE
chunk**. Written as the API + wire format, deliberately NOT re-running the SSE-vs-WebSocket
comparison, which 13/05 owns.
🔑 **Claims:** `text/event-stream`, blank-line-separated, **four fields** — `data` (repeat the
field for multi-line, joined with a newline), `event`, `id`, `retry` (**"must be an integer… if a
non-integer value is specified, the field is ignored"**), plus `:` comment lines as keep-alives.
🔴 **A named `event:` is dispatched as THAT type and NEVER reaches `onmessage`** — the commonest
"events stopped arriving". `data` is **always a string** → guarded `JSON.parse`.
🔴 **Auto-reconnect is the point**: "if the connection between the client and server closes, the
connection is restarted automatically", the `error` event is informational, `readyState` goes back
to **CONNECTING(0)** (OPEN 1, CLOSED 2). **Resumption:** per the **HTML Standard**, `Last-Event-ID`
"reports an `EventSource` object's last event ID string to the server when the user agent is to
reestablish the connection", sent only when non-empty — and ⚠️ **an `id:` field with NO value
resets it**, suppressing the header. ⚠️ **The server must actually implement replay** or the gap
is silently lost. 🔴 **`close()` is mandatory** — nothing else stops the retry loop.
**`withCredentials` is the ONLY constructor option — no headers**, so auth = cookies or a URL
ticket; ✅ but **SSE IS subject to CORS** (unlike WebSocket) and is **available in workers**.
Limits: **one-way**, text-only (base64 ~33%), and 🔴 **six connections per browser+domain on
HTTP/1.1 → the seventh tab hangs**; HTTP/2 negotiates streams (default 100). ⚠️ Buffering proxies
defeat it. ·
✅ **19 Streams** — 🏁 **written 2026-08-15**, `19-streams/` = index +
`01-the-three-streams.md` = **241 lines, ONE chunk**. Deliberately does NOT re-run the fetch reader
loop / progress / cancellation — **07/02 owns that**; this page owns the API around it.
🔑 **Claims:** three interfaces — **Readable (pull), Writable (push), Transform (both, wired)**.
🔴 **`getReader()` LOCKS the stream** ("no other reader may read this stream until the lock is
released by `releaseLock()`") — that lock IS why a body reads once, and why `clone()` exists and
why a service worker must clone before caching. `read()` → **exactly three outcomes**: chunk,
`{value: undefined, done: true}`, or rejection. ⚠️ **`for await…of` on a stream is NOT universal**
— MDN warns a browser "may not support async iteration", so library code uses `getReader()`.
🔴 **`pipeThrough`/`pipeTo` beat a manual loop because they PROPAGATE errors and cancellation both
ways** — a broken sink cancels the source; a hand-written loop must reimplement that at every exit.
🔴 **Backpressure lives in `pull` + `highWaterMark`**: `pull` is called only when the queue drops
below the mark, so a producer that enqueues **inside `pull`** cannot outrun its consumer — ⚠️ and a
producer that loops inside `start` has **no backpressure at all**. That is exactly what WebSocket
lacks (13/02). **`close()` keeps already-queued chunks readable; `cancel()` DISCARDS them** and
tells the source; `releaseLock()` returns the stream uncancelled; **`tee()` splits into two
independent streams** — ⚠️ **not free**: the slower branch's unread chunks are buffered. Free
transforms: **`TextDecoderStream`/`TextEncoderStream`** (needed because a multi-byte char can
straddle a chunk boundary), **`CompressionStream`/`DecompressionStream`** (`gzip`/`deflate`/
`deflate-raw`), and **`Blob.stream()`**. **`new Response(stream)`** is how a service worker
synthesises a body.  · ✅ **20 `sendBeacon` and keepalive** — 🏁 **written 2026-08-15**,
`20-sendbeacon-keepalive/` = index + `01-sending-on-the-way-out.md` = **190 lines, ONE chunk**.
🔑 **Claims:** the problem is that **a request dies with the page**. `sendBeacon` = **always POST**,
accepts ArrayBuffer/TypedArray/DataView/Blob/string/FormData/URLSearchParams, **no response at all**,
and 🔴 **returns `true` only for QUEUED, never delivered** — fire-and-forget by design.
**64 KiB (65,536 bytes)** limit, and it is a **shared/total budget**, not per request — the SAME
limit applies to `fetch(…, {keepalive: true})` ("The body size for `keepalive` requests is limited
to 64 kibibytes"). `keepalive` wins whenever you need **another method, custom headers, the
response, or a service worker** (MDN lists exactly those advantages); `sendBeacon` wins on brevity.
🔴 **The event matters more than the API:** MDN recommends **`visibilitychange` → `hidden`** over
`unload`/`beforeunload`, which "are unreliable (especially on mobile)", are **incompatible with
bfcache**, and can **exclude the page from bfcache**; `pagehide` is the fallback. ⚠️ **`hidden`
fires on every tab/app switch**, so the handler must be **idempotent or send deltas**; and on
mobile a backgrounded tab may be **discarded with no further event**, which is why unload never
worked there. Same rule as 13/01's `close()`-on-`pagehide`.  · ✅ **21 `XMLHttpRequest`** — 🏁 **written 2026-08-15**,
`21-xmlhttprequest/` = index + `01-what-it-still-does.md` = **193 lines, ONE chunk**.
🔑 **Claims:** MDN recommends `fetch` for new work; XHR is kept for **two** reasons — reading legacy
code, and 🔴 **`xhr.upload` progress, which `fetch` has NO equivalent for** (listening on `xhr`
itself is DOWNLOAD progress, which is why bars jump to 100%; **check `lengthComputable`**).
`readyState` table 0–4 (UNSENT/OPENED/HEADERS_RECEIVED/LOADING/DONE) and ⚠️ **`4` means FINISHED,
not SUCCEEDED** — same trap as `fetch` resolving on a 404. `setRequestHeader` only **between
`open()` and `send()`** (`InvalidStateError` otherwise); ⚠️ **`responseText` THROWS when
`responseType` is json/blob/arraybuffer**. Full mapping table onto `fetch` (`timeout` →
`AbortSignal.timeout()`, `abort()` → `AbortController`, `withCredentials` → `credentials:
"include"`, `responseType` → `.blob()`/`.json()`, load/error → resolve/reject). 🔴 **Synchronous
XHR (`open(..., false)`) is DEPRECATED on the main thread** and is the reason `sendBeacon` exists —
if found, it is almost always in an unload handler → replace with `sendBeacon`/`keepalive` on
`visibilitychange`.

🏁🏁🏁 **PHASE 11 IS COMPLETE — 21/21 at every tier (Master 5/5 · Understand 10/10 · Know 6/6),
closed 2026-08-15 by session `3d9f98b8`.** This session wrote topics **13–21: 9 topics, 22 files,
~3,900 lines, 0 files over the 300-line cap**, every page documentation-validated against MDN and
the specifications with **no sandbox and no console blocks**.
🏁🏁🏁 **THAT MAKES CHUNK A FINISHED — both its phases are done (5 ✅ 26/26 · 11 ✅ 21/21) and it
has NO queued work.** If the user says "javascript A" again, say chunk A is complete and let them
choose: chunk C or D still have work (B finished 2026-08-15), or a review pass.
⚠️ **Two topics were re-planned mid-write because a chunk exceeded 300 lines — 13 WebSocket went
2 → 5 chunks. That is the cap rule working; nothing was trimmed to fit.**

**B · phase 6** (Understand) ~~04 The iteration protocols~~ ✅ **written 2026-08-15** (2 chunks, 585
lines: two-protocols-one-handshake · making-your-own-object-iterable; MDN Iteration protocols +
`Iterator`) · ~~05 Generators~~ ✅ **written 2026-08-15** (2 chunks, 604 lines: pause-and-resume ·
lazy-sequences; MDN `function*` + `yield`) · ~~06 Async iterators~~ ✅ **written 2026-08-15** (2 chunks, 541 lines:
for-await-of · writing-async-generators; MDN `for await...of` + `async function*` + ReadableStream) ·
~~07 Paginating an API with an async generator~~ ✅ **written 2026-08-15** (2 chunks, 553 lines:
the-pattern · making-it-production-worthy; MDN `Link` + `Array.fromAsync` + `AbortSignal`) · ~~08 Early exit inside iteration~~ ✅ **written 2026-08-15** (2 chunks, 483 lines:
what-can-stop · the-cost-of-chaining; MDN forEach/some/every/find/toReversed) — **Understand tier
COMPLETE 5/5** — (Know) ~~09 Two-way generators~~ ✅ **written 2026-08-15** (2 chunks, 503 lines:
talking-back · return-and-the-coroutine-idea; MDN yield/Generator.throw/Generator.return) · ~~10 `yield*` delegation~~ ✅ **written 2026-08-15** (2 chunks, 461 lines:
what-it-delegates · composing-generators; MDN `yield*`) · ~~11 Iterator helpers~~ ✅ **written 2026-08-15** (2 chunks, 421 lines:
the-helper-set · using-them-well; MDN Iterator/Iterator.from/map/take) · ~~12 A collection class that iterates cleanly~~ ✅ **written 2026-08-15** (2 chunks,
465 lines: the-shape-to-copy · details-that-feel-native; MDN Set/Map/JSON.stringify) — (When Needed) ~~13 Driving an iterator by hand~~ ✅ **written 2026-08-15** (2 chunks, 445 lines:
when-for-of-is-not-enough · multi-iterator-algorithms; MDN iteration protocols/Generator.next/return).

✅ **PHASE 6 IS COMPLETE — 13/13 at every tier, 40 files, 0 over the 300-line cap.** Ten topics
(04–13) written 2026-08-15 by session `7c6611b4`, each a `NN-topic/` directory of README + 2 chunks,
all documentation-validated against MDN with no console blocks. **Chunk B now continues in phase 17.**
**B · phase 17** (Understand) ~~05 An EventEmitter~~ ✅ **written 2026-08-15** (2 chunks, 500 lines:
the-core · the-edge-cases; Node.js events docs + MDN EventTarget/AbortSignal) · ~~06 Deep clone~~ ✅ **written 2026-08-15** (2 chunks, 440 lines:
writing-it · use-structuredclone; MDN structuredClone + structured clone algorithm) · ~~07 A concurrency-limited task queue~~ ✅ **written 2026-08-15**
(2 chunks, 465 lines: the-pool · making-it-usable; MDN Promise.all/allSettled/withResolvers/AbortController) · ~~08 Retry with backoff, jitter and an `AbortSignal`~~ ✅ **written 2026-08-15**
(2 chunks, 449 lines: backoff-and-jitter · cancellation-and-timeouts; MDN AbortSignal/Retry-After) · ~~09 An LRU cache in O(1)~~ ✅ **written 2026-08-15** (2 chunks, 462 lines:
the-map-trick · making-it-real; MDN Map/WeakMap/performance.now) · ~~10 A Promise from scratch~~ ✅ **written 2026-08-15** (2 chunks,
480 lines: the-state-machine · resolution-and-thenables; MDN Promise/then/resolve) · ~~11 `memoize`~~ ✅ **written 2026-08-15** (2 chunks, 435 lines:
the-key-problem · bounding-and-invalidating; MDN Map/WeakMap/JSON.stringify/apply) · ~~12 Deep equality~~ ✅ **written 2026-08-15** (2 chunks,
411 lines: writing-it · what-equal-means; MDN Object.is/sameness guide/hasOwn) · ~~13 `curry`, `pipe`, `compose`~~ ✅ **written 2026-08-15**
(2 chunks, 424 lines: curry · pipe-and-compose; MDN Function.length/bind/reduce/reduceRight) · 14 `promisify` ·
15 A rate limiter — (Know) 16 `new`/`Object.create`/`instanceof` by hand · 17 A tiny pub/sub and a
reactive signal · 18 A virtual-DOM diff in outline.

**C · phase 7** (Understand) 12 Timers · 13 Creating promises · 14 Cancellation · 15 Timeouts,
retries, backoff and jitter · 16 Concurrency limiting · 17 Race conditions in a UI ·
18 `queueMicrotask` · 19 Event loop: browser vs Node — (Know) 20 `Promise.withResolvers` ·
21 Thenables · 22 Async work and backpressure.
**C · phase 8** (Understand) 05 Dynamic `import()` · 06 Circular imports · 07 `throw`/`try`/
`catch`/`finally` · 08 Custom error classes · 09 Failing well · 10 Global error handling · 11 The
memory model · 12 Finding a leak · 13 Bundlers and the build · 14 Testing JavaScript — (Know)
15 CommonJS in a modern world · 16 `AggregateError` · 17 Mark-and-sweep and generational GC ·
18 Linting and formatting.

**D · phase 12** (Understand) 03 Timers and frames · 04 `IntersectionObserver` ·
05 `ResizeObserver` · 06 `PerformanceObserver` · 07 Web Workers · 08 The History API and
client-side routing · 09 `window`, `document`, `navigator`, `screen` · 10 WebCrypto ·
11 Accessibility from JavaScript · 12 Feature detection · 13 What belongs on the server — (Know)
14 Yielding to the main thread · 15 Cross-tab coordination · 16 Clipboard, Web Share, File System
Access · 17 Permissions, Geolocation, Notifications · 18 Media · 19 Page Visibility, Wake Lock,
Battery · 20 Internationalisation in the browser — (When Needed) 21 `SharedArrayBuffer` and
`Atomics`.
**D · phase 18** — ⚠️ **only three:** 11 Infinite scroll and lazy images · 12 Long lists without
freezing · 15 Review uploads. Topics 08–10, 13, 14 and 16–18 were **dropped** 2026-08-14 and are
**not** to be written.

## Rules every chunk shares — none of these are optional

- 🔴 **Tier-locked to Understand and Know.** Master is **closed at 99/99**; a Master topic is not
  reopened to deepen it. What is left is breadth.
- 🔴 **The 300-line cap is a FILE-SIZE rule, never a content budget.** Write the explanation the
  topic deserves, **then split** into `NN-topic/` with `_category_.json`, a `README.md` index and
  numbered chunks. Check before every commit:
  `find docs/javascript -name '*.md' -exec wc -l {} + | awk '$1>300 && $2!="total"'`
- 🔴 **No sandbox, no timings, no invented output.** Documentation-validated against MDN and the
  specifications, named in each page's `> Verified:` line. No run means **no console block**.
- 🔴🔴 **PER-FILE cadence, tightened again 2026-08-15 at ~90% usage** (*"make sure your saving memory per file progress now onwards"*): write ONE file → commit it → update this memory → commit the memory. A session that dies must lose at most one file.
- 🔴 **Per-FILE cadence:** write a file → update the boards → commit → update this memory. A
  session that dies must lose at most one file.
- **Links** always end in `.md` and keep every numeric prefix. Cross-chunk references are **bold
  plain text with *(not written yet)***, never links — a link to an unwritten page breaks the build.
- **Boards after every topic:** `src/data/progress.js` (your phases' rows, `pages` + `pagesPlanned`
  mid-phase), the phase `README.md`, `docs/javascript/pages/README.md`, `docs/README.md`.
- **Everything is on `main`; there are no worktrees.** Stage explicit paths — **never `git add -A`**
  — and treat another language's build breakage as someone else's.

## Where the history lives

[[devbible-javascript-build-progress]] — the old lane A cursor, the scope cut in full, the trap
list. [[devbible-javascript-lane-b]] — the old lane B cursor and the MDN facts memory got wrong.
[[devbible-javascript-lane-a-history]] — per-session narratives. The concepts per phase are in the
`reference_javascript_concepts_phase*.md` files.

## Chunk D · session log

**2026-08-15 · session `032a926a` took chunk D** (*"pick javascript d"*). Claimed in both boards
before writing: the chunk table in `docs/javascript/pages/README.md` and the chunk-D row in
`docs/README.md`.

- ✅ **Phase 12 · 03 · Timers and frames** — `03-timers-and-frames/` with `_category_.json`, a
  `README.md` index and two chunks: `01-timers.md` (283 lines) and `02-frames.md`. Boards updated
  (`progress.js` phase 12 → `pages: 3`, phase README rewritten with a Coverage table, both index
  pages). Isolated build (`DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-jsd yarn build --out-dir
  build-jsd`) **exit 0, zero broken-link warnings**; nothing over the 300-line cap. Commit
  `96d88421`.

**Facts this topic turns on, all MDN/HTML-Standard sourced — do not re-derive from memory:**
nesting level **> 5** clamps sub-4 ms delays to **4 ms**; delay is a 32-bit signed int, so above
**2 147 483 647 ms (≈24.8 days)** it fires immediately; hidden tabs throttle to **≥1 s**, and
Chrome's **intensive throttling** aligns to **once per minute** after 5 minutes hidden with chained
timers, no audio and no active WebSocket/WebRTC; `clearTimeout`/`clearInterval` share one id map;
browser timer ids are integers, Node returns a `Timeout` object. `rAF` callbacks run in the
update-the-rendering step **before** style/layout/paint, all callbacks in a frame get the **same**
timestamp, and `rAF` is **paused** in background tabs and hidden iframes.

⚠️ **The build-isolation flags above are worth reusing** — a bare `yarn build` collides with the
other three JavaScript chunk sessions writing the same checkout.

- ✅ **Phase 12 · 04 · `IntersectionObserver`** — `04-intersectionobserver/` with an index and two
  chunks: `01-the-api.md` (root/rootMargin/threshold, the initial callback, precomputed entry
  rectangles, batched delivery, `takeRecords`, v2 `trackVisibility`) and `02-the-patterns.md`
  (declarative alternatives first, lazy hydration, sentinel infinite scroll with an in-flight
  guard, impressions = visibility **plus dwell**, scrollspy via negative margins, sticky
  sentinel, pausing offscreen work, degradable reveals). Build exit 0, 0 broken links, nothing
  over 300. Cursor → **05 · `ResizeObserver`**.

- ✅ **Phase 12 · 05 · `ResizeObserver`** — two chunks: `01-element-level-responsiveness.md`
  (container queries FIRST and the table of what is left for JS, logical `inlineSize`/`blockSize`,
  the three `box` options, `device-pixel-content-box` for crisp canvas, zero-size reports from
  `display:none`, one observer for many targets) and `02-the-loop-and-timing.md` (delivery after
  layout / before paint, the loop error explained from the spec's depth passes, it arrives as a
  **`window` error event with no stack** so `try`/`catch` never sees it, four ranked fixes with
  rAF-deferral last, cost, **no `takeRecords()` on `ResizeObserver`**, jsdom has none).
  ⚠️ Deliberately does NOT re-run the resize decision table — that is Phase 10 · 09 · 01, linked.
  Build exit 0, 0 broken links, nothing over 300. Cursor → **06 · `PerformanceObserver`**.

- ✅ **Phase 12 · 06 · `PerformanceObserver` and the metrics that matter** — **three** chunks:
  `01-the-timeline.md` (monotonic `performance.now()` + coarsened resolution, entry shape, the
  entryType table, 🔴 `buffered: true` works only with `type` and is the difference between
  working code and silence, `type`+`entryTypes` together throws, unsupported type is a silent
  no-op, resource buffer 250 default, cross-origin zeros need `Timing-Allow-Origin`),
  `02-marks-and-measures.md` (options form, `detail`, `measure()` throws `SyntaxError` on a
  missing mark so instrumentation must be wrapped, duplicate names use the most recent mark,
  clearing, `Server-Timing`), `03-the-metrics.md` (LCP ≤2.5s / INP ≤200ms / CLS ≤0.1 at **p75**,
  INP replaced FID March 2024, LCP = **last** candidate, CLS = largest **session window**
  (1s gap / 5s cap, `hadRecentInput` excluded), INP's three phases + `durationThreshold` default
  104ms floor 16ms, `longtask` >50ms vs LoAF `scripts` attribution, report via `sendBeacon` on
  `visibilitychange`, and use `web-vitals` rather than hand-rolling).
  Build exit 0, 0 broken links, longest file 283. Cursor → **07 · Web Workers**.

**Cadence note (user asked mid-session on 2026-08-15 whether the critical rules were read):**
memory is written after **every topic**, which for this chunk is every 2–4 files; the 300-line
cap is checked with the `find … awk '$1>300'` command before every commit and every topic is
chunked into a `NN-topic/` directory rather than trimmed. Phase 12 topic files run 197–283 lines
across 2–3 chunks each — depth first, split second.

- ✅ **Phase 12 · 07 · Web Workers** — **three** chunks: `01-starting-and-talking.md`
  (`new URL('./x.js', import.meta.url)` is the idiom — a bare relative string resolves against the
  DOCUMENT url and bundlers cannot see it; module vs classic + `importScripts` throws in module
  workers; same-origin only (`SecurityError`, blob workaround, `worker-src` CSP); no DOM/`window`/
  `localStorage` (sync storage deliberately withheld) but `fetch`/`indexedDB`/`crypto`/
  `OffscreenCanvas`; an uncaught worker error does NOT reject anything — `ErrorEvent` on
  `onerror`, so catch inside and post failures as data; id+pending-map request/response;
  `terminate()` vs `self.close()`; dedicated/shared/service), `02-the-message-boundary.md`
  (structured clone table both ways, **class instances arrive as plain objects**, `DataCloneError`
  thrown synchronously on the SENDER, cost charged twice, transferables list, ⚠️ transfer
  `view.buffer` not the view, `OffscreenCanvas`, `SharedArrayBuffer` needs COOP+COEP,
  `MessageChannel` so two workers skip the main-thread relay), `03-deciding-and-patterns.md`
  (the three conditions, good/bad candidate tables, **a worker never makes work faster — it frees
  the main thread**, prove it with `longtask`/LoAF, a pool + `hardwareConcurrency` is a hint not a
  budget, three levels of cancellation and only `terminate()` is real, keep the index INSIDE the
  worker).
  Build exit 0, 0 broken links, nothing over 300. Cursor → **08 · The History API and client-side
  routing**.

- ✅ **Phase 12 · 08 · The History API and client-side routing** — **three** chunks:
  `01-the-history-api.md` (title arg ignored; push vs replace is a UX decision; 🔴 `popstate` never
  fires for your own `pushState`; cross-origin → `SecurityError`; browsers rate-limit rapid calls;
  state is structured-cloned, persisted to disk, keep it tiny — the URL is the real state;
  `scrollRestoration='manual'` and restore in a frame callback AFTER render; `history.length`
  counts other origins so "can I go back" is unanswerable; traversals are not cancellable),
  `02-building-a-router.md` (the full link-interception guard list — modifier keys, `button!==0`,
  `target`, `download`, `rel=external`, cross-origin, in-page hash; `URLPattern` + regex fallback;
  route-level dynamic import; overlapping-navigation race → check `signal.aborted` after EVERY
  await; the `afterNavigate` duties table — title, live region, focus with `preventScroll`, scroll;
  the SPA fallback the server must have or deep links 404 only in production; prefetch on
  intersection), `03-the-navigation-api.md` (one `navigate` event covers clicks/forms/programmatic/
  **traversals**; `canIntercept`/`hashChange`/`navigationType`/`formData`/`signal`;
  `intercept({handler, focusReset, scroll})` gives a navigation a DURATION which is what fixes
  focus+scroll; `preventDefault()` can cancel Back when `cancelable`; `canGoBack`, `entries()`,
  `traverseTo(key)`; persisted `state` vs transient `info`; committed/finished promises).
  ⚠️ **Support for the Navigation API was deliberately NOT claimed** — the page says feature-detect
  and read MDN's table (rule 8: state uncertainty rather than invent).
  Build exit 0. ⚠️ 3 broken links appeared in `phase-5-built-in-library/22-array-likes-and-iterables/`
  — that is **chunk A's phase, mid-write**, left alone. Phase 12 clean, nothing over 300.
  Cursor → **09 · `window`, `document`, `navigator`, `screen`**.

- ✅ **Phase 12 · 09 · `window`, `document`, `navigator`, `screen`** — two chunks:
  `01-window-and-document.md` (window is global object AND browsing context; write `globalThis`;
  **named access — every element `id` becomes a window property**, the concrete argument for
  modules; `innerWidth` includes the scrollbar so it disagrees with media queries; no event for
  `devicePixelRatio` — re-register a `(resolution: Xdppx)` matchMedia; `window.open` returns null
  when blocked and needs explicit `noopener`; alert/confirm/prompt block the event loop;
  `readyState` branch or the DOMContentLoaded listener never fires; legacy shelf incl.
  `document.write` replacing the document; frames + postMessage origin checks),
  `02-navigator-and-screen.md` (userAgent lies by design and Chrome freezes it — feature-detect;
  `userAgentData` + `getHighEntropyValues`; **`onLine` is only trustworthy when false** (captive
  portal); secure-context gate explains "works on localhost"; `saveData` is the one connection
  hint worth honouring; `hardwareConcurrency`/`deviceMemory` are hints; `storage.estimate()` is
  approximate; `screen` is the display not the viewport; legacy/fingerprinting shelf).
  Build exit 0, **0 broken links in phase-12** (6 warnings elsewhere are other chunks' phases, mid-write).
  Cursor → **10 · WebCrypto** (both chunks already drafted).

- ✅ **Phase 12 · 10 · WebCrypto** — `01-randomness-and-hashing.md` (`randomUUID()` replaces every
  hand-rolled id — `Math.random()` guarantees NOTHING about unpredictability/uniqueness;
  `getRandomValues` is sync, in-place, **65 536-byte per-call cap** → `QuotaExceededError`;
  `subtle.digest` = TextEncoder → ArrayBuffer → convert yourself; SHA-1 legacy only, no MD5 at
  all; **no incremental digest in WebCrypto** so big files go to a worker or the server; hashing is
  NOT passwords, NOT secrecy (small input space = reversible), NOT integrity alone) and
  `02-the-rest-and-why-not.md` (threat-model table — client crypto cannot protect you from your own
  server/XSS/dependencies; `CryptoKey` opaque + `extractable:false` + structured-cloneable so it
  belongs in **IndexedDB, never localStorage**; 🔴 **never reuse an AES-GCM IV** — 96-bit random per
  message, IV is not secret; PBKDF2 derives a key, it is NOT login auth (Argon2/scrypt are
  server-side and not in the API); use `subtle.verify`, JS has no constant-time compare; "don't roll
  your own crypto" is about PROTOCOL, not algorithms).
- ✅ **Phase 12 · 11 · Accessibility from JavaScript** — `01-the-four-moments.md` (native element
  first, **ARIA describes but never implements**; route change owes title+focus+announcement+scroll
  and the missing focus move is the #1 SPA a11y bug — Navigation API `focusReset` is the argument
  for adopting it; ⚠️ **a live region inserted WITH its text often announces nothing** — ship it
  empty in the HTML; assertive interrupts the user's own typing; `<dialog>.showModal()` gives the
  focus trap free but restoring focus is still yours; removing the focused element drops focus to
  `<body>`; roving `tabindex` = Tab enters/leaves, arrows move inside) and
  `02-preferences-and-testing.md` (the four media queries, **watched not sampled** — users toggle
  mid-session; `Element.animate`/`rAF`/`scrollIntoView` ignore `prefers-reduced-motion` entirely;
  reduced ≠ none; the inline `<head>` theme script is the one correct blocking script + CSS
  `color-scheme` for UA widgets; under `forced-colors` get out of the way, background-image icons
  vanish; keyboard pass → a11y tree → screen reader, and automated tools cover mechanical failures
  only).
  ⚠️ Deliberately the DECISION layer — the mechanics stay in Phase 9 · 15, linked, not re-run.
  Commits `16c289be` + `f8203efa`. Phase 12 now **11/21**. Cursor → **12 · Feature detection**.

🔴 **User warned at ~90% usage on 2026-08-15: save memory PER FILE from here on.** Do not batch a
topic's files before writing this file.

- 🚧 **Phase 12 · 12 · Feature detection — chunk 01 written and committed** (`01-detecting-a-capability.md`):
  the four check shapes and 🔴 prefer the platform's own REGISTRY (`CSS.supports`,
  `PerformanceObserver.supportedEntryTypes`, `navigator.canShare(data)`, `canPlayType`,
  `Intl.supportedValuesOf`); five failure modes — present-but-throws (localStorage in private mode
  needs a real write probe), secure-context gating, permission gating, an unsupported OPTION (the
  passive getter probe), and absent in worker/SSR so use `typeof X !== 'undefined'` which never
  throws; one frozen capability module so the fallback branch is stubbable and actually tested;
  ⚠️ preferences/onLine/permissions/DPR are STATE — watched, never cached. Next file:
  `02-progressive-enhancement.md`, then the topic README.
- 🚧 **topic 12 chunk 02 written and committed** (`02-progressive-enhancement.md`): the three
  layers and 🔴 the real test is "what does the user get while JS loads or when it fails";
  PE vs graceful degradation; enhance markup that already worked (links, `<form action method>`,
  custom elements upgrading in place, `@supports`); ⚠️ **the failure that undoes it all is an
  enhancement that HIDES content** (`opacity:0`/`display:none` until hydration → blank page on
  script failure); polyfill vs ponyfill vs neither, conditional `await import()` so modern browsers
  pay nothing; what CANNOT be polyfilled (threads, codecs, crypto primitives, permissions);
  `nomodule`; **Baseline** newly-available = fine as enhancement, poor as foundation; test the
  fallback in CI by stubbing the capability module. Next: the topic README.
- ✅ **topic 12 COMPLETE** — index written, boards updated (phase 12 now **12/21**, `pages: 12`).
  Cursor → **13 · What belongs on the server instead** (last Understand topic of phase 12; then the
  seven Know topics 14–20 and When-Needed 21).
- 🚧 **Phase 12 · 13 · What belongs on the server — chunk 01 committed** (`01-the-trust-boundary.md`):
  🔴 anything the browser computes the user can change — not "an attacker", anyone with DevTools or
  curl; the forged-assumptions table; **the honest list** as a three-column may/must table (authn,
  authz per request, validation, prices/totals, coupons, inventory, business rules, secrets, rate
  limiting, ids, TIME, file type/size, entitlements, field-level visibility); 🔴 **"never send and
  hide"** — filtering in the UI leaves the data in the response; client validation is a UX feature
  and a client/server schema mismatch is itself a bug; there is NO secret in a bundle — `HttpOnly`
  cookies vs `localStorage` under XSS; the header table only a server can set (CSP, HSTS, nosniff,
  frame-ancestors, cookie flags, Permissions-Policy, CORS/TAO). Next: `02-getting-it-right.md`.
- 🚧 **topic 13 chunk 02 committed** (`02-getting-it-right.md`): ONE shared schema enforced twice
  (shared schema ≠ shared trust); 🔴 **post intent, never conclusions** — items+quantities, never
  totals/tax/discounts; optimistic UI that **adopts the server's response even when it agrees**;
  idempotency key generated once per user INTENT (regenerating per retry defeats it); BFF proxy for
  third-party keys, but whitelist operations or it is an SSRF/open proxy; `HttpOnly`+`Secure`+
  `SameSite` and 🔴 logout that only clears localStorage is not logout; **what the client
  legitimately owns** — perceived speed, presentation state, input assistance, offline drafts,
  a11y, and the only real measurement of user experience; a 6-point per-feature checklist.
  Next: the topic README, then phase 12's Know tier (14–20) + When-Needed 21.
- ✅ **topic 13 COMPLETE — and with it the ENTIRE UNDERSTAND TIER of phase 12 (03–13, eleven
  topics, 25 files).** Boards updated: phase 12 **13/21**, `pages: 13`, phase README now shows
  Understand 11/11 ✅ and the Know row as 🚧 next. Commit `5045100e`.
  🔴 **Next: the Know tier, topics 14–20** — 14 Yielding to the main thread · 15 Cross-tab
  coordination · 16 Clipboard/Web Share/File System Access · 17 Permissions, Geolocation,
  Notifications · 18 Media · 19 Page Visibility, Wake Lock, Battery · 20 Internationalisation in
  the browser — then **When Needed 21 `SharedArrayBuffer` and `Atomics`**, then phase 18's three
  kept topics (11, 12, 15).
- ✅ **Phase 12 · 14 · Yielding to the main thread (Know)** — written as a **flat file**
  (`14-yielding-to-the-main-thread.md`), matching the phase-5 convention for single-file topics.
  🔴 `scheduler.yield()` prioritises the continuation whereas `setTimeout(0)` sends it to the BACK
  of the queue (responsive but starved); yield on **elapsed time (~50 ms)**, never every N items;
  `postTask` priorities + `TaskController` can **re-prioritise** a queued task and abort it;
  `requestIdleCallback` needs a `timeout` or may never fire, must respect
  `deadline.timeRemaining()`, and does not run in a background tab; `isInputPending()` noted as
  non-portable; the decision ladder ending in "do less". Next: **15 · Cross-tab coordination**.
- ✅ boards updated for topic 14 (phase 12 **14/21**, `pages: 14`, Know 1/7).

## 🔴 CHECKPOINT 2026-08-15 — usage limit approaching, safe stopping point

**Everything is committed** — devbible `main` and this store. Nothing is unsaved.
**Chunk D stands at 12 topics written this session** (phase 12 · 03–14), **29 files**, 0 over the
300-line cap, phase 12 clean in every build run.

**Remaining for chunk D — 8 topics:**
1. Phase 12 **Know 15–20** — Cross-tab coordination (`BroadcastChannel`, `storage` event, Web
   Locks) · Clipboard/Web Share/File System Access · Permissions, Geolocation, Notifications ·
   Media · Page Visibility, Wake Lock, Battery · Internationalisation in the browser.
2. Phase 12 **When Needed 21** — `SharedArrayBuffer` and `Atomics` (COOP/COEP first).
3. Phase 18 — **only topics 11, 12, 15** (infinite scroll and lazy images · long lists without
   freezing · review uploads). Everything else in phase 18 is dropped.

## Chunk D · session `dbaa68e7` — resumed 2026-08-15 (*"Pick javascript d"*)

Took chunk D over from `032a926a`; both boards repointed (`docs/javascript/pages/README.md` chunk
table and the chunk-D row in `docs/README.md`) before any page was written.

- 🚧 **Phase 12 · 15 · Cross-tab coordination (Know) — chunk 01 written and committed**
  (`15-cross-tab-coordination/01-the-channels.md`, 278 lines, commit `dad71418`).
  🔴 **The framing that gives the topic its spine: there are TWO problems, not one** — *telling*
  the other tabs (BroadcastChannel / `storage` event) and *deciding which tab acts* (Web Locks,
  file 02). Broadcasting "I am refreshing the token" does not stop the other tabs, because they
  broadcast the same thing at the same moment.
  🔑 **Facts, all MDN + HTML-Standard sourced — do not re-derive:** `BroadcastChannel` excludes
  **the sending OBJECT, not the tab**, so a second channel of the same name in the same document
  DOES receive; `postMessage` on a **closed** channel throws **`InvalidStateError`**;
  `messageerror` for undeserializable messages; the spec sorts destinations in one agent by
  **creation order, oldest first**; the spec "strongly encourages" `close()` for GC; channels are
  scoped by **storage key**, so partitioning can be narrower than origin. `storage` event: never
  fires in the writing tab; **`setItem` with an unchanged value broadcasts NOTHING** (spec: *"If
  oldValue is value, then return"*) — the reason a fixed sentinel signals once; **`clear()` fires
  one event with `key`/`oldValue`/`newValue` ALL null**; `removeItem` gives `newValue: null`;
  **`sessionStorage`'s event is same-top-level-browsing-context only** (iframes, never another tab).
  `SharedWorker` = one instance per origin via `MessagePort`, ⚠️ uneven support → feature-detect;
  a service worker is event-driven and **may be stopped**, so message it explicitly and answer via
  `clients.matchAll()`. Also written: send an **event, not a diff**; version the envelope because
  two tabs can run two deploys.
  ⚠️ Deliberately **not** claimed: whether a channel message wakes a stopped service worker (rule 8
  — state uncertainty rather than invent).
  ⚠️ **Planned as 2 chunks; became 3.** `02-locks-and-the-patterns` came in at **308 lines**, so it
  was **split on a concept boundary** (the API vs the patterns), not trimmed.

- ✅ **Phase 12 · 15 · Cross-tab coordination — COMPLETE**, 3 chunks + index, **771 lines**
  (01 the-channels 278 · 02 web-locks 189 · 03 the-patterns 246 · README 58), commit `8df7a0ae`.
  🔑 **Web Locks facts, MDN + `w3c.github.io/web-locks` sourced:** `request(name, options?,
  callback)` resolves with the **callback's return value, after release** — the lock's lifetime IS
  the callback's, released on return **or throw**, so there is no `unlock()`; 🔴 **the spec
  terminates an agent's locks when the agent terminates**, which is the entire argument against a
  `localStorage` "isRefreshing" flag (that flag survives the crash that set it and wedges every
  tab); the manager belongs to the **storage bucket** and is shared *"even if they are in unrelated
  browsing contexts"*, and *"locks do not span origins"*; fair FIFO — *"only the first item in a
  queue is grantable"*; **no state persists across browsing sessions**; secure context + workers.
  `ifAvailable` calls back with **`null`**, not an exception; `steal` preempts but ⚠️ **does not
  stop the previous holder's code**; `signal` aborts **the wait only**, `AbortError`;
  **`NotSupportedError` is spec-mandated** for a name starting with `-`, `steal`+`ifAvailable`
  together, or `signal` with either; `query()` → `{held, pending}` of `{name, mode, clientId}` and
  is a **snapshot for diagnostics, never a decision**; the spec's own non-normative deadlock
  warning. Patterns written: **do-it-once with the re-check INSIDE the lock** (without it, rotating
  refresh tokens log the user out — "random logouts with several tabs open"), **leader election =
  a callback returning `new Promise(() => {})`**, `ifAvailable` for "already open in another tab",
  a `signal` deadline, readers/writer, the **late joiner** (a channel has no replay → persist and
  hydrate; `visibilitychange` + revalidate is the baseline that makes the rest optional), and
  "log out everywhere" end to end — **the lock decides, storage persists, the channel notifies**,
  with server revocation underneath because only the server makes it true.
  Boards updated: phase 12 **15/21**, `pages: 15`, Know 2/7; topic 14's footer now links forward.
  ⚠️ Those board edits were swept into chunk C's commit `464ddbf0` before mine landed — expected on
  the shared checkout, content verified present in `HEAD`.
  🔴 **Cursor → 16 · Clipboard, Web Share and File System Access (Know).** 6 topics left in phase
  12 (16–20 Know, 21 When Needed), then phase 18's three kept topics.

- 🚧 **Phase 12 · 16 · Clipboard, Web Share and File System Access — chunk 01 written and
  committed** (`16-clipboard-share-files/01-the-clipboard.md`, 185 lines, commit `19fb5384`).
  🔑 **MDN facts:** `navigator.clipboard` is **secure-context only and absent in Web Workers**, and
  MDN says to prefer it over the **deprecated `execCommand`**; writing needs **transient
  activation** — ⚠️ an `await` between the click and `write()` spends it, which is the intermittent
  `NotAllowedError`; **the browsers differ on purpose** — Chromium wants `clipboard-write`
  permission *or* activation (and remembers it once granted), Firefox/Safari want activation only;
  **reading** is the gated direction — Chromium prompts for `clipboard-read` when the document has
  focus, Firefox/Safari show an ephemeral **Paste context menu enabled after ~1 s**, so 🔴 **there
  is no reliable "read the clipboard" button**. `ClipboardItem` keys are MIME types, values strings
  or `Blob`s; `getType()` returns a **Blob**; `ClipboardItem.supports()` is the registry check; and
  🔴 **write every representation in one item** (no `text/plain` = nothing useful pastes into a
  plain field). 🔴 **The `paste`/`copy`/`cut` events need NO permission** because the user acted —
  `clipboardData` is a `DataTransfer`, `items[i].getAsFile()` gets the screenshot, and
  `preventDefault()` + `setData()` overrides what is copied. Iframes need the embedder's
  `Permissions-Policy`.
  ⚠️ **Not claimed:** whether `ClipboardItem` accepts Promise values (the Safari async trick) — the
  MDN page does not state it, so the page says "prepare the data before the click" instead (rule 8).
  Next file: `02-web-share.md`, then `03-file-system-access.md`, then the topic README.
- 🚧 **topic 16 chunk 02 written and committed** (`02-web-share.md`, 157 lines, commit `bd4cf9ff`):
  replaces the hand-maintained row of per-network intent URLs. `share(data)` takes
  `title`/`text`/`url`/`files`, **at least one recognised property** or `TypeError`; needs **secure
  context + transient activation + the `web-share` permission policy**. 🔴 **`AbortError` means
  EITHER the user cancelled OR there were no share targets, and they are indistinguishable by
  design** — so it is a silent no-op, never an error toast. 🔴 **You never learn whether the share
  succeeded or where it went**, so "shares" is not a measurable metric. `NotAllowedError` =
  policy/activation/refused file share; `InvalidStateError` = not fully active **or a share already
  in progress**; `DataError` = target could not be started. **`navigator.canShare(data)` checks the
  PAYLOAD, not the API** — file sharing needs both `'share' in navigator` and `canShare({files})`,
  and it is the second that fails on desktop. Shipping pattern written as `shareOrCopy()`:
  native sheet → `AbortError` silent → clipboard fallback. ⚠️ MDN's own "limited availability" note
  carried on the page.
  Next file: `03-file-system-access.md`, then the topic README.
- ✅ **Phase 12 · 16 COMPLETE** — chunk 03 (`03-file-system-access.md`, 200 lines, commit
  `bbe794bd`) and the topic README; **4 files, 660 lines**, boards committed as `8cc12a6a`.
  🔑 **File System Access facts (MDN):** the pickers return **handles, not paths** — a capability
  for one file, and 🔴 **cancelling the picker rejects with `AbortError`**, a normal outcome.
  🔴 **Nothing reaches the real file until `close()`** — MDN: changes *"won't be reflected in the
  file… until the stream has been closed"*, implemented as a temp file swapped in on close (so a
  crash mid-write is safe, and a forgotten `close()` silently saves nothing).
  `createWritable({keepExistingData:true})` for partial edits (a fresh writable starts EMPTY, which
  is the truncation bug); `write({type:'seek'|'write'|'truncate'})`; ⚠️ **`mode` defaults to
  `'siloed'` — several tabs can hold writers, each with its own swap file, LAST FLUSH WINS**;
  `'exclusive'` throws **`NoModificationAllowedError`** for the second writer (ties straight into
  topic 15's lock). Exceptions: `NotAllowedError` (no readwrite grant), `NotFoundError`,
  `AbortError` (malware/safe-browsing check). **Handles are structured-cloneable → IndexedDB**, but
  🔴 **the PERMISSION does not persist** — `queryPermission` never prompts, `requestPermission`
  **requires transient activation** and throws `SecurityError` without one, cross-origin, or in a
  worker; so re-grant on the first save CLICK, never at startup. **OPFS** =
  `navigator.storage.getDirectory()`, no picker/prompt/user-visible files — storage with a file
  API; **`createSyncAccessHandle()` is synchronous and worker-only** (read/write/getSize/flush/
  close), which is what WASM databases need.
  🔴 **Cursor → 17 · Permissions, Geolocation and Notifications (Know).** Phase 12 is **16/21**;
  5 left (17–20 Know, 21 When Needed), then phase 18's three kept topics (11, 12, 15).

- ✅ **Phase 12 · 17 · Permissions, Geolocation and Notifications — COMPLETE**, 3 chunks + index,
  **588 lines** (01 the-permission-model 177 · 02 geolocation 180 · 03 notifications 179), commits
  `7e255c67`, `9c6a6b15`, `a09ae0a4`, boards `48b20e6a`.
  🔑 **Permissions (MDN):** three states `granted`/`denied`/`prompt`; 🔴 **`query()` NEVER prompts**
  — the real API call does, which is what makes check-then-ask-in-context possible;
  ⚠️ **`Permissions.revoke()` was REMOVED from browsers**, so a denial is unrecoverable from script
  and `denied` is a screen to design, not a decision to re-litigate; **a `Permissions-Policy` block
  also reports `denied`**, so denied ≠ "the user said no"; `PermissionStatus` fires **`change`** —
  permission is state to WATCH, and the listener dies with the dropped status object; the queryable
  name list varies, so wrap `query()` and let it return a fourth state `'unknown'`. Design section:
  🔴 **the pre-prompt/priming pattern** — your own UI with *Not now* (keeps the state at `prompt`)
  before the real prompt (a refusal is forever); one prompt at a time; ask for the least; always
  ship the refused path.
  🔑 **Geolocation:** 🔴 **`timeout` defaults to `Infinity`** — the spinner that runs forever and
  never logs, and it never reproduces in dev; `maximumAge: 0` (a cached fix is the cheap win);
  `enableHighAccuracy` = GPS = battery; 🔴 **`coords.accuracy` is a RADIUS in metres and part of the
  answer** — a 3 km fix must not render as a pin; altitude/heading/speed are frequently `null`;
  error codes **1 PERMISSION_DENIED · 2 POSITION_UNAVAILABLE · 3 TIMEOUT**, and the rejection value
  is a `GeolocationPositionError`, **not an `Error`** (no stack, don't `instanceof`);
  `watchPosition`/`clearWatch` + pause on `visibilitychange`; secure context; iframe needs
  `allow="geolocation"`; ⚠️ MDN's own note that the API may be unusable in **China**. Written
  angle: **most "location" features want a coarse server-side location and no prompt at all**.
  🔑 **Notifications:** `'default'` **is treated as denied**; `requestPermission()` needs a gesture
  (MDN: *"browser security policies prevent permission requests on page load"*); 🔴🔴 **`new
  Notification()` throws a `TypeError` on most MOBILE browsers — MDN says persistent notifications
  via `registration.showNotification()` are required there**, so notifications are a SERVICE WORKER
  feature, not a page feature; `tag` replaces, `renotify` re-alerts, `requireInteraction`, `data`;
  the correct `notificationclick` handler = **close + `event.waitUntil` + `clients.matchAll` then
  `focus()`** instead of opening a duplicate tab; Push wakes the worker, the worker shows the
  notification, and subscriptions expire/revoke. ⚠️ MDN marks the API **limited availability**.
  🔴 **Cursor → 18 · Media from JavaScript (Know).** Phase 12 is **17/21**; 4 left (18–20 Know,
  21 When Needed), then phase 18's three kept topics (11, 12, 15).

- ✅ **Phase 12 · 18 · Media from JavaScript — COMPLETE**, 3 chunks + index, **587 lines**
  (01 controlling-media-elements 179 · 02 capture 169 · 03 canvas-2d 181), commits `bae8acc3`,
  `94329412`, `9e160495`, boards `2b6e7ac5`.
  🔑 **Media elements:** `play()` returns a **promise** rejecting with **`NotAllowedError`**
  (autoplay policy / no activation / permissions policy) or **`NotSupportedError`** (format) — MDN
  stresses the policy applies to **script-initiated** playback, so 🔴 the button must follow the
  *outcome*, not the click; muted (+`playsinline`) is what autoplays. 🔴 **Render from events, never
  from your own state** — the user can pause from the OS/keyboard/PiP. ⚠️ **`duration` is `NaN`
  before `loadedmetadata`** (the `NaN%` scrubber) and `Infinity` for live; **`buffered`/`seekable`
  are `TimeRanges`** with `length` + `start(i)`/`end(i)`, so `end(0)` is wrong after a seek;
  `timeupdate` is **not** a frame clock → rAF for a smooth bar. `preload` none/metadata/auto (auto is
  only a hint). ⚠️ Adaptive streaming (HLS/DASH) support varies — MSE + a library, deliberately not
  claimed further.
  🔑 **getUserMedia:** constraints are **required (`true`) / forbidden (`false`) / preferred (plain
  value) / hard (`min`,`max`)** — a `min` nothing satisfies gives **`OverconstrainedError`** with
  `err.constraint`. Failure table: `NotAllowedError` · **`NotFoundError` = no such device** ·
  **`NotReadableError` = another APP holds the camera** · `OverconstrainedError` · `AbortError` ·
  `SecurityError` · `TypeError` (empty constraints or insecure context). ⚠️ **On HTTP
  `navigator.mediaDevices` is `undefined`**, so the symptom is a `TypeError` on a property read.
  🔴🔴 **MDN: if the user ignores the prompt the promise NEITHER resolves NOR rejects** — never gate
  a spinner on it alone. 🔴 **Release = `stream.getTracks().forEach(t => t.stop())`** — hiding the
  `<video>` leaves the required in-use indicator ON, and stopping only the video track leaves the
  mic live. **`enumerateDevices()` labels are EMPTY until permission is granted for that device
  kind** (request first, then build the picker); `OverconstrainedError` can fire *before* the prompt
  = a fingerprinting surface; `devicechange` event. `getDisplayMedia` always shows the browser's own
  picker and the user can stop from browser UI → listen for the track's `ended`. `MediaRecorder`
  codec support varies — check, do not hard-code.
  🔑 **Canvas 2D:** 🔴 **bitmap size (`width`/`height` attributes) vs CSS size are independent** —
  `canvas.width = css * devicePixelRatio` + `ctx.scale(dpr,dpr)` is the blur fix; ⚠️ **assigning
  `width`/`height` CLEARS the canvas and resets the context state**; no event for a DPR change
  (re-register a `matchMedia('(resolution: Xdppx)')`). `getContext('2d', {alpha, willReadFrequently,
  desynchronized, colorSpace})` — **`willReadFrequently` forces SOFTWARE rendering** (MDN), and
  `getContext` returns **`null`** for an unsupported type or a canvas already in another mode, with
  the same object returned for repeat calls. `drawImage` takes a `<video>`/`<img>`/canvas/
  `ImageBitmap` — the bridge from a camera stream to an upload; **`toBlob` beats `toDataURL`**
  (async, real bytes, no ~33% base64). 🔴 **Tainting:** cross-origin content without CORS approval
  makes `getImageData`/`toBlob`/`toDataURL`/`captureStream` throw **`SecurityError`**, and
  ⚠️ **`crossOrigin='anonymous'` alone is not enough — the server must send the header** (works
  locally, throws against the CDN). Written honestly: **canvas has NO accessibility** — no DOM, no
  selection, no find-in-page — so SVG/elements for anything semantic, canvas for pixels;
  `OffscreenCanvas` + `transferControlToOffscreen()` for worker rendering.
  🔴 **Cursor → 19 · Page Visibility, Wake Lock and Battery (Know).** Phase 12 is **18/21**; 3 left
  (19–20 Know, 21 When Needed), then phase 18's three kept topics (11, 12, 15).

- ✅ **Phase 12 · 19 · Page Visibility, Wake Lock and Battery — COMPLETE**, 2 chunks + index,
  **374 lines** (01 the-page-lifecycle 157 · 02 wake-lock-and-battery 161), commits `d6fecbcc`,
  `e70a4131`, boards `48bb8568`.
  🔑 **Lifecycle:** `visibilityState` is `'visible'|'hidden'`, and **`hidden` covers a background
  tab, a MINIMISED window and the screen being off**. 🔴 **`hidden` is the last reliable moment** —
  MDN says `pagehide` is *not reliably fired on mobile* (app switch then killed from the app
  manager) and names `visibilitychange` the more reliable option; pair it with **`sendBeacon`**
  because a `fetch` may not complete, and make the save **idempotent** (it fires on every tab
  switch). 🔴 **An `unload`/`beforeunload` listener makes the page INELIGIBLE for bfcache; a
  `pagehide` listener does not** — keep `beforeunload` registered only while unsaved work exists.
  🔴 **`pageshow.persisted === true` = restored from bfcache, so NO script re-ran** — stale clock,
  stale cart, maybe-expired session; `pagehide.persisted` distinguishes frozen from discarded. On
  return **revalidate, never replay the backlog**, and compute countdowns from timestamps.
  🔑 **Wake Lock:** `navigator.wakeLock.request('screen')` → a **`WakeLockSentinel`**; 🔴 **the
  browser releases it automatically** when the document is inactive/hidden, on low battery, or in
  power-save — so the `release` event plus **re-acquiring on `visibilitychange`** (guarded by the
  user's still-active intent) is part of every implementation; `NotAllowedError` covers all of
  those; secure context; `screen-wake-lock` permissions-policy defaults to `self` so an iframe needs
  `allow`. It keeps the SCREEN on and nothing else — **not** for keeping a download alive.
  🔑 **Battery:** `navigator.getBattery()` → `level` 0–1, `charging`, `chargingTime`,
  `dischargingTime` + four `*change` events. ⚠️ MDN: **limited availability, not Baseline, NOT in
  Web Workers**, and a fingerprinting surface — written as **the API to know about and mostly not
  use**, with `saveData`, `prefers-reduced-motion`, visibility/idle scheduling and an explicit user
  setting as the honest alternatives.
  🔴 **Cursor → 20 · Internationalisation in the browser (Know)** — the LAST Know topic of phase 12.
  Then **When Needed 21 · `SharedArrayBuffer` and `Atomics`** (COOP/COEP first) closes the phase,
  and chunk D moves to phase 18's three kept topics (11, 12, 15).

- ✅ **Phase 12 · 20 · Internationalisation in the browser — COMPLETE**, 2 chunks + index,
  **411 lines** (01 locale-and-negotiation 164 · 02 applying-it-in-the-dom 182), commits `1ea9d8a1`,
  `cf174c1b`. ⚠️ **Written as CONCEPT + APPLICATION, not a second `Intl` page** — it links to
  chunk A's [[phase 5 · 20 · Intl]] (`../../phase-5-built-in-library/20-intl/README.md`, which
  exists) and says so at the top.
  🔑 **Facts:** `navigator.language` **is** `navigator.languages[0]`; the list is ordered by
  preference; ⚠️ **MDN: it may be truncated for anti-fingerprinting — Safari ALWAYS, Chrome
  incognito** — so a one-entry list proves nothing; `languagechange` fires on `window`.
  🔴 **Never render with `navigator.language` — negotiate**: walk the list in order, exact match,
  then base-language match, then a default; **formatting locale ≠ translation locale** (the `Intl`
  constructors negotiate themselves and take the raw list; your bundles do not);
  `Intl.getCanonicalLocales()` **throws `RangeError`** on a malformed tag → a validator for a locale
  from a URL/cookie/DB. Signal-strength table with 🔴 **server-side negotiation from
  `Accept-Language` + `Vary: Accept-Language`** at the top and IP geolocation at the bottom; the
  language belongs in the URL. `Intl.DateTimeFormat().resolvedOptions().timeZone` is how you learn
  the IANA zone; 🔴 **currency never follows the locale** (locale = presentation, currency = data).
  DOM half: `lang`/`dir` are **functional** (screen-reader voice, hyphenation, fonts, `:lang()`) and
  a client-side switch must set both; CSS **logical properties** instead of hand-mirroring;
  `<time datetime>`; 🔴 **there is NO `Intl` parser** (use `<input type="number">`;
  `formatToParts()` only tells you the separators); **reuse formatters/collators** because
  `toLocaleString`/`localeCompare` are hidden constructor calls; sort with **`Intl.Collator`
  (`numeric: true`)** because `<` compares UTF-16 code units; **`Intl.PluralRules.select()`** and a
  category-keyed catalogue instead of `n === 1 ? …`; **never concatenate translated fragments**;
  🔴 **the SSR/hydration mismatch** — the server does not know the browser's zone or negotiated
  locale, so format on one side or send the resolved zone.

- ✅ **Phase 12 · 21 · `SharedArrayBuffer` and `Atomics` (When Needed) — COMPLETE**, 2 chunks +
  index, **395 lines** (01 cross-origin-isolation 154 · 02 shared-memory-and-atomics 183), commits
  `f8213064`, `b20b0aac`, index+boards `d3cf6c2a`.
  🔑 **Facts:** shared memory + high-resolution timers were **disabled in early 2018 over Spectre**
  and re-enabled in 2020 behind **cross-origin isolation** — `COOP: same-origin` + `COEP:
  require-corp` over HTTPS, read as the **`crossOriginIsolated`** boolean; ⚠️ **without it the
  constructor is HIDDEN from the global object** (not merely restricted) and `postMessage` throws
  for a SAB obtained via `WebAssembly.Memory`. 🔴 **What isolation breaks** — every cross-origin
  subresource must opt in with `CORP`/CORS (CDN images, fonts, third-party scripts, iframes) and
  `COOP: same-origin` severs `window.opener`, so **popup OAuth/payment flows break**; mitigation
  written as *isolate a separate origin/page*. `COEP: credentialless` mentioned as an alternative
  **without claiming its support** (rule 8). 🔴 **Sharing is a THIRD postMessage behaviour** —
  copied (clone) vs transferred (detaches sender) vs **shared (both keep it; a SAB is NOT
  transferable)**; growable via `{maxByteLength}` + `grow()`, **never shrinkable**.
  🔴 **Plain reads/writes have no visibility guarantee across agents** (MDN), hence `Atomics`:
  load/store/exchange · add/sub · and/or/xor · **compareExchange** · wait/notify/**waitAsync** ·
  isLockFree/pause. 🔴 **`Atomics.wait()` is forbidden on the main thread and throws** —
  `waitAsync` is the non-blocking counterpart; `notify` returns **how many** were woken. Honest
  ending: the real audience is **WebAssembly threads** (`WebAssembly.Memory({shared:true})`), and a
  transferred `ArrayBuffer` covers almost every worker case with none of this cost.

## 🏁 PHASE 12 IS COMPLETE — 21/21 at every tier (2026-08-15, session `dbaa68e7`)

Master 2 · Understand 11 · Know 7 · **When Needed 1** — all written. This session wrote topics
**15–21: 7 topics, 25 files, ~4,300 lines**, 0 over the 300-line cap, every page
documentation-validated against MDN and the specs with **no sandbox and no console blocks**.
Boards closed: `progress.js` phase 12 → `pages: 21` with **`pagesPlanned` REMOVED** (phase
finished), the phase README rewritten as ✅ COMPLETE, `docs/javascript/pages/README.md` phase row +
chunk-D rows, and the chunk-D row in `docs/README.md`.

⚠️ **Link check used while builds were contended:** a Python walk of every relative `.md` link in
`docs/javascript/pages/phase-12-browser-platform/` (67 files) resolved **0 broken**. The first
isolated `yarn build` of the session was **killed (exit 129) after ~40 minutes** with four sessions
building at once — not a content failure, no warnings were emitted before it died; a second build
was started after the phase closed.

- ✅ **Phase 18 · 11 · Infinite scroll and lazy images — COMPLETE**, 2 chunks + index, **~420
  lines** (01 the-endless-list 189 · 02 images-that-do-not-shift 172), commits `507d9a1f`,
  `30891cad`, index+boards `c1c5ba44`. Phase 18 is now **8/10 in scope**, `pages: 8`.
  🔑 **List half:** sentinel + `rootMargin` (start early), ⚠️ **keep the sentinel OUTSIDE the item
  list** or replacing the last item silently unobserves it; a four-state loader
  (`idle|loading|error|done`) where 🔴 **the in-flight guard is THE bug** — the sentinel is still
  intersecting while the first request runs, so three pages load at once; 🔴 **cursor pagination,
  never offsets** (an insert mid-scroll duplicates/drops rows); an error state with a retry, because
  a silent stop is indistinguishable from the end of the catalogue; `AbortError` is not an error.
  🔴 Written as a UX/a11y decision: **a "Load more" button is the better DEFAULT** — the unreachable
  footer, no announcement for keyboard/SR users, no shareable URL — with live region + real button +
  `replaceState` cursor + scroll restoration (`history.scrollRestoration='manual'`, render before
  scrolling, bfcache does it free) as the mitigations.
  🔑 **Image half, all MDN-quoted:** `width`+`height` *"enables the aspect ratio to be calculated…
  used to reserve the space"*, and MDN says it is *"especially important for lazy-loaded"* images;
  🔴 **never lazy-load the LCP/above-the-fold image** — MDN: *"Lazy-loaded images will never be
  loaded if they do not intersect a visible part of an element… because unloaded images have a
  `width` and `height` of `0`"*, and lazy images in the viewport *"may not yet be visible when the
  `load` event is fired"*; `fetchpriority="high"` for the LCP candidate; **`w` vs `x` descriptors
  must never be mixed** (invalid) and **`sizes` defaults to `100vw`** so omitting it downloads the
  biggest file; `decoding="async"`; JS keeps only placeholders, `error` fallbacks, first-N priority
  and next-page prefetch — ⛔ **do not hand-roll `data-src` lazy loading any more**;
  `content-visibility: auto` as the cheap windowing.
  🔴 **Next: 12 · Long lists without freezing** (windowing from scratch, and when it beats rendering
  everything). ⚠️ **Topic 15 · Review uploads is NOT mine** — it belongs to the second session.

🔴 **CHUNK D NOW CONTINUES IN PHASE 18 — only three topics, and only these three:**
**11 · Infinite scroll and lazy images** → **12 · Long lists without freezing** →
**15 · Review uploads**. Topics 08–10, 13, 14 and 16–18 were **dropped** on 2026-08-14 and are not
to be written. They lean directly on phase 12's `IntersectionObserver` (04), workers (07),
yielding (14) and the File/upload work (16), so link rather than re-explain.

⚠️ **Build note:** a full `yarn build` now takes >10 min with four sessions on the machine. Use
`DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-jsd yarn build --out-dir build-jsd`, then
`grep "source file" <log> | grep phase-12` — other phases' warnings belong to other chunks.

## Chunk B · session log

**2026-08-15 · session `233dede7` took chunk B** (*"Pick javascript b"*), taking over from
`7c6611b4`. Claimed in both boards first (the chunk table in `docs/javascript/pages/README.md`
and the chunk-B row in `docs/README.md`), commit `b47a92d8`.

- 🚧 **Phase 17 · 14 · `promisify` — files 01 and 02 committed** (`14-promisify/01-writing-it.md`,
  286 lines, commit `35f77a1c`; `02-what-it-cannot-bridge.md`, 262 lines, commit `a869197c`).
  ✅ **TOPIC 14 COMPLETE** — README written, boards updated (phase 17 **14/18**, `pages: 14`),
  commit `7848630e`. **3 files, 614 lines, 0 over the 300-line cap**, 4,174 relative links checked
  across `docs/javascript/pages` with **0 broken**. Next: **15 · A rate limiter** (token bucket and
  sliding window — the syllabus row says "on the client and shared with the server design").
  01 = the implementation (five-line version, then the real one) and its seven decisions.
  02 = the three-question shape test (callback last? error-first? fires once?), the two-callback
  browser shape, many-shot callbacks as async iterators, the **hang** when the original already
  returns a promise, cancellation not being in the contract, publishing `promisify.custom`,
  `callbackify` as the mirror, and why `promisifyAll` was never shipped.

🔴 **The overlap that shaped this topic — do not write a second copy.**
**Phase 7 · 13 · `13-creating-promises/02-promisifying.md` (chunk C's phase, already written)
owns *which shapes exist and when to wrap*** — error-first vs two-callback vs event APIs, the
listener leak, cancellation, "do not wrap what is already a promise". It even forward-references
this topic as *(not written yet)*. So **phase 17 · 14 is the IMPLEMENTATION**: write it from an
empty file with every edge case, and link to phase 7 for the decision layer.

🔑 **Facts verified this session — all primary-source, do not re-derive from memory:**

- **Node `util.promisify` docs, verbatim:** *"Takes a function following the common error-first
  callback style, i.e. taking an `(err, value) => ...` callback as the last argument, and returns
  a version that returns promises."* · *"If there is an `original[util.promisify.custom]` property
  present, `promisify` will return its value"* · *"If `original` is not a function, `promisify()`
  will throw an error."* · 🔴 *"If `original` is a function but its last argument is not an
  error-first callback, it will still be passed an error-first callback as its last argument."*
  (this is the sentence that covers the non-error-first failure mode — ⚠️ I could **not** confirm
  any `fs.exists` sentence in the current docs, so do not quote one) · *"If `promisify.custom` is
  defined but is not a function, `promisify()` will throw an error."* · *"In addition to being
  accessible through `util.promisify.custom`, this symbol is registered globally and can be
  accessed in any environment as `Symbol.for('nodejs.util.promisify.custom')`."*
- **Node source `lib/internal/util.js` (primary source, fetched):** the wrapper tests
  **`if (err)` — truthiness, not `!= null`**; resolves **`values[0]`** only; uses
  `ReflectApply(original, this, args)`; then `ObjectSetPrototypeOf(fn, ObjectGetPrototypeOf(
  original))` and `ObjectDefineProperties(fn, ObjectGetOwnPropertyDescriptors(original))`.
  It **stamps the wrapper with `[promisify.custom]` pointing at itself**, so promisify is
  idempotent. Multi-value results use an **internal, non-public** symbol
  `Symbol('customPromisifyArgs')` that names the values into an object. 🔴 It also emits
  **DEP0174** (`'Calling promisify on a function that returns a Promise is likely a mistake.'`)
  when the original returns a promise — a good gotcha for file 02.
- **Node `util.callbackify` docs, verbatim:** *"In the callback, the first argument will be the
  rejection reason (or `null` if the `Promise` resolved), and the second argument will be the
  resolved value."* · *"The callback is executed asynchronously, and will have a limited stack
  trace."* · *"If the callback throws, the process will emit an `'uncaughtException'` event, and
  if not handled will exit."* · 🔴 *"Since `null` has a special meaning as the first argument to a
  callback, if a wrapped function rejects a `Promise` with a falsy value as a reason, the value is
  wrapped in an `Error` with the original value stored in a field named `reason`."*
- **Node `child_process.exec` docs, verbatim** (the model multi-value custom promisification):
  *"If this method is invoked as its `util.promisify()`ed version, it returns a `Promise` for an
  `Object` with `stdout` and `stderr` properties."* · *"The returned `ChildProcess` instance is
  attached to the `Promise` as a `child` property."* · *"In case of an error (including any error
  resulting in an exit code other than 0), a rejected promise is returned, with the same `error`
  object given in the callback, but with two additional properties `stdout` and `stderr`."*
- **MDN `Promise()` constructor, verbatim:** *"The `executor` is called synchronously (as soon as
  the `Promise` is constructed)"* · *"If an error is thrown in the `executor`, the promise is
  rejected, unless `resolveFunc` or `rejectFunc` has already been called."* · *"Only the first
  call to `resolveFunc` or `rejectFunc` affects the promise's eventual state, and subsequent calls
  to either function can neither change the fulfillment value/rejection reason nor toggle its
  eventual state."* 🔴 Together these give the page's best line: an error thrown **after** the
  callback already settled the promise is **swallowed entirely** — rejection is a no-op and the
  executor is no longer on the caller's stack.
- **MDN `Geolocation.getCurrentPosition()`, verbatim:** `getCurrentPosition(success, error,
  options)` — success takes *"a `GeolocationPosition` object as its sole input parameter"*, error
  takes *"a `GeolocationPositionError` object as its sole input parameter"*. The browser's standard
  **two-callback** shape, and the example to use for "not error-first" without needing `fs.exists`.

- 🚧 **Phase 17 · 15 · A rate limiter — file 01 committed** (`15-rate-limiter/01-the-token-bucket.md`,
  271 lines, commit `ec4fa129`). Token bucket with **lazy refill** and the FIFO waiting queue.
  🔑 Load-bearing points: **no `setInterval`** (timer never stops · throttled in background tabs ·
  quantises · one timer per user); **`performance.now()` not `Date.now()`** — MDN: *"a monotonic
  clock: its current time never decreases and isn't subject to adjustments"* (coarsened to
  **5 µs** cross-origin-isolated / **100 µs** not); inject `now` or the limiter is untestable
  without sleeping; **capacity = burst, rate = throughput**, and **capacity 1 IS the leaky
  bucket**; keep tokens **fractional** (rounding down each refill silently slows the rate);
  🔴 the fast path must be refused while anything is queued or it is a lottery, not FIFO;
  **one timer for the whole queue**; `maxQueue` or a rate problem becomes a memory problem;
  a cost greater than capacity hangs forever. Next file: `02-windows-and-the-server.md`
  (fixed window and its 2× boundary burst · sliding-window log vs counter · 429 + `Retry-After`
  + the IETF `RateLimit`/`RateLimit-Policy` draft · client limiter is courtesy, server's is control).
- 🚧 **topic 15 file 02 committed** (`02-windows-and-the-server.md`, 261 lines, commit `e6049174`).
  🔑 The five shapes and their two axes (memory per key · behaviour at a boundary): fixed window is
  2 numbers but 🔴 **allows 2× the limit across a boundary**; sliding **log** is exact and is best
  written as a **ring buffer of exactly `limit` slots** (the only question ever asked is whether the
  `limit`-th most recent request is older than the window); sliding **counter** =
  `prev × (1 − elapsed) + current`, fixed memory, approximate because it assumes the previous
  window was evenly spread; leaky bucket = token bucket with capacity 1. 🔴 **A browser limiter is
  a courtesy, not a control** (links phase 12 · 13 trust boundary) and it is **per tab** — scope of
  the limiter = scope of the process. MDN verbatim for 429 and `Retry-After` (**two syntaxes** —
  delay-seconds and HTTP-date, and the date form is the one place `Date.now()` is right); honour
  `Retry-After` **then jitter** or every client returns at the same millisecond. The IETF
  `RateLimit`/`RateLimit-Policy` fields are an **Internet-Draft, not a standard** —
  *"Clients MUST NOT assume that a positive remaining value is a guarantee that further requests
  will be served"* and they *"do not mandate any correlation between the RateLimit header field
  values and the returned status code"*; `X-RateLimit-*` is a different, inconsistent family.
- ✅ **TOPIC 15 COMPLETE** — README written, boards updated (phase 17 **15/18**, `pages: 15`),
  commit `20c69af9`. 3 files, 598 lines, 0 over the cap, 4,242 relative links checked / 0 broken.
  🏁 **The UNDERSTAND tier of phase 17 is now CLOSED — topics 05–15, eleven topics.**
  🔴 **Chunk B's remaining work is three KNOW topics: 16 · `new`/`Object.create`/`instanceof` by
  hand · 17 · A tiny pub/sub and a reactive signal · 18 · A virtual-DOM diff in outline.**
  Then chunk B is finished (phase 6 ✅ 13/13 + phase 17 ✅ 18/18).
- 🚧 **Phase 17 · 16 · `new`/`Object.create`/`instanceof` by hand — file 01 committed**
  (`16-new-create-instanceof/01-new-and-object-create.md`, 226 lines, commit `faa0b3b2`).
  🔑 MDN's **four numbered steps** for `new` quoted verbatim; `Object(x) === x` is the right step-4
  test (**`typeof result === "object"` is wrong twice** — lets `null` through, rejects a function);
  step 2's fallback is real — a non-object `Ctor.prototype` silently gives `Object.prototype`;
  🔴 the hand-written version **cannot construct a class** (MDN: classes throw a TypeError without
  `new`), **cannot set `new.target`** (MDN: it is undefined exactly when called without `new`) and
  **cannot detect a non-constructible function** — `Reflect.construct` is the real primitive, and
  its third argument sets `new.target`; 🔴 the ES5 `Object.create` shim **cannot make a
  null-prototype object** (F.prototype = null falls back to Object.prototype) — the one-sentence
  answer to why it had to become a primitive; the second argument is **descriptors**, and MDN's
  *"By default properties are not writable, enumerable or configurable"* is why `{a:{value:1}}`
  produces an invisible frozen property. Next file: `02-instanceof.md`.
- 🚧 **topic 16 file 02 committed** (`02-instanceof.md`, 198 lines, commit `877f4c20`).
  🔑 🔴 **The twist worth keeping:** the prototype walk **IS** `Function.prototype[Symbol.hasInstance]`,
  not a fallback — MDN: *"Because all functions inherit from `Function.prototype` by default, they
  would all have the `[Symbol.hasInstance]()` method"*, and that property is *"non-configurable and
  non-writable … a security feature to prevent the underlying target function of a bound function
  from being obtainable"*. Also: a **non-object RHS throws** (`TypeError`, not `false`); a
  **primitive LHS is always `false`** and is NOT boxed; a non-object `Ctor.prototype` **throws**
  here while `new` accepts it silently (same mistake, two symptoms); MDN on bound functions —
  *"instanceof looks up for the `prototype` property on the target function"*; the realm quote
  *"`[] instanceof window.frames[0].Array` will return `false`"* with `Array.isArray` as MDN's own
  remedy; and the **two-copies-of-a-package** failure, with the alternatives table (Array.isArray ·
  `Object.prototype.toString.call` · a `code` field · a `Symbol.for()` brand · duck typing).
- ✅ **TOPIC 16 COMPLETE** — README written, boards updated (phase 17 **16/18**, `pages: 16`),
  commit `07608502`. 3 files, 478 lines, 0 over the cap, 4,301 links checked / 0 broken.
  🔴 **Two topics left in the whole of chunk B: 17 · A tiny pub/sub and a reactive `signal`
  (dependency tracking, "the 40 lines behind modern reactivity") and 18 · A virtual-DOM diff in
  outline (keyed children, reconciliation rules, why React keys matter).** Both **Know** tier.
  When they land, phase 17 is 18/18 and **chunk B is finished** (phase 6 ✅ + phase 17 ✅).
- 🚧 **Phase 17 · 17 · A tiny pub/sub and a reactive `signal` — file 01 committed**
  (`17-pubsub-and-signals/01-from-pubsub-to-tracking.md`, 251 lines, commit `57634dd0`).
  Framing that made the topic work: **pub/sub and signals differ in exactly one place — who names
  the dependency**; the 12-line bus is shown then handed to topic 05 for emitter depth, and the
  page pivots to tracking. 🔑 The five load-bearing lines of the ~40-line signal:
  **`Object.is` bail-out** (and why `===` is wrong for `NaN`); **dependencies re-collected every
  run** (a conditional read changes the graph — stale deps keep effects alive and re-running);
  **`current` is a stack, restored to `previous`** because effects nest; 🔴 **`finally` or one
  throw corrupts the tracker for every later read anywhere**; iterate a copy of the subscriber set.
  🔴 **Tracking is synchronous only** — a read after `await`/in a callback registers nothing, the
  most common way hand-rolled reactivity silently stops updating. TC39 **proposal-signals is
  Stage 1**, verbatim: *"A computed Signal automatically discovers any other Signals that it is
  dependent on"*, *"Computation is 'glitch-free', meaning no unnecessary calculations are ever
  performed"*, *"Computations are not eagerly evaluated when they are declared, nor are they
  immediately evaluated when their dependencies change"*, *"The API is not targeted to most
  application developers. Instead, the signal API here is a better fit for frameworks to build on
  top of."* — file 02 is the gap between the 40 lines and those guarantees (computed, laziness,
  batching, the diamond glitch, disposal/ownership, untrack, Proxy-based reactivity).
- 🚧 **topic 17 file 02 committed** (`02-making-it-real.md`, 271 lines). The three fixes that turn
  the 40 lines into something a framework could use: **`computed` = subscriber AND source**, lazy,
  with a `dirty` flag — **push marks, pull computes**, and the `if (dirty) return` guard is what
  makes a marking pass touch each node once (that IS the glitch-free mechanism); **the diamond**
  worked through (eager propagation runs the effect twice, and the first time with new-b/old-c —
  that inconsistent intermediate state is what "glitch" means); **batching** into a `Set` flushed
  in a microtask, ⚠️ which changes the timing contract and is why every framework has a `tick()`;
  🔴 **the ownership tree** — nested effects created on every parent run and never disposed is the
  leak no demo shows; **`untrack` in four lines** and the cost (an invisible dependency).
  Also the `Proxy` alternative with the honest list — traps for `has`/`deleteProperty`/`ownKeys`,
  arrays reading+writing `length`, **identity splitting** (`proxy !== target` breaks Set/Map/WeakMap
  lookups), nested wrapper caching — summarised as **signals are simpler to implement, proxies are
  nicer to use**. And when reactivity is the wrong tool (server state · event streams · anything
  crossing a realm).
- ✅ **TOPIC 17 COMPLETE** — README written, boards updated (phase 17 **17/18**, `pages: 17`).
  3 files, 580 lines, 0 over the cap. ⚠️ The link check showed **2 broken links in
  `phase-12-browser-platform/16-clipboard-share-files/`** — that is **chunk D mid-write**, left
  alone deliberately. 🔴 **ONE topic left in the whole of chunk B: 18 · A virtual-DOM diff in
  outline** (keyed children, the reconciliation rules, why React keys matter).
- 🚧 **Phase 17 · 18 · A virtual-DOM diff in outline — file 01 committed**
  (`18-virtual-dom-diff/01-the-diff.md`, 196 lines, commit `ca4d24ee`). Verified against the React
  **Reconciliation** doc, verbatim: *"the state of the art algorithms have a complexity in the
  order of O(n3)"*, React *"implements a heuristic O(n) algorithm based on two assumptions"* —
  *"Two elements of different types will produce different trees"* and *"The developer can hint at
  which child elements may be stable across different renders with a `key` prop"*; different root
  types ⇒ *"React will tear down the old tree and build the new tree from scratch"*; same type ⇒ it
  *"looks at the attributes of both, keeps the same underlying DOM node, and only updates the
  changed attributes"*. 🔑 Page-specific points: the prop diff must walk the **union of both key
  sets** or removed props leave stale attributes (the #1 hand-patcher bug); props are three
  different things (attribute · property · listener) with the `value`/caret trap; **index
  addressing shifts** under insert/remove so keep `vnode.dom`, and apply removals before
  insertions; and the honest line — **a virtual DOM is not faster than the DOM**, it is
  predictably good. Next file: `02-keys-and-the-cost.md`.
- 🚧 **topic 18 file 02 committed** (`02-keys-and-the-cost.md`, 254 lines). The unkeyed
  head-insert failure worked through (every slot mismatches ⇒ the diff rewrites five rows for one
  insertion and reuses DOM nodes for different data); the keyed diff as **one `Map` + one pass**,
  with the leftovers in the map BEING the removals; two refinements named not written (Vue's
  **two-ended walk**, an **LIS** pass so only the minimum number of nodes move); 📌 a move is
  `insertBefore` which **detaches and reinserts** (iframes reload, transitions restart) —
  `Element.moveBefore()` is the platform's fix. react.dev verbatim: *"Keys must be unique among
  siblings"*, *"Keys must not change … Don't generate them while rendering"*, the index-as-key
  pitfall (*"Index as a key often leads to subtle and confusing bugs"*) and the `Math.random()`
  passage (*"leading to all your components and DOM being recreated every time … it will also lose
  any user input"*). 🔑 **Keys are identity, which cuts both ways** — changing a key is the clean
  way to RESET state; keys are sibling-scoped and never reach the DOM. Closes with the cost
  (two trees, diff proportional to what you render not what changed) and the four-way alternatives
  table (vDOM · fine-grained reactivity · compiled templates · HTML morphing).

## 🏁 CHUNK B IS FINISHED — 2026-08-15, session `233dede7`

**Phase 17 closed at 18/18, every tier** (Master 4/4 · Understand 11/11 · Know 3/3), and phase 6
was already 13/13 — so **chunk B has no work left**. Boards updated everywhere: `progress.js`
(phase 17 `pages: 18`, `pagesPlanned` removed), the phase README (status + every topic row), the
JavaScript pages index (phase table, the chunk table, the chunk-claims table) and `docs/README.md`
(the chunk-B row **and** the JavaScript technology row — now **266 of 316 in scope, 495 leaf
pages**, phases **0–10, 16, 17** complete at every tier, with 11, 12 and 18 still open in the
other chunks).

**Written this session — five topics, 15 files, ~2,750 lines, 0 over the 300-line cap:**
14 · `promisify` (614) · 15 · A rate limiter (598) · 16 · `new`/`Object.create`/`instanceof` (478) ·
17 · pub/sub and a reactive `signal` (580) · 18 · A virtual-DOM diff (458 — 01 `01-the-diff.md` 196,
02 `02-keys-and-the-cost.md` 209, README 53).

⚠️ **Broken links seen in the link sweep belong to OTHER chunks, mid-write, and were left alone:**
`phase-12-browser-platform/16-clipboard-share-files/` (chunk D) and
`phase-11-network-storage/14-same-origin-and-postmessage/` (chunk A). **Nothing under
`phase-17-machine-coding/` or `phase-6-.../` is broken.**

🔴 **If the user says "javascript B" again, there is nothing queued.** Say chunk B is complete and
let them choose: chunk A (phase 11, 9 topics), chunk C (phase 8's tail), chunk D (phases 12 and 18),
a review pass over phases 6 and 17, or one of the parked phases 13–15 (which needs a new
instruction).
