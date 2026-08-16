---
title: "Enforcing it everywhere"
sidebar_label: "02 · Enforcing it everywhere"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [Docker Engine security](https://docs.docker.com/engine/security/),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html) and
> the [Compose file reference — services](https://docs.docker.com/reference/compose-file/services/).
> **No sandbox** — no console output on this page.

**A hardened `docker run` protects one container on one afternoon.** The four
switches only mean anything when they live somewhere every deployment inherits
them — a Compose file, a Quadlet unit, a pipeline template — and when nobody can
quietly undo them with one flag. This chunk is the enforcement half: the layers
that are already on, the file the flags belong in, the flag that cancels all of
them, and the order to introduce them without a bad afternoon.

## seccomp, AppArmor and SELinux are already on

The three mandatory-access layers are enabled by default and covered in
[phase 0 · seccomp, AppArmor and
SELinux](../../phase-0-what-a-container-is/10-seccomp-apparmor-selinux.md). At run
time the only things worth knowing are the shapes of the `--security-opt` values
that touch them, and that **every one of them weakens the container**:

| Value | Effect |
|---|---|
| `seccomp=unconfined` | "Turn off seccomp confinement for the container" |
| `seccomp=profile.json` | Replace the default filter with your own |
| `apparmor=PROFILE` | "Set the apparmor profile to be applied to the container" |
| `label=disable` | "Turn off label confinement for the container" |

`seccomp=unconfined` is the one that appears in issue threads as a fix. It is a
**diagnosis** step — it establishes that the failing operation was a blocked
syscall — and shipping it means the container runs with no syscall filter at all.
`label=disable` has the same character on an SELinux host: it makes the volume
error go away by removing the confinement that produced it, where `:z`/`:Z`
([phase 6 · SELinux](../../phase-6-storage/07-selinux-z-and-Z.md)) fixes the label
instead.

Podman adds two options in the other direction, which are the only run-time
hardening controls with no Docker equivalent: **`mask=/path/1:/path/2`**, making
paths inaccessible inside the container, and **`unmask=`**, which reverses the
default masking. Masking is how you hide a host path that a bind mount had to
bring in.

## The same posture in Compose

Every flag has an attribute, so the hardened stanza is expressible in the file that
actually gets reviewed and committed:

```yaml
services:
  api:
    image: myapp:1.4.2
    user: "10001:10001"
    read_only: true
    cap_drop: [ALL]
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:mode=1777,uid=10001,gid=10001
    volumes:
      - appdata:/data
```

- **`user`** — "overrides the user used to run the container process. The default is
  set by the image (i.e. Dockerfile `USER`). If it's not set, then `root`."
- **`read_only`** — "configures the service container to be created with a read-only
  filesystem."
- **`cap_drop`** / **`cap_add`** — "specifies container capabilities to drop" /
  "additional container capabilities as strings."
- **`tmpfs`** — takes `<path>` or `<path>:<options>`, with `mode`, `uid` and `gid`
  documented as the available options.
- **`security_opt`** — the reference documents it as overriding "the default
  labeling scheme for each container", with `label:user:USER`-style entries, and
  refers to Docker's security-configuration section for everything else; the
  entries are passed through to the engine, which is how `no-new-privileges` gets
  there. ⚠️ Note the **colon** separator in the Compose form against the `=` in the
  CLI flag.

⚠️ **`userns_mode` "sets the user namespace for the service. Supported values are
platform specific and may depend on platform configuration"** — a value that works
under one engine may be rejected by the other. It is not the portable part of this
list.

🔴 **The point of putting it in the file is that a template is inheritable and a
command line is not.** An override file, a Quadlet unit or a base Compose file
everyone extends is what makes the posture the default for services nobody
reviewed. Phase 11's Quadlet topic is the systemd expression of the same set, and
**Phase 12 · One image, three environments** *(not written yet)* is why the
hardening must not vary between them.

## `--privileged` cancels the entire page

Docker's warning is unusually direct: **"A container with `--privileged` is not a
securely sandboxed process. Containers in this mode can get a root shell on the
host and take control over the system."** It grants all capabilities, disables the
default seccomp and AppArmor profiles, disables SELinux labels, gives access to
host devices, and makes `/sys` and the cgroup filesystem read-write. Podman's
manual lists the same demolition: **"Dropped Capabilities, limited devices,
read-only mount points, Apparmor/SELinux separation, and Seccomp filters are all
disabled."**

There is no partial `--privileged`, and it is not a stronger `--cap-add`. When
something genuinely needs elevated access the answer is the narrow flag — a
specific `--cap-add`, a specific `--device` — and a note in the file saying which
operation needed it. A `privileged: true` in a Compose file with no comment is the
single highest-value thing to find in a review.

## Podman

The flags are the same and the starting position is different, because
[rootless](../../phase-0-what-a-container-is/11-rootless.md) is the default mode:

- **The blast radius is already smaller.** A rootless container cannot gain more
  privileges than the user who launched it — even with `--privileged`, which is why
  `--privileged` under rootless Podman is *not* equivalent to `--privileged` under
  a root Docker daemon. That is a bound on the damage, not a reason to use it.
- **`--read-only-tmpfs` defaults to `true`**, mounting a read-write `tmpfs` on
  `/dev`, `/dev/shm`, `/run`, `/tmp` and `/var/tmp` for a `--read-only` container.
  Docker has no such flag and supplies nothing. **Declare your `tmpfs` mounts
  explicitly and both engines behave the same**; rely on the default and the
  container passes under Podman and fails under Docker.
- **`--cap-drop` drops "from the default podman capability set"**, which is not
  identical to Docker's — one more reason `ALL` plus an explicit re-add is the
  portable instruction rather than dropping a named list.
- **`--tmpfs` defaults to `rw,noexec,nosuid,nodev`** and enables `tmpcopyup`, which
  copies the underlying image directory's contents in before mounting. Docker does
  neither by default.
- `--userns=keep-id` and friends are the mapping controls;
  [phase 6 · `--userns=keep-id`](../../phase-6-storage/09-userns-keep-id.md) covers
  the ownership case, and [Phase 11 · 07 · `--userns` modes](../../phase-11-podman-in-depth/07-userns-modes.md)
  is the depth.

## Rolling it out on a service that is already running

Adding all four at once to a live service produces a container that fails to start
and no information about which switch did it. The order that keeps the diagnosis
cheap:

1. **`no-new-privileges` first.** It is the least likely to break anything and the
   most likely to be missing.
2. **`--cap-drop=ALL`.** If it fails, the error names the operation — a bind below
   1024, a `chown`, a raw socket for `ping`.
3. **`--user`.** Failures here are `EACCES` on paths the image left owned by root,
   and the fix is in the Dockerfile (`COPY --chown`), not in the run command.
4. **`--read-only` last**, because it is the one that needs a write inventory
   first.

🔴 **Fix the image, never remove the flag.** The usual failure of a hardening
programme is that the first `EACCES` gets resolved by deleting the switch from the
template — and the template is what everything else inherits, so one service's
permission error silently un-hardens the fleet.

## Gotchas

**Symptom:** The hardened container works under Podman and fails under Docker with
identical flags.
**Cause:** Podman's `--read-only-tmpfs` defaults to `true` and supplies `/tmp`,
`/run`, `/dev`, `/dev/shm` and `/var/tmp`; Docker supplies nothing.
**Fix:** Declare every writable path as an explicit `--tmpfs` or volume, so the run
command is complete on both engines.

**Symptom:** A blocked syscall was "fixed" with `seccomp=unconfined` and the change
shipped.
**Cause:** Turning the filter off is a diagnosis step being used as a remedy.
**Fix:** Identify the syscall, then either write a narrow custom profile or change
the application. `unconfined` leaves the container with no syscall filtering at all.

**Symptom:** A container needs one device, and the fix that worked was
`privileged: true`.
**Cause:** `--privileged` grants everything, so it always works — and it disables
seccomp, AppArmor, SELinux labelling and every dropped capability at the same time.
**Fix:** `--device` for the device, or the single `--cap-add` the operation needs.
If neither is enough, the requirement deserves an explicit written justification.

**Symptom:** The hardening is in the Compose file and the container is still
unconfined.
**Cause:** A later override file, or a `docker run` in a deploy script, that does
not carry the same attributes. Files apply left to right and the last one wins.
**Fix:** Put the posture in the base file, keep overrides additive, and check the
running container rather than the file you meant to deploy.

## Interview questions

**★ Why is `--privileged` not "a bit more access"?**
It grants all capabilities, disables the default seccomp and AppArmor profiles,
disables SELinux labelling, exposes host devices and makes `/sys` and the cgroup
filesystem writable. Docker's own documentation says such a container "is not a
securely sandboxed process" and can take control of the host. The correct response
to a container that needs one privileged operation is the narrow flag — a specific
`--cap-add` or `--device`.

**★ Someone fixed a crash with `--security-opt seccomp=unconfined`. What do you say?**
That it is a diagnosis, not a fix — it establishes that a blocked syscall was the
cause, and shipping it means the container runs with no syscall filter at all. The
next step is to identify the syscall and either supply a narrow custom profile or
change the application so it does not need it. The same argument applies to
`label=disable` on an SELinux host, where `:z`/`:Z` fixes the label instead.

**★ What differs about this posture between Docker and rootless Podman?**
The flags are the same, but a rootless container cannot gain more privileges than
the user who launched it, so the worst case is bounded by that user rather than by
root. Two mechanical differences bite: Podman's `--read-only-tmpfs` defaults to
`true`, so a read-only container gets writable temp paths Docker does not supply,
and `--cap-drop` drops from Podman's default set, which is not identical to
Docker's — so drop `ALL` and re-add explicitly if you want one command to mean the
same thing on both.

**How do you express the hardened stanza in Compose, and what is the syntax trap?**
`user`, `read_only`, `cap_drop`, `security_opt` and `tmpfs` map one-to-one onto the
flags. The trap is the separator: the CLI takes `--security-opt=no-new-privileges=true`
with an `=`, while the Compose entries are colon-separated, matching the documented
`label:user:USER` form.

**What are Podman's `mask` and `unmask` for?**
`mask=/path/1:/path/2` makes those paths inaccessible inside the container, and
`unmask=` reverses Podman's default masking. They are the only run-time hardening
controls in this topic with no Docker equivalent, and masking is the tool for
hiding a host path that a bind mount had to bring in.

**In what order do you introduce these on a live service, and why?**
`no-new-privileges`, then `--cap-drop=ALL`, then `--user`, then `--read-only`.
It is ascending order of how likely each is to break something and how much
investigation the breakage needs — the first is almost always inert, the last needs
an inventory of everything the container writes. Introducing them together produces
a container that will not start and no evidence about which switch did it.

---

← [01 · The four switches](01-the-four-switches.md) · [Topic index](README.md)
