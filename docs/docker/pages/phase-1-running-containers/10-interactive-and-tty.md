---
title: "Interactive and TTY: -i, -t and -it"
sidebar_label: "10 · Interactive and TTY"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [docker container exec](https://docs.docker.com/reference/cli/docker/container/exec/),
> [tty(4)](https://man7.org/linux/man-pages/man4/tty.4.html) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**`-i` keeps stdin open. `-t` allocates a pseudo-terminal. They are independent,
and `-it` together is what makes a shell usable.** Typing `-it` by reflex is
fine until it hangs a CI job, at which point you need to know which half did it.

## The two flags

| Flag | Long form | What it does |
|---|---|---|
| `-i` | `--interactive` | Keep **stdin** open, so the container can read input |
| `-t` | `--tty` | Allocate a **pseudo-TTY**, so the process believes it is at a terminal |

### `-i` alone: pipe input in

```bash
echo "SELECT 1;" | docker exec -i db psql -U postgres
docker run -i --rm alpine cat < ./input.txt
```

The container reads stdin, and there is no terminal involved. This is the form
you want in **scripts and CI**, because it does not need a TTY to exist.

### `-t` alone: pretend there is a terminal

Rarely useful on its own. A TTY with no stdin gives you coloured, formatted
output from tools that check `isatty()`, but nothing can be typed.

### `-it`: an actual interactive session

```bash
docker run --rm -it alpine sh
docker exec -it api bash
```

With both, the shell reads what you type and line editing, job control, `Ctrl-C`
and terminal size all work.

## What a TTY actually changes

More than "it looks nicer" — programs behave differently when `isatty()` is true:

| With a TTY | Without |
|---|---|
| Coloured output | Plain text |
| Progress bars, spinners | Plain or none |
| Line-buffered output | **Block-buffered** output |
| Interactive prompts appear | Prompts may be skipped |
| `Ctrl-C` sends `SIGINT` to the foreground group | Signals go to the process directly |
| `SIGWINCH` on resize | No resize handling |

**Block buffering is the sneaky one.** Without a TTY, many runtimes buffer stdout
in 4–8 KB blocks, so a program that prints one line per second appears to output
nothing for a minute and then everything at once. That is not the container
losing your logs; it is your language's buffering. The fixes are
language-specific — `PYTHONUNBUFFERED=1`, unbuffered writers, or explicit
flushing — and this is a good thing to set in any image whose logs you rely on.

## Where `-it` goes wrong

```bash
# ❌ In a CI job with no terminal
docker run -it --rm myimage npm test
# the input device is not a TTY
```

CI runners, cron jobs and `systemd` units have no terminal, so `-t` cannot
allocate one and the command fails — or worse, hangs waiting for input that never
comes.

**The rule:** `-it` is for a human at a keyboard. In automation, use `-i` if the
command needs stdin, and neither flag if it does not.

```bash
docker run --rm myimage npm test          # ✅ CI
docker exec -i db psql -U postgres < q.sql # ✅ CI with stdin
docker run --rm -it myimage sh             # ✅ a person, debugging
```

## Podman

Identical: `-i`, `-t` and `-it` mean the same thing, and `podman run -it` behaves
as expected. Rootless makes no difference here.

## Gotchas

**Symptom:** `the input device is not a TTY` in CI.
**Cause:** `-t` in an environment with no terminal.
**Fix:** Drop `-t`. Keep `-i` only if the command genuinely reads stdin. Many
scripts carry `-it` copied from a tutorial and never needed either flag.

**Symptom:** Logs appear in large bursts instead of line by line.
**Cause:** No TTY means block-buffered stdout in the application's runtime.
**Fix:** Force unbuffered output in the image — the environment variable or
flag differs per language. Do not add `-t` to a service to fix logging; it
changes signal and buffering behaviour in ways you do not want in production.

**Symptom:** `docker exec -it` works from your terminal and fails from a script.
**Cause:** Same TTY problem, from the other direction.
**Fix:** `docker exec -i` in the script.

**Symptom:** `Ctrl-C` in an `-it` session kills the container you meant to keep.
**Cause:** With a TTY, `Ctrl-C` sends `SIGINT` to the foreground process group —
which is the container's main process if you attached to a running container.
**Fix:** Use the detach sequence rather than `Ctrl-C` when attached, or `exec` a
separate shell instead of attaching. Page 16.

## Interview questions

**★ What is the difference between `-i` and `-t`?**
`-i` keeps stdin open so the container can read input. `-t` allocates a
pseudo-terminal so the process believes it is attached to one. They are
independent — `-i` alone is right for piping input in scripts, and `-it`
together is what makes an interactive shell work.

**★ Why does `docker run -it` fail in CI?**
There is no terminal to allocate. `-t` requires one, so the command errors with
"the input device is not a TTY" or hangs. Use `-i` alone if stdin is needed, and
neither otherwise.

**★ Why do container logs sometimes arrive in bursts?**
Without a TTY, stdout is block-buffered by most runtimes, so output accumulates
until the buffer fills. Fix it in the application — unbuffered output — rather
than by adding `-t`, which changes signal handling too.

**When would you use `-i` without `-t`?**
Piping data into a container from a script: `echo "SELECT 1;" | docker exec -i db
psql`. Input is needed, a terminal is not, and it works in an environment with no
TTY.

---

← Prev: [Exit codes](09-exit-codes.md) · Index: [Phase 1](README.md) · Next → [Overriding ENTRYPOINT and CMD](11-overriding-entrypoint.md)
