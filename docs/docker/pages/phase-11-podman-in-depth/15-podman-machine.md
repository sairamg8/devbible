---
title: "podman machine"
sidebar_label: "15 · podman machine"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [podman-machine(1)](https://docs.podman.io/en/latest/markdown/podman-machine.1.html),
> [podman-machine-init(1)](https://docs.podman.io/en/latest/markdown/podman-machine-init.1.html),
> [podman-unshare(1)](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html)
> and [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html).
> **No sandbox** — no console output on this page.

Containers are a Linux kernel feature ([Phase 0 · 02](../phase-0-what-a-container-is/02-namespaces.md)),
so a machine without a Linux kernel needs one supplied. That is all
`podman machine` is: "a set of subcommands that manage Podman's virtual
machine", because "Podman on MacOS and Windows requires a virtual machine". It
"can be optionally used on Linux", where you almost never want it.

🔴 **The single idea worth carrying:** on those platforms **your CLI is a remote
client**, and everything confusing about Podman on a Mac is that boundary showing
through.

## The lifecycle

```bash
podman machine init --now       # create and start it
podman machine list
podman machine ssh              # a shell inside the VM
podman machine stop
```

The subcommands are `init`, `start`, `stop`, `ssh`, `list`, `inspect`, `set`,
`rm`, `reset`, `os` and `info`. `init` "initialize[s] a new virtual machine for
Podman", `--now` "start[s] the virtual machine immediately after it has been
initialized", and the default machine is named **`podman-machine-default`** — the
name you will see in error messages you did not ask for.

⚠️ **"All `podman machine` commands are rootless only."** The VM is yours, not
the system's, which is consistent with the rest of Podman's design and
occasionally surprising if you expected a system-wide service.

## The boundary, and its four consequences

**1 · The filesystem is not your filesystem.** "Default volume mounts are defined
in `containers.conf`. Unless changed, the default value is `$HOME:$HOME`" — so
your home directory is visible inside the VM at the same path, and **everything
outside it is not there at all**. A bind mount of `/opt/data` or `/srv` fails or
mounts an empty directory, because that path does not exist in the VM.

**2 · Some commands genuinely do not work.** Anything documented as "not
available with the remote Podman client" fails on macOS and Windows —
`podman unshare` is the one you will hit
([Phase 11 · 06](06-podman-unshare.md)), along with `--latest` on several
commands. The fix is always the same shape: `podman machine ssh` and run it in
the VM, where the storage actually lives.

**3 · Rootless-vs-rootful is a property of the VM.** `--rootful` sets "whether
this machine prefers rootful (`true`) or rootless (`false`) container execution",
so the choice argued in [Phase 11 · 02](02-rootless-by-default/README.md) is made
once for the machine rather than per container.

**4 · File I/O crosses a virtualisation boundary.** Bind-mount performance on
macOS and Windows is its own topic
([Phase 6 · 12](../phase-6-storage/12-bind-mount-performance.md)) and the cause is
here: every read of a mounted source file goes through the host-to-VM sharing
layer. It is why `node_modules` in a bind mount behaves so differently on a Mac
than on Linux.

## Sizing and resetting

`podman machine set` changes a machine's settings, and `podman machine rm`
removes one. `reset` is the blunt instrument — it "reset[s] Podman machines and
environment", which means starting over rather than repairing.

⚠️ **Removing a machine removes what is inside it.** Images, containers and
volumes live in the VM's storage, not on your host filesystem. `machine rm` is
therefore a much larger action than `container rm`, and there is no separate
confirmation for the contents.

## Diagnosing "is it the container or the VM?"

Three subcommands exist purely to answer that, and reaching for them early saves
a lot of guessing:

- **`podman machine info`** "display[s] machine host info" — the view from
  outside, including what machines exist and what provider is in use.
- **`podman machine inspect`** gives one machine's configuration: its resources,
  its mounts, its state. When a bind mount is not appearing, this is where you
  confirm what is actually shared.
- **`podman machine os`** "manage[s] a Podman virtual machine's OS", which is how
  the VM's own operating system is maintained rather than replaced.

The triage order that works: reproduce it, then `podman machine ssh` and try the
same thing from inside. If it works in the VM and not from your host, it is a
boundary problem — a mount, a path, or a command the remote client cannot run. If
it fails in both, it is an ordinary container problem and everything in
[Phase 10 · 06](../phase-10-production/06-failure-catalogue/README.md) applies
unchanged.

## Docker API tools on a machine

`DOCKER_HOST` and the compatibility socket ([Phase 11 · 13](13-docker-cli-compatibility.md))
still work here, with one extra hop: the socket the tools should reach is the
machine's, not a local one, because there is no engine on the host at all. When a
Docker-API tool cannot connect on macOS and the same setup works on Linux, that
missing hop is the first thing to check.

## What Podman 6 removed here

Two of that release's removals are about this page's platforms: "support for
running on Intel Macs has been removed" and "support for running on Windows 10
has been removed" ([Phase 11 · 14](14-podman-6-breaking-changes.md)). Neither is
a container-level change — they are host requirements, and the machine simply
will not come up. Check the host before planning the upgrade.

## The same architecture as Docker on those platforms

Docker Desktop also runs a Linux VM, which is why the two share their
characteristic macOS and Windows behaviours — the file-sharing performance cost,
the "why can't I mount this path" question, and a resource footprint that is a
whole virtual machine rather than a few processes.

The difference worth knowing is **who owns it**: `podman machine` is a set of
ordinary CLI subcommands over a VM you can `ssh` into and inspect, which makes
"is this a container problem or a VM problem?" an answerable question. That is
the honest advantage on these platforms, and the reason to reach for
`machine ssh` early when something does not add up.

## Gotchas

**Symptom:** A bind mount works on Linux and mounts nothing on a Mac.
**Cause:** Only `$HOME:$HOME` is shared with the VM by default. A path outside
your home directory does not exist inside it.
**Fix:** Move the source under `$HOME`, or configure additional volume mounts in
`containers.conf`. The container is not wrong; the path is not there.

**Symptom:** `podman unshare` fails on macOS or Windows.
**Cause:** It "is not available with the remote Podman client", and on those
platforms the CLI is a remote client.
**Fix:** `podman machine ssh`, then run it inside the VM.

**Symptom:** `podman machine rm` and the images are all gone.
**Cause:** Image and container storage lives in the VM. Removing the machine
removes the storage with it.
**Fix:** None after the fact. Push images you care about to a registry first —
this is one more argument for treating local images as disposable.

**Symptom:** File watching or a dev-server rebuild is dramatically slower than on
Linux.
**Cause:** Every file access crosses the host-to-VM sharing layer.
**Fix:** The strategies in [Phase 6 · 12](../phase-6-storage/12-bind-mount-performance.md) —
keep dependencies inside a volume rather than the bind mount, and mount as little
as possible.

## Interview questions

**★ Why does `podman machine` exist?**
Because containers are Linux kernel features, and macOS and Windows have no
Linux kernel. "Podman on MacOS and Windows requires a virtual machine", and this
is the set of subcommands that manages it. On Linux it can be used optionally,
and usually should not be — there is nothing to virtualise.

**★ What changes about how you use Podman when a machine is involved?**
Your CLI becomes a remote client to the VM. Only `$HOME` is shared by default, so
paths outside it cannot be bind-mounted; commands marked unavailable with the
remote client fail; images and containers live in the VM's storage rather than on
your host; and file I/O through a mount crosses a virtualisation boundary, which
is where the macOS performance reputation comes from.

**How do you run something that only works inside the VM?**
`podman machine ssh`, which gives you a shell where storage and the namespaces
are local. That is the standard fix for `podman unshare` and anything else the
remote client refuses.

**Is `podman machine` rootless?**
The commands themselves are documented as rootless only. Separately, `--rootful`
on `init` chooses whether the machine "prefers rootful (`true`) or rootless
(`false`) container execution" inside the VM — so it is one decision for the
machine rather than a per-container flag.

**How does this compare with Docker Desktop?**
Architecturally the same — a Linux VM. The practical difference is transparency:
`podman machine` is CLI subcommands over a VM you can log into and inspect, so
you can tell a container problem from a VM problem. Both carry the same
file-sharing performance cost.

**What should you be careful about before `podman machine rm`?**
That the images, containers and volumes inside it go too. Anything you need
should already be in a registry or a backup — local image storage is not
somewhere to keep the only copy of something.

---

← Prev: [Podman 6 breaking changes](14-podman-6-breaking-changes.md) · Index: [Phase 11](README.md) · Next → [16 · Podman Desktop](16-podman-desktop.md)
