---
title: "Overriding ENTRYPOINT and CMD at run time"
sidebar_label: "11 · Overriding the entrypoint"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker container run — entrypoint](https://docs.docker.com/reference/cli/docker/container/run/),
> [Dockerfile ENTRYPOINT](https://docs.docker.com/reference/dockerfile/#entrypoint),
> [Dockerfile CMD](https://docs.docker.com/reference/dockerfile/#cmd) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**`ENTRYPOINT` is the program; `CMD` is its default arguments.** At run time, a
trailing command replaces `CMD`, and `--entrypoint` replaces `ENTRYPOINT`. Once
that sinks in, "how do I get a shell in this image?" stops being a puzzle.

## The model

```dockerfile
ENTRYPOINT ["node"]          # the program
CMD ["server.js"]            # its default arguments
# the container runs:  node server.js
```

| What you type | What runs |
|---|---|
| `docker run img` | `node server.js` |
| `docker run img worker.js` | `node worker.js` — **the trailing args replaced `CMD`** |
| `docker run --entrypoint sh img` | `sh` — **`--entrypoint` replaced `ENTRYPOINT`, and `CMD` was dropped** |
| `docker run --entrypoint sh img -c "ls /app"` | `sh -c "ls /app"` |

Two rules cover every case:

1. **Anything after the image name replaces `CMD`.**
2. **`--entrypoint` replaces `ENTRYPOINT`** — and discards `CMD` unless you supply
   new arguments after the image.

That second half is the one that catches people: `--entrypoint sh` alone gives
you `sh` with no arguments, which is what you want for a shell, and silently
loses the image's default arguments, which is what you do not want if you were
trying to add a wrapper.

## The two images you will meet

### `CMD` only — the common case

```dockerfile
CMD ["npm", "start"]
```

Overriding is easy, because a trailing command just replaces it:

```bash
docker run --rm -it myimage sh          # a shell, no --entrypoint needed
docker run --rm myimage npm run migrate # a different command
```

### `ENTRYPOINT` set — the "why won't it give me a shell" case

```dockerfile
ENTRYPOINT ["/app/server"]
```

Now a trailing `sh` becomes an **argument to `/app/server`**, not a shell:

```bash
docker run --rm -it myimage sh            # ❌ runs: /app/server sh
docker run --rm -it --entrypoint sh myimage   # ✅ runs: sh
```

This is exactly why so many official images use `CMD` rather than `ENTRYPOINT`
for their main process — it keeps them debuggable.

## The entrypoint-script pattern

A very common shape, worth recognising because it changes how overrides behave:

```dockerfile
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
```

The script does setup — waits for a dependency, fixes permissions, renders a
config — and then **`exec "$@"`** to hand PID 1 to the real command. Two
consequences:

- `docker run img some-other-command` still goes **through** the script, because
  the trailing args become `"$@"`. That is the point.
- The `exec` matters enormously: without it, the script stays PID 1 and swallows
  `SIGTERM` (page 08). **`exec "$@"` is the last line of every correct entrypoint
  script.**

To skip the setup entirely — say, to inspect the image without waiting for a
database — override the entrypoint:

```bash
docker run --rm -it --entrypoint sh myimage
```

## Getting a shell in anything

The escalating ladder, in order:

```bash
docker run --rm -it myimage sh                    # CMD-only images
docker run --rm -it --entrypoint sh myimage       # ENTRYPOINT is set
docker run --rm -it --entrypoint bash myimage     # no sh, but bash exists
docker run --rm -it --entrypoint "" myimage sh    # clear the entrypoint entirely
```

If none of these work, the image has no shell at all — distroless or `scratch`.
Then you inspect it from outside: `docker create` it and `docker cp` files out,
or `docker export | tar tv` to list the filesystem without running anything.

## Podman

`--entrypoint` behaves identically, and accepts both a bare string and a JSON
array. The empty-string form to clear an entrypoint works the same way.

## Gotchas

**Symptom:** `docker run -it myimage sh` exits immediately or prints an
application usage message.
**Cause:** The image has an `ENTRYPOINT`, so `sh` was passed to it as an
argument.
**Fix:** `--entrypoint sh`. If the usage message appears, that is the
application telling you it did not understand the argument — a useful confirmation
of what happened.

**Symptom:** An entrypoint script runs, but the container ignores `docker stop`
and always takes the full grace period.
**Cause:** The script called the command normally instead of `exec`-ing it, so
the shell remained PID 1 and did not forward `SIGTERM`.
**Fix:** End the script with `exec "$@"`. This is the single most common bug in
hand-written entrypoint scripts.

**Symptom:** `--entrypoint` with arguments does not work as expected.
**Cause:** `--entrypoint` takes only the executable; its arguments go **after
the image name**.
**Fix:** `docker run --entrypoint sh myimage -c "echo hi"` — not
`--entrypoint "sh -c 'echo hi'"`.

**Symptom:** Overriding the command skipped important startup work.
**Cause:** The work was in the entrypoint script and you replaced the entrypoint
rather than the command.
**Fix:** Replace only `CMD` — put your command after the image name and let the
entrypoint script run. Use `--entrypoint` only when you deliberately want to skip
the setup.

## Interview questions

**★ What is the difference between `ENTRYPOINT` and `CMD`?**
`ENTRYPOINT` is the program that runs; `CMD` supplies its default arguments. At
run time, trailing arguments replace `CMD`, while `--entrypoint` replaces
`ENTRYPOINT` and discards `CMD` unless new arguments are given.

**★ How do you get a shell in an image whose `ENTRYPOINT` is a binary?**
`docker run --rm -it --entrypoint sh <image>`. A trailing `sh` would be passed to
the binary as an argument instead of being executed.

**★ Why must an entrypoint script end with `exec "$@"`?**
So the real command replaces the shell as PID 1. Without `exec`, the shell stays
PID 1, does not forward `SIGTERM`, and every stop waits out the full grace period
before `SIGKILL`.

**How do you run a one-off command in an image that has an entrypoint script?**
Put the command after the image name so it replaces `CMD` and still flows through
the script's `exec "$@"`. Use `--entrypoint` only when you specifically want to
bypass the script's setup.

**How do you clear an entrypoint entirely?**
`--entrypoint ""` with the command after the image name. Useful for images that
wrap everything in a launcher you want out of the way.

---

← Prev: [Interactive and TTY](10-interactive-and-tty.md) · Index: [Phase 1](README.md) · Next → [Restart policies](12-restart-policies.md)
