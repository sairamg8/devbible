---
title: "15 · Cross-tab coordination"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel), [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event), [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [`SharedWorker`](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker) — and the [HTML Standard](https://html.spec.whatwg.org/multipage/web-messaging.html#broadcasting-to-other-browsing-contexts) plus the [Web Locks specification](https://w3c.github.io/web-locks/). Documentation-validated; **no timings and no console output**.

The syllabus row is *`BroadcastChannel`, the `storage` event, and Web Locks* — three APIs for one
situation: **your app is open in more than one tab, and they do not know about each other.**

🔴 **There are two problems here, and mixing them up is the bug.** *Telling* the other tabs
something happened is a broadcast. *Deciding which tab acts* is mutual exclusion. Broadcasting
"I am refreshing the token" does not stop the other tabs — they broadcast the same thing in the
same millisecond.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The channels](./01-the-channels.md)** | What a tab actually is; `BroadcastChannel` — the name, structured clone, **the sender-object exclusion**, `InvalidStateError` on a closed channel, `messageerror`, and the four things it deliberately cannot do; the `storage` event and its four silent traps (never fires in the writer, an unchanged value broadcasts nothing, `clear()` sends all-null, `sessionStorage` is not cross-tab); `SharedWorker` and the service worker; the choosing table |
| 02 | **[Web Locks](./02-web-locks.md)** | `navigator.locks.request` and its options; why the lock's lifetime is the callback's lifetime; origin-wide, **terminated with the agent**, and FIFO-fair; the exception table (`NotSupportedError`, `AbortError`, `InvalidStateError`, `SecurityError`); `steal` as a last resort; `query()` as diagnostics only; deadlock; what locks do not do, and the fallback when they are unavailable |
| 03 | **[The patterns](./03-the-patterns.md)** | Do-it-once with the **re-check inside the lock**; leader election as a lock you never release; `ifAvailable` for "already open in another tab"; a lock with a deadline; readers/writer; the **late joiner** and why `visibilitychange` + revalidate is the baseline; "log out everywhere" end to end; making any of it testable |

## Four facts worth carrying out of this topic

- **The message tells, the lock decides, storage remembers.** Nearly every cross-tab feature needs
  all three, doing three different jobs.
- **`BroadcastChannel` excludes the sending *object*, not the sending tab.** Two channels of the
  same name in one document hear each other.
- **A `localStorage` flag is not a lock**, because it survives the tab that set it. A Web Lock is
  terminated with the agent holding it — that is the whole reason the API exists.
- **None of this is a correctness guarantee.** One device, one browser profile, and a handover
  window. Exactly-once lives on the server.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [07 · Web Workers](../07-web-workers/README.md) — the same structured-clone boundary, and the
  `SharedWorker` alternative to electing a leader
- [03 · Timers and frames](../03-timers-and-frames/README.md) — why a background tab makes a poor
  leader
- [13 · What belongs on the server instead](../13-what-belongs-on-the-server/README.md) —
  idempotency, and where coordination stops being enough
- [Phase 11 · 10 · Web storage](../../phase-11-network-storage/10-web-storage/README.md) — the
  `storage` event from the storage side
- [Phase 11 · 08 · Aborting and timing out](../../phase-11-network-storage/08-aborting-and-timing-out/README.md)
  — the `AbortSignal` a lock request accepts

---

Start → [01 · The channels](./01-the-channels.md)
