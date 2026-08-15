---
title: "Hot reload inside a container"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [Docker — Compose file watch](https://docs.docker.com/compose/how-tos/file-watch/),
> [the Compose `develop` element](https://docs.docker.com/reference/compose-file/develop/),
> [the Vite server options](https://vite.dev/config/server-options) and
> [the top-level `volumes` element](https://docs.docker.com/reference/compose-file/volumes/).
> **No sandbox** — no console output on this page.

**"I saved the file and nothing happened" has exactly two causes, and telling them
apart is the whole skill.** Either the new bytes never reached the container, or
they arrived and the watcher never noticed. Every fix on this page belongs to one
of those two halves, and applying a fix from the wrong half is why this problem
has a reputation.

## The two failure classes

| | Question | Test it by |
|---|---|---|
| **Delivery** | Did the change get *into* the container? | `docker compose exec api cat /app/src/thefile.js` |
| **Detection** | Did the process *notice*? | The same file changed twice — does the log say anything at all? |

🔴 **Run the delivery test first, every time.** It is one command and it splits the
problem in half. Debugging a watcher when the file never arrived — or remounting
volumes when the file is right there and the watcher is asleep — is how an
afternoon disappears.

## The chunks

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Getting the file in](01-getting-the-file-in.md)** | Bind mount versus `develop.watch` versus rebuild, the `node_modules` shadowing trap and its fixes, and the anonymous volume that goes stale |
| 02 | **[Making the change noticed](02-making-it-noticed.md)** | Filesystem events across a mount, polling and what it costs, and the browser half — Vite's `host`, HMR and the ports it needs |

## Where this connects

- **[Phase 6 · Bind mounts in development](../../phase-6-storage/04-bind-mounts-in-development/README.md)**
  is the mount-side treatment; this topic is the application's side of it.
- **[Phase 8 · `develop.watch`](../../phase-8-compose/13-develop-watch.md)** is
  the reference for the five actions and their fields.
- **[Topic 02 · Dev image vs prod image](../02-dev-vs-prod-image.md)** is where
  the watcher's dependencies live — and why they must not ship.
- **Topic 12 · A React/Vite frontend** *(not written yet)* takes the browser half
  further.

---

← Prev: [Waiting for the database](../04-waiting-for-the-database/README.md) · Index: [Phase 9](../README.md) · Start → [Getting the file in](01-getting-the-file-in.md)
