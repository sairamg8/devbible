---
title: "A UID is just a number"
sidebar_label: "01 · A UID is just a number"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — bind mounts](https://docs.docker.com/engine/storage/bind-mounts/),
> [Dockerfile reference — USER](https://docs.docker.com/reference/dockerfile/#user) and
> [docker container run — user](https://docs.docker.com/reference/cli/docker/container/run/).
> **No sandbox** — no console output on this page.

**The kernel stores a number in the inode. Names are a userspace convenience,
and the container and the host each look the number up in a different file.**
Everything confusing about container file ownership comes from that one
sentence.

## The model

When a process writes a file, the kernel records the process's UID and GID as
integers in the inode. It does not record "node" or "postgres" or "sairam" —
those strings exist only in `/etc/passwd` and `/etc/group`, and those files are
**different inside the container and on the host**.

So:

- The image says UID `1000` is `node`. `ls -l` inside the container prints
  `node`.
- Your host says UID `1000` is you. `ls -l` on the host prints your name.
- Nothing consulted the other's file. They agree by coincidence, and the
  coincidence is that most Linux distributions give the first human user
  UID 1000.

**A container does not "run as a user". It runs as a number**, and the number is
compared against the numbers in the filesystem's inodes. That is why the fix for
half the problems in this topic is to make the numbers match, and why the other
half is to stop the numbers from meaning different things.

## Rootful Docker: root writes root

By default a container runs as UID 0, and with the default (rootful) Docker
daemon **UID 0 in the container is UID 0 on the host** — the same root. There is
no namespace in between.

```bash
docker run -v "$(pwd)":/data alpine sh -c 'echo hi > /data/out.txt'
```

`out.txt` is now owned by `root:root` in your project directory. Two
consequences, in escalating order of annoyance:

1. **You cannot delete it without `sudo`.** Every CI job that generates output
   into a mounted directory eventually produces a `Permission denied` on
   cleanup.
2. **The container could have written anywhere you mounted.** Root in the
   container is root on the host — the isolation is the mount namespace, not
   the privilege. `-v /:/host` and root is the classic escape.

⚠️ **Docker Desktop on macOS and Windows hides this**, because the file-sharing
layer between the VM and the host presents everything as owned by you. The
problem is real on Linux hosts and inside Linux VMs with real bind mounts, and
it surprises Mac users the first time they run their compose file on a server.

## A non-root image: the UID 1000 coincidence

The standard hardening step is a non-root user in the image
([Phase 3, page 09](../../phase-3-dockerfile/09-user.md)):

```dockerfile
USER node      # UID 1000 in the official Node images
```

On a Linux laptop where you are also UID 1000, everything now works beautifully.
Files the container writes into a bind mount are owned by you; files you own are
writable by the container. It feels like the problem is solved.

**It is not solved, it is aliased.** Three ways the coincidence breaks:

| Situation | What happens |
|---|---|
| Your host UID is not 1000 (a second user on the machine, or a corporate image starting at 1001) | files come out owned by a UID that is somebody else, or nobody |
| The image's user is not 1000 — `nginx` is 101, `postgres` is 999, many hardened images use 65532 | the container cannot write to a directory you own |
| The engine is rootless | the number is shifted again on the way out — chunk 02 |

And the reverse direction fails just as often: a container running as UID 1000
cannot write into a bind-mounted directory owned by `root` or by UID 501, and
the error arrives as an application-level "cannot open file for writing" rather
than anything that mentions users.

## Why volumes mostly avoid this

Named volumes are the quiet exception, and it is worth knowing why rather than
just noticing that they work.

When an **empty** volume is mounted over a container directory, the image's
content is copied in **with its ownership and permissions** (topic 02). A
Postgres volume is therefore created already owned by the image's `postgres`
user, and the database starts. Nothing on the host had to agree with anything.

That is the single best argument for the rule of thumb in this phase: **bind
mounts for what you edit, volumes for what the container owns.** Ownership
problems live almost entirely on the bind-mount side.

## Reading the evidence

Names lie across the boundary, so ask for numbers:

```bash
ls -ln                      # -n prints numeric UID/GID instead of names
stat -c '%u %g %n' file     # the same, one field at a time
```

```bash
docker exec -it api id      # uid=1000(node) gid=1000(node) groups=...
docker exec -it api ls -ln /app
```

**Compare the numbers, never the names.** `node` inside and your login name
outside can both be 1000, or both be printed for entirely different numbers, and
the names tell you nothing about whether a write will succeed.

## Gotchas

**Symptom:** `rm -rf build/` fails with `Permission denied` on your own machine.
**Cause:** A rootful container wrote into the bind mount as UID 0, so the files
are root-owned on the host.
**Fix:** `sudo rm -rf` this time; then run the container as your UID, or stop
mounting the output directory. Chunk 03 has the options.

**Symptom:** The container logs `EACCES: permission denied, open '/app/data/x'`,
and the directory is clearly there.
**Cause:** The image's user (say UID 101) has no write permission on a
bind-mounted host directory owned by UID 1000.
**Fix:** Make the numbers agree — `--user`, a build-arg UID, or a `chown` in the
entrypoint before dropping privileges.

**Symptom:** It works on the developer's Mac and fails on the Linux CI runner.
**Cause:** Docker Desktop's file sharing presents host files as owned by you
regardless of UID; a real Linux bind mount does not.
**Fix:** Treat Linux as the truth. Test the compose file on a Linux host, or in
CI, before believing it.

**Symptom:** `ls -l` shows the same username inside and outside, and the write
still fails.
**Cause:** The names match by lookup in two different `/etc/passwd` files; the
numbers do not.
**Fix:** `ls -ln` and `id`. Always compare numbers.

## Interview questions

**★ Why does a file created by a container show up with a strange owner on the
host?**
Because ownership is stored as a number in the inode, and the name is resolved
separately by whoever is looking — the container against the image's
`/etc/passwd`, the host against the host's. A container running as UID 1000
writes UID 1000, and the host prints whatever UID 1000 means there, which may be
you, someone else, or nothing at all.

**★ Why is "run as UID 1000" not actually a fix?**
Because it relies on the coincidence that most Linux distributions give the
first human user UID 1000. It breaks when your host UID is different, when the
image's user is not 1000 (`nginx` is 101, `postgres` 999, many hardened images
65532), and under a rootless engine, where the number is shifted again by the
user namespace.

**★ Why do named volumes rarely have this problem when bind mounts always do?**
Because an empty volume is pre-populated from the image *with the image's
ownership and permissions*, so it starts out owned by exactly the user that will
write to it, and no host identity is involved. A bind mount brings the host's
existing ownership with it, and the host and container disagree about what the
numbers mean.

**What is the security angle on rootful bind mounts?**
Container UID 0 with the default Docker daemon *is* host root — the isolation is
the mount namespace, not the privilege. Anything you bind-mount is writable by
that root, which is why `-v /:/host` is a container escape and why mounting the
Docker socket hands over the engine.

**How do you diagnose this in two commands?**
`ls -ln` on the host for the numeric owner of the files, and `id` inside the
container for the numeric UID it runs as. If those two numbers differ, you have
your answer; comparing usernames tells you nothing, because the two systems look
them up in different files.

---

Index: [File ownership and UID mismatch](README.md) · Next → [Rootless, and the UID shift](02-rootless-and-the-shift.md)
