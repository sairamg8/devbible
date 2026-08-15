---
title: "10 · Hardening at run time"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [Docker Engine security](https://docs.docker.com/engine/security/),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [PR_SET_NO_NEW_PRIVS(2const)](https://man7.org/linux/man-pages/man2/PR_SET_NO_NEW_PRIVS.2const.html)
> and the [Compose file reference — services](https://docs.docker.com/reference/compose-file/services/).
> **No sandbox** — no console output on this page.

The syllabus row is *`--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges`,
non-root user.*

🔴 **Run-time hardening is four independent switches, and the image cannot set any
of them — so the question is not only which flags, but where they live so that
nobody can quietly drop one.** The topic splits on exactly that boundary: the
switches themselves, then making them the default everywhere.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The four switches](01-the-four-switches.md)** | Why they compose and none substitutes for another; the baseline `docker run` stanza; `--cap-drop=ALL` and the `NET_BIND_SERVICE` exception you can usually avoid; `no-new-privileges` and the `no_new_privs` kernel attribute it sets; `--user` with a numeric uid, and the two things it cannot fix; what `--read-only` buys in security rather than storage terms |
| 02 | **[Enforcing it everywhere](02-enforcing-it.md)** | seccomp, AppArmor and SELinux as layers already on, and the `--security-opt` values that switch them off; the same posture as Compose attributes, with the colon-versus-equals trap; why `--privileged` cancels the whole page; Podman's different starting position and its `mask`/`unmask`; and the order to roll all four onto a live service |

## Four facts worth carrying out of this topic

- **`--cap-drop=ALL` does not make the process non-root.** uid 0 with no
  capabilities still owns every file in the image.
- **`no_new_privs` cannot be unset once set** and is inherited across `fork` and
  `execve` — which is what makes it safe to apply by default.
- **`--read-only` removes persistence, not access.** It is the switch that turns a
  compromise into something a restart takes away.
- **Podman's `--read-only-tmpfs` defaults to `true`.** Declare `tmpfs` mounts
  explicitly or the same container passes on one engine and fails on the other.

## Phase gate

You can harden a running service one switch at a time, name what each one closes
and what it does not, and say why `--privileged` is not a stronger version of
`--cap-add`.

## Where this connects

- [Phase 5 · Least privilege](../../phase-5-image-quality/03-least-privilege.md) —
  the image half of this argument: building something that *can* run this way
- [Phase 0 · Capabilities](../../phase-0-what-a-container-is/09-capabilities.md) ·
  [seccomp, AppArmor and SELinux](../../phase-0-what-a-container-is/10-seccomp-apparmor-selinux.md) ·
  [Rootless](../../phase-0-what-a-container-is/11-rootless.md) — the mechanisms
- [Phase 3 · USER](../../phase-3-dockerfile/09-user.md) — the default this page
  enforces
- [Phase 6 · A read-only root filesystem](../../phase-6-storage/08-read-only-rootfs.md) ·
  [SELinux `:z` and `:Z`](../../phase-6-storage/07-selinux-z-and-Z.md) ·
  [`--userns=keep-id`](../../phase-6-storage/09-userns-keep-id.md) — the storage
  consequences
- [09 · Healthchecks in production](../09-healthchecks-in-production.md) — a probe
  that needs `curl` or `ping` is a hardening decision too
- [Phase 11 · 04 · Quadlet](../../phase-11-podman-in-depth/04-quadlet/README.md)
  and **Phase 12 · One image, three environments** *(not written yet)* — where the
  posture stops being a command line and becomes a template

---

Start → [01 · The four switches](01-the-four-switches.md)
