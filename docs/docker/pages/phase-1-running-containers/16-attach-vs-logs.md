---
title: "attach versus logs -f, and the detach sequence"
sidebar_label: "16 · attach versus logs -f"
sidebar_position: 16
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against [docker container attach](https://docs.docker.com/reference/cli/docker/container/attach/),
> [docker container logs](https://docs.docker.com/reference/cli/docker/container/logs/) and
> [podman-attach(1)](https://docs.podman.io/en/latest/markdown/podman-attach.1.html).
> **No sandbox** — no console output on this page.

**`attach` connects your terminal to the container's PID 1 — including its
stdin. `logs -f` only reads the output.** One of them can kill the container by
accident; the other cannot.

## The difference

| | `docker attach` | `docker logs -f` |
|---|---|---|
| Sees output | Yes, from the moment you attach | Yes, **including history** |
| Sends input | **Yes** — your keystrokes go to PID 1 | No |
| `Ctrl-C` | Sends `SIGINT` to the container's process | Just stops following |
| Multiple viewers | Share the same stream | Independent |
| Risk | **Can stop the container** | None |

**Default to `logs -f`.** It shows history, it is safe to leave and to exit, and
it is what you want in ninety-nine cases out of a hundred.

```bash
docker logs -f api                 # safe, includes history
docker logs -f --tail 100 api      # from the last 100 lines
docker attach api                  # only when you need stdin
```

## The `Ctrl-C` trap

Attached to a container, `Ctrl-C` forwards `SIGINT` to PID 1. For most
applications that terminates the process, and therefore the container.

The classic sequence: attach to a production container to watch a log, press
`Ctrl-C` out of habit, and stop the service.

## The detach sequence

Detach from an attached session without signalling the process:

> **`Ctrl-P` then `Ctrl-Q`**

Two important conditions:

- It works only when the container was started **with a TTY** (`-t`). Without a
  TTY there is nothing to detach from in this sense, and `Ctrl-C` is your only
  exit — which is exactly the dangerous case.
- `--detach-keys` changes the sequence, on `run` or `attach`, if `Ctrl-P`
  conflicts with your shell's history binding.

```bash
docker attach --detach-keys="ctrl-e,e" api
```

The safest habit remains: do not attach unless you need stdin.

## When you genuinely need `attach`

- The container runs an **interactive REPL** as PID 1 and you want to type into
  it.
- A process is waiting for input on stdin.
- You started something with `-it` and want to reconnect after detaching.

Even then, `docker exec -it <container> <shell>` is often better: it gives you a
**separate** process, so nothing you do can signal PID 1. Reach for `attach` only
when it must be PID 1's own stdin.

## Podman

`podman attach` behaves identically, including `Ctrl-P Ctrl-Q` and
`--detach-keys`. `podman logs -f` matches too, subject to the log driver: on
distributions defaulting to `journald`, history follows the journal's retention
rather than a Docker log file.

## Gotchas

**Symptom:** `Ctrl-C` while watching a container stopped it.
**Cause:** You were attached, not following logs. `Ctrl-C` forwarded `SIGINT` to
PID 1.
**Fix:** Use `docker logs -f`, which cannot signal anything. If you must attach,
detach with `Ctrl-P Ctrl-Q`.

**Symptom:** `Ctrl-P Ctrl-Q` does nothing and you are stuck.
**Cause:** The container was started without a TTY, so the detach sequence is
unavailable.
**Fix:** Close the terminal window — the container keeps running because the
signal came from the terminal, not from you. Then use `logs -f` instead.

**Symptom:** `docker attach` shows no output at all.
**Cause:** `attach` shows output from the moment you attach. A quiet service
prints nothing until it does.
**Fix:** `docker logs --tail 100 -f` to see history plus new output.

**Symptom:** Two people attached to the same container are typing over each
other.
**Cause:** They share one stdin — `attach` is not a per-user session.
**Fix:** `docker exec -it` gives each person their own process. That is what it
is for.

## Interview questions

**★ What is the difference between `docker attach` and `docker logs -f`?**
`attach` connects your terminal to PID 1 including stdin, so `Ctrl-C` signals the
process and can stop the container. `logs -f` only streams output, shows history,
and is safe to enter and leave.

**★ How do you detach from an attached container without stopping it?**
`Ctrl-P` then `Ctrl-Q`, and only if the container has a TTY. `--detach-keys`
rebinds the sequence. Without a TTY there is no safe detach, which is why
attaching to such a container is risky.

**When should you use `attach` rather than `exec`?**
Only when you need PID 1's own stdin — an interactive REPL running as the main
process. Otherwise `exec -it` is better: it creates a separate process, so
nothing you type can signal the main one.

---

← Prev: [docker cp](15-docker-cp.md) · Index: [Phase 1](README.md) · Start Phase 2 → **Images, layers and registries** *(not written yet)*
