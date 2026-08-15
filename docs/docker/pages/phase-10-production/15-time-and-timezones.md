---
title: "Time, timezones and locales"
sidebar_label: "15 · Time, timezones and locales"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [time_namespaces(7)](https://man7.org/linux/man-pages/man7/time_namespaces.7.html),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> the [Alpine Linux wiki — setting the timezone](https://wiki.alpinelinux.org/wiki/Setting_the_timezone)
> and [musl — functional differences from glibc](https://wiki.musl-libc.org/functional-differences-from-glibc.html).
> **No sandbox** — no console output on this page.

**A container's wall clock is the host's, always. `TZ` changes only how it is
displayed.** Those two sentences answer nearly every time-related question about
containers, and getting them the wrong way round produces both classic bugs: trying
to fix clock skew inside a container, and assuming the logs are in the timezone you
configured somewhere else.

## The kernel rule

Time namespaces exist, and they deliberately do not cover the clock you care about:

> "time namespaces do not virtualize the `CLOCK_REALTIME` clock. Virtualization of
> this clock was avoided for reasons of complexity and overhead within the kernel."

What they *do* virtualise is `CLOCK_MONOTONIC` — "a nonsettable clock that
represents monotonic time since … 'some unspecified point in the past'" — and
`CLOCK_BOOTTIME`, "identical to `CLOCK_MONOTONIC`, except that it also includes any
time that the system is suspended". Offsets are set by writing
`/proc/[pid]/timens_offsets`, which needs **`CAP_SYS_TIME`** and fails with
`EACCES` "after the first process has been created in or has entered the namespace".

🔴 **Three consequences, and they are the whole topic:**

1. **Clock skew is a host problem.** Run NTP on the host. There is no
   container-level fix, and there never will be one.
2. **Setting the clock from inside would move the host's clock**, and needs
   `CAP_SYS_TIME` — which [topic 10](10-hardening/README.md) drops. That is
   correct, not a limitation to work around.
3. **Uptime-style measurements are namespaced but the date is not**, so a container
   can look freshly booted while reporting the host's wall-clock time.

## Why the container "thinks it is UTC"

Because nothing told it otherwise. Local-time display depends on two things
existing inside the container:

- **A zoneinfo database.** It is a package, not a kernel feature — on Alpine
  `tzdata` must be installed, and `/etc/localtime` is a link into
  `/usr/share/zoneinfo/`. A `scratch` image has none at all, which is one of the
  things [phase 5 · Distroless and
  scratch](../phase-5-image-quality/06-distroless-and-scratch.md) lists as missing.
- **A `TZ` setting or an `/etc/localtime`** pointing at a zone in it.

With neither, the C library falls back to UTC — so "the container thinks it is UTC"
is not a container behaviour at all, it is the default of an unconfigured libc.

⚠️ **`TZ=Europe/Berlin` on an image with no zoneinfo database silently does
nothing**, because the name cannot be resolved. The symptom is a setting that
"doesn't work", with no error.

## The three ways to set it

```bash
docker run -e TZ=Europe/Berlin myapp:1.4.2                          # the portable one
docker run -v /etc/localtime:/etc/localtime:ro myapp:1.4.2          # inherit the host's
podman run --tz=Europe/Berlin myapp:1.4.2                           # Podman only
podman run --tz=local myapp:1.4.2                                   # Podman: match the host
```

- **`TZ`** is an environment variable the C library reads. It travels with the
  Compose file or the unit, which is why it is the one to prefer.
- **Bind-mounting `/etc/localtime` read-only** makes the container inherit the
  host's zone. It couples the image to the host's configuration — the same image
  then formats differently on two machines — and on an SELinux host it needs the
  label handling from [phase 6 · `:z` and
  `:Z`](../phase-6-storage/07-selinux-z-and-Z.md).
- **Podman has a flag for it:** `--tz` "set[s] timezone in container. This flag
  takes area-based timezones, GMT time, as well as `local`, which sets the timezone
  in the container to match the host machine", with valid values from
  `/usr/share/zoneinfo/`. **Docker has no equivalent**, so a Compose file that must
  run on both engines should use `TZ`.

## The recommendation: stay in UTC and format at the edge

🔴 **Run containers in UTC, store UTC, log UTC, and convert to a local zone only
where a human reads it.** The reasons compound in a containerised system:

- **Logs from several containers get correlated**, and the correlation is arithmetic
  if everything is UTC and guesswork if each container has its own zone.
- **A structured timestamp field is unambiguous**
  ([topic 04](04-logs-to-stdout/02-logs-a-machine-can-read.md)); a pretty local
  timestamp is not, and neither is a DST boundary that repeats an hour.
- **The same image runs on machines in different regions.** A zone baked into the
  image makes it a different artefact per region, which is the opposite of
  build-once-promote-everywhere.

The exception is a container whose *output* is for people — a report generator, a
scheduled mailer — where the zone is business logic and belongs in the
configuration, not in the base image.

## Locales

Locale data is the same shape of problem as zoneinfo: it is a package, and minimal
images do not have it. What differs is the fallback.

- **`LANG` and `LC_ALL`** select it; with neither set, behaviour is the C library's
  default.
- **musl's default is not glibc's.** musl "always uses `C.UTF-8` as the default"
  when no `LANG` or `LC_*` variables are set, and beyond the C locale "all other
  locales are still processed as multibyte UTF-8". So an Alpine-based image
  ([phase 5 · Alpine and musl](../phase-5-image-quality/05-alpine-and-musl.md))
  will not reproduce a glibc image's locale-specific behaviour by setting `LANG`,
  because the locale data that would drive it is not there to install.
- **What you notice** is sorting order, case conversion of non-ASCII text, and
  number and date formatting — all of which change between the C locale and a
  full one, quietly and only for some inputs.

**The same conclusion as timezones:** do not depend on the container's locale for
anything that must be stable. Sort and format explicitly in code, or at the
database, where the collation is declared rather than inherited from whichever base
image the Dockerfile happened to pick.

## Gotchas

**Symptom:** The container's clock is minutes off and setting it inside does
nothing.
**Cause:** `CLOCK_REALTIME` is not virtualised — the container is reading the
host's clock.
**Fix:** Fix time on the host (NTP). There is no container-level remedy, and
changing it from inside would need `CAP_SYS_TIME` and would move the host's clock.

**Symptom:** `TZ` is set and timestamps are still UTC.
**Cause:** The image has no zoneinfo database, so the zone name cannot be resolved
and the library falls back to UTC.
**Fix:** Install the timezone data (`tzdata` on Alpine) or use a base image that
ships it. On `scratch`, copy the zoneinfo files in from a build stage.

**Symptom:** Logs from two containers cannot be lined up during an incident.
**Cause:** Different `TZ` settings, or a local-time format with no offset.
**Fix:** UTC everywhere, with an unambiguous timestamp field; convert for display
only.

**Symptom:** Sorting or string comparison behaves differently in the container than
in development.
**Cause:** A different locale — commonly the C/`C.UTF-8` fallback of a minimal
image against a full glibc locale on the developer's machine.
**Fix:** Do not rely on the ambient locale. Sort explicitly, or in the database
with a declared collation.

## Interview questions

**★ Why can't you fix a container's clock from inside it?**
Because time namespaces explicitly do not virtualise `CLOCK_REALTIME` — the man
page says virtualisation "was avoided for reasons of complexity and overhead
within the kernel" — so the container reads the host's wall clock. Changing it
would require `CAP_SYS_TIME` and would move the *host's* clock. Skew is fixed with
NTP on the host.

**★ What does `TZ` actually change?**
Only how the C library renders a timestamp for display. The underlying clock, and
anything stored as an epoch value, is unaffected. It also depends on a zoneinfo
database being present in the image; without one, the name cannot be resolved and
the setting silently does nothing.

**★ Why do containers default to UTC?**
Not by design — by absence. With no `/etc/localtime` and no `TZ`, the C library
falls back to UTC. Minimal base images ship no timezone data at all, which is why
`scratch` and distroless images cannot do local-time formatting until the zoneinfo
files are copied in.

**How would you set the timezone on both Docker and Podman?**
With the `TZ` environment variable, because Podman's `--tz` flag — which also
accepts `local` to match the host — has no Docker equivalent. Bind-mounting
`/etc/localtime` read-only works on both but ties the image's behaviour to the
host's configuration.

**What is the right posture for time in a containerised system?**
UTC in the containers, UTC in storage, UTC in logs, converted to a local zone only
at the point a human reads it. It keeps one image valid in every region and makes
cross-container log correlation arithmetic instead of guesswork.

**What surprises people about locales in minimal images?**
That the fallback differs. musl always defaults to `C.UTF-8` and processes other
locales as multibyte UTF-8, so setting `LANG` on an Alpine image does not reproduce
a glibc image's locale-specific sorting and formatting. Anything that must be
stable should be sorted and formatted explicitly rather than inherited from the
base image.

---

← Prev: [Running containers under systemd](14-under-systemd.md) · Index: [Phase 10](README.md) · Next → [Zero-downtime restarts without an orchestrator](16-zero-downtime-restarts.md)
