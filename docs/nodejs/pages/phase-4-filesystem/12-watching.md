---
title: "Watching files"
sidebar_label: "12 · Watching files"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`fs.watch` is fast and inconsistent; `fs.watchFile` is consistent and
expensive. Neither is reliable enough to build on directly, which is why
everyone ends up using `chokidar`.**

## fs.watch — OS events

```js
// watch.mjs
import { watch } from 'node:fs';
import { writeFile, rm } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const events = [];
const watcher = watch('w', { recursive: true }, (type, filename) => events.push(`${type}:${filename}`));

await sleep(50); await writeFile('w/a.txt', '2');
await sleep(50); await writeFile('w/b.txt', 'new');
await sleep(50); await rm('w/b.txt');
await sleep(100); watcher.close();

console.log('events for 3 operations:', events);
```

```console
$ node watch.mjs
events for 3 operations: [
  'change:a.txt',
  'change:a.txt',
  'rename:b.txt',
  'change:b.txt',
  'rename:b.txt'
]
```

**Three operations produced five events**, and one write produced two:

```console
$ node one-write.mjs
one writeFile produced 2 events: [ 'change', 'change' ]
```

That is not a bug. A `writeFile` is an open, a truncate, a write and a close, and
the OS reports several of them. Editors are worse — many save by writing a temp
file and renaming, which arrives as `rename` events for a file you were not
watching.

Note also that **`eventType` is only ever `'rename'` or `'change'`**. Creation
and deletion both surface as `'rename'`; you cannot tell them apart without
checking whether the path now exists.

`fs.watch` uses `inotify` on Linux, `FSEvents` on macOS and
`ReadDirectoryChangesW` on Windows. The consequences of that:

| Behaviour | Linux | macOS | Windows |
|---|---|---|---|
| `recursive: true` | **Supported since Node 20** | yes | yes |
| `filename` in the callback | usually | usually | usually — but may be `null` anywhere |
| Fires for subdirectory changes without `recursive` | no | no | no |
| Works over NFS / SMB / Docker volumes | **often not at all** | often not | often not |

The network-filesystem row is the one that bites: inotify is a local-kernel
mechanism, so a bind-mounted volume from macOS or Windows into a Linux container
frequently delivers **no events at all**. This is the entire reason
`--watch-poll`-style options exist in dev servers.

## fs.watchFile — polling

```js
// watchfile.mjs
import { watchFile, unwatchFile } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

let calls = 0;
watchFile('w/a.txt', { interval: 100 }, (curr, prev) => calls++);
await sleep(120);
await appendFile('w/a.txt', 'x');
await sleep(300);
unwatchFile('w/a.txt');
console.log('watchFile callbacks:', calls, '(polling, not events)');
```

```console
$ node watchfile.mjs
watchFile callbacks: 1 (polling, not events)
```

`watchFile` **stats the file on an interval** (default 5007 ms) and calls you
when the stat changed. That makes it:

- **reliable everywhere**, including network filesystems and Docker mounts;
- **slow** — you see changes up to `interval` late;
- **expensive at scale** — one stat per file per interval. A thousand watched
  files at the default interval is 200 stats a second, forever, on the thread
  pool.

Its callback receives `(current, previous)` `Stats`. **A deleted file is reported
as a stat with `mtimeMs === 0`**, not as an error — checking `curr.mtimeMs === 0`
is how you detect deletion.

`unwatchFile` is mandatory: watchers keep the process alive and are not garbage
collected.

## Why chokidar

`chokidar` wraps both and fixes the parts you would otherwise fix yourself:

- **Debounces** the multiple events per save, and offers
  `awaitWriteFinish` so you are notified once the file has *stopped* growing —
  which is what you want for uploads and large copies.
- **Distinguishes** `add`, `change`, `unlink`, `addDir`, `unlinkDir` instead of
  `rename`/`change`.
- **Falls back to polling** automatically (`usePolling`) for network and
  container mounts.
- **Handles the initial scan**, `ignored` patterns, symlinks and atomic-save
  patterns from editors.

```js
import chokidar from 'chokidar';

const watcher = chokidar.watch('content', {
  ignored: /(^|[/\\])\../,          // dotfiles
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
});
watcher.on('add', (p) => rebuild(p)).on('change', (p) => rebuild(p)).on('unlink', (p) => remove(p));
await watcher.close();               // always close on shutdown
```

The trade-off is a dependency and, in polling mode, real CPU cost. For a build
tool that is obviously worth it. For a server, ask whether you should be watching
at all.

## Do not watch files in production

Config reloading via file watching is a common design and usually the wrong one:

- containers are immutable — the file does not change without a restart;
- a partially-written file gets loaded ([page 10](10-atomic-writes-and-temp-files.md));
- events do not arrive reliably on the volume types production uses;
- the reload path is exercised rarely, so it is the least-tested code you have.

Prefer a **restart** (a rolling deploy is cheap), a **`SIGHUP` handler** that
re-reads explicitly, or a config service you poll on an interval you control.
Watching is a development convenience: `node --watch`, `nodemon`, a dev server's
hot reload.

## Gotchas

**Symptom:** One save fires the handler two or three times
**Cause:** The OS reports open/truncate/write/close separately.
**Fix:** Debounce, or use chokidar's `awaitWriteFinish`.

**Symptom:** No events at all inside Docker on macOS or Windows
**Cause:** inotify does not cross the virtualised mount.
**Fix:** Polling — `chokidar` with `usePolling: true`, or `watchFile`.

**Symptom:** `filename` is `null` in the callback
**Cause:** Not always provided by the platform.
**Fix:** Re-scan the directory rather than trusting the name.

**Symptom:** Reload loads a half-written file
**Cause:** The event fires at the start of the write.
**Fix:** Debounce plus a stability check; write config atomically at the source.

**Symptom:** The process will not exit
**Cause:** An open watcher keeps the event loop alive.
**Fix:** `watcher.close()` / `unwatchFile()`, or `watcher.unref()`.

**Symptom:** `ENOSPC: System limit for number of file watchers reached`
**Cause:** inotify's per-user watch limit — one watch **per directory**, so a
recursive watch over `node_modules` exhausts it. Check yours with
`cat /proc/sys/fs/inotify/max_user_watches`; it ranges from 8192 on older
distros to 134494 on this machine.
**Fix:** Ignore large trees; raise `fs.inotify.max_user_watches` on dev machines.

**Symptom:** Deleting a watched file produces no error, just a strange stat
**Cause:** `watchFile` reports deletion as `mtimeMs === 0`.
**Fix:** Check for it explicitly.

## Interview questions

**★ What is the difference between `fs.watch` and `fs.watchFile`?**
`fs.watch` subscribes to OS notifications — fast and cheap, but inconsistent
across platforms and often silent on network or virtualised mounts.
`fs.watchFile` polls with `stat` on an interval — reliable everywhere, but
delayed and costly at scale.

**★ Why does one file save fire several events?**
A write is several syscalls (open, truncate, write, close) and the OS reports
them individually; editors add a temp-file-plus-rename dance on top. Verified:
one `writeFile` produced two `change` events. Debounce, or use
`awaitWriteFinish`.

**★ Why does watching fail inside Docker on macOS?**
inotify is a Linux-kernel mechanism and does not see writes made through the
virtualised filesystem layer. The fix is polling.

**★ Why is chokidar so widely used?**
It debounces, distinguishes add/change/unlink instead of `rename`/`change`,
falls back to polling automatically, waits for writes to finish, and handles
ignores and the initial scan — all things you would otherwise reimplement.

**Should a production server watch its config file?**
Usually not. Containers are immutable, events are unreliable on production
volumes, a partial read is possible, and the reload path is under-tested. Prefer
a restart or an explicit `SIGHUP` re-read.

**What is `ENOSPC` from a watcher?**
The inotify watch limit, not disk space — one watch per directory, so a recursive
watch over a big tree exhausts the per-user maximum.

---

← Prev: [node:os](11-os.md) · Next → [Permissions and symlinks](13-permissions-and-symlinks.md)
