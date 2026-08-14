---
title: "seccomp, AppArmor and SELinux"
sidebar_label: "10 · seccomp, AppArmor, SELinux"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — seccomp security profiles](https://docs.docker.com/engine/security/seccomp/),
> [Docker — AppArmor security profiles](https://docs.docker.com/engine/security/apparmor/),
> [Docker security](https://docs.docker.com/engine/security/) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Capabilities decide which privileged operations a process may request.
seccomp decides which system calls it may make at all. AppArmor and SELinux
decide which files, devices and sockets it may touch.** Three layers, three
different questions — and between them they produce most of the "permission
denied on a file I can plainly see" confusion in containers.

## The three, side by side

| Layer | Question it answers | Failure looks like |
|---|---|---|
| **Capabilities** | May this process perform this *privileged operation*? | `EPERM` — "operation not permitted" |
| **seccomp** | May this process make this *system call*? | `EPERM`, or the process killed outright |
| **AppArmor / SELinux** | May this process touch this *object* — path, device, socket? | `EACCES`/`EPERM`, plus a denial in the host's audit log |

The layer to reach for is decided by the object of the sentence: an *operation*,
a *syscall*, or a *file*.

## seccomp — filtering system calls

Docker applies a default seccomp profile to every container. It is an allowlist:
the default action is to return an error, and permitted syscalls are listed
explicitly. Per Docker's documentation it **disables around 44 system calls out
of 300+**.

The blocked set is chosen to remove whole categories of escape and host damage:

- **Kernel modules** — `create_module`, `delete_module`, `init_module`
- **Namespace manipulation** — `unshare`, `setns`, and restricted `clone`
- **Clock changes** — `clock_settime`, `settimeofday`
- **Host-level actions** — `reboot`, `kexec_load`
- **Debugging others** — `ptrace`
- **`io_uring`** — blocked because it has been a container-escape vector

Two useful properties:

- **The default profile adapts to the capabilities you grant.** Docker's docs say
  it adjusts to the selected capabilities so that facilities allowed by those
  capabilities work — so you generally do not have to touch seccomp when you add
  a capability.
- **It is not a sandbox in the gVisor sense.** It narrows the kernel's attack
  surface substantially; it does not remove it.

```bash
# Replace the profile
docker run --security-opt seccomp=/path/to/profile.json myimage

# Turn it off entirely - diagnosis only, never production
docker run --security-opt seccomp=unconfined myimage
```

⚠️ `seccomp=unconfined` is a **diagnostic step**, not a fix. If a container works
unconfined and fails with the default profile, you have learned *which layer* to
investigate — the next step is finding the syscall, not shipping unconfined.
Docker's documentation recommends against changing the default profile at all.

## AppArmor — path-based confinement

Used by Debian, Ubuntu and SUSE. Docker loads a default profile
(`docker-default`) that restricts what container processes may do to the
filesystem and to certain kernel interfaces.

```bash
docker run --security-opt apparmor=my-profile myimage
docker run --security-opt apparmor=unconfined myimage   # diagnosis only
```

Denials are logged by the host, not by the container — which is why a container
can report a plain "permission denied" while the real explanation is sitting in
`dmesg` or the audit log on the host.

## SELinux — the one that will actually bite you

Used by Fedora, RHEL, CentOS and Rocky — including the machine this bible is
written on. SELinux labels every process and every file, and enforces a policy
about which labels may touch which.

For containers this produces one very specific, very common symptom:

> **A bind-mounted host directory is readable by everyone, the container runs as
> root, and it still gets "permission denied".**

The cause is that the host directory's SELinux label does not permit access by
the container's label. The fix is a **mount option**, and it is two characters:

| Suffix | Meaning | Use when |
|---|---|---|
| `:z` (lowercase) | Relabel **shared** — several containers may use it | Multiple containers mount the same directory |
| `:Z` (uppercase) | Relabel **private** — exclusive to this container | One container owns the data |

```bash
# SELinux hosts: relabel a bind mount on the way in
podman run -v /srv/appdata:/data:Z myimage
docker run -v /srv/appdata:/data:z  myimage
```

⚠️ **`:Z` relabels the host directory recursively.** Pointing it at something
broad — a home directory, `/var`, `/etc` — can relabel a very large tree and
disturb other services. Use it on directories that exist for the container.

Turning SELinux off is not the fix, however often the internet says so. On a
Fedora or RHEL host it is one of the few things standing between a container
escape and the rest of the machine.

## Which layer is it? A quick triage

1. **Does it fail only for a specific privileged action** (bind port 80, change
   ownership, mount)? → capabilities.
2. **Does it fail on a syscall a normal program rarely makes** (`ptrace`,
   `unshare`, `io_uring`), or die abruptly? → seccomp.
3. **Does it fail on a file or device that the permissions clearly allow, and is
   the host Fedora/RHEL?** → SELinux labels. Check the host audit log.
4. **Same as 3 but the host is Ubuntu/Debian?** → AppArmor. Check `dmesg`.

That order is roughly the frequency order in practice, with one exception:
**on Fedora and RHEL, bind-mount denials are SELinux until proven otherwise.**

## Gotchas

**Symptom:** A bind mount works on your Ubuntu laptop and fails with "permission
denied" on the Fedora server.
**Cause:** SELinux is enforcing there and not here.
**Fix:** Add `:Z` (or `:z` if shared) to the mount. Do not disable SELinux, and
do not `chmod 777` the directory — neither addresses the label.

**Symptom:** A container works with `--privileged` and fails without it, and no
capability you add helps.
**Cause:** `--privileged` also stands down AppArmor/SELinux, so the blocker may
be the security module rather than a capability.
**Fix:** Re-test with capabilities alone, then with `apparmor=unconfined` or the
appropriate SELinux label, to identify which layer is responsible — then apply
the narrow fix for that layer.

**Symptom:** An old application fails with a strange syscall error under a
recent engine.
**Cause:** The default seccomp profile blocks it — `io_uring` is the modern
example, blocked for escape reasons.
**Fix:** Confirm by running once with `seccomp=unconfined`. If it is the cause,
write a profile that permits that one syscall rather than removing the profile.

**Symptom:** Nothing appears in the container's logs to explain the denial.
**Cause:** MAC denials are logged on the **host**, by the security module.
**Fix:** `dmesg`, `journalctl -k`, or `ausearch -m avc -ts recent` on the host.
A container will never tell you it was blocked by SELinux.

## Interview questions

**★ What is the difference between capabilities and seccomp?**
Capabilities gate privileged *operations*; seccomp filters *system calls*. A
process can hold a capability and still be blocked by seccomp from making the
syscall that would use it. They are complementary layers, not alternatives.

**★ What do `:z` and `:Z` do on a bind mount?**
They tell the engine to relabel the host directory for SELinux — lowercase `z`
for a shared label usable by multiple containers, uppercase `Z` for a private
label exclusive to one. They are the standard fix for bind-mount permission
denials on Fedora and RHEL.

**★ A container gets "permission denied" on a world-readable file. Where do you
look?**
On an SELinux host, the labels — the file permissions are not the constraint.
Check the host's audit log for an AVC denial, and mount with `:Z`. On an
AppArmor host, check `dmesg` for a denial from `docker-default`.

**Roughly what does the default seccomp profile block?**
About 44 of 300+ syscalls, chosen to remove kernel-module loading, namespace
manipulation, clock changes, reboot/kexec, ptrace and `io_uring`. It adapts to
the capabilities you grant, so adding a capability usually does not require
touching it.

**Is `seccomp=unconfined` an acceptable fix?**
No — it is an acceptable *diagnosis*. It tells you the syscall filter is the
blocking layer. The fix is a profile that permits the one syscall you need.

**Why is disabling SELinux the wrong response to a mount error?**
It removes a host-wide protection to solve a per-mount labelling problem that has
a two-character fix. On Fedora and RHEL, SELinux is a significant part of what
limits a container escape.

---

← Prev: [Capabilities](09-capabilities.md) · Index: [Phase 0](README.md) · Next → [Rootless containers](11-rootless.md)
