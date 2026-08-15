---
title: "Linking, and how a binary becomes self-sufficient"
sidebar_label: "01 · Linking"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [the Go `cmd/cgo` documentation](https://pkg.go.dev/cmd/cgo),
> [the Go `net` package](https://pkg.go.dev/net),
> [the Go `os/user` package](https://pkg.go.dev/os/user),
> [The Rust Reference — Linkage](https://doc.rust-lang.org/reference/linkage.html),
> [`nsswitch.conf(5)`](https://man7.org/linux/man-pages/man5/nsswitch.conf.5.html)
> and [the GNU C Library manual — NSS Module Names](https://sourceware.org/glibc/manual/latest/html_node/NSS-Module-Names.html).
> **No sandbox** — no console output on this page.

**"Statically linked" means the file names no ELF interpreter and no shared
objects, so there is nothing left for the filesystem to fail to provide.** Every
language answer on the next page follows from that one sentence.

## Dynamic linking is the default, and it is a runtime dependency

A normally compiled Linux executable is not a complete program. It is a file that
names an **ELF interpreter** — the dynamic loader — and lists the shared objects
it expects that loader to find: `libc.so.6`, `libssl.so.3`, whatever else it was
built against. At `exec` time the kernel starts the loader, the loader maps those
libraries in, and only then does your `main` run.

Every one of those names is a file that must exist **in the container's
filesystem**, because the container's filesystem is the only one it can see. On a
Debian base they are all there. On `scratch` none of them are, including the
loader itself.

This is why the failure is so confusing. The kernel cannot find the interpreter
named in the header, and the message you get names **your** binary:

> `no such file or directory` — for a file you can plainly see is present.

The file is there. Its loader is not. A statically linked binary has no
interpreter and no shared-object list, so there is nothing left to be missing.

## Go: one environment variable

Go's compiler emits static binaries by default — the entire runtime is linked in.
The thing that pulls in a dynamic libc is **cgo**, and cgo is on by default when
it can be:

> "The cgo tool is enabled by default for native builds on systems where it is
> expected to work."
>
> "You can override the default by setting the CGO_ENABLED environment variable
> when running the go tool: set it to 1 to enable the use of cgo, and to 0 to
> disable it."

So the flag everybody copies is doing exactly one thing — refusing C:

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.25 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /bin/app ./cmd/app

FROM scratch
COPY --from=build /bin/app /app
ENTRYPOINT ["/app"]
```

Note the second half of the cgo rule, because it explains an inconsistency people
hit and misdiagnose. cgo is also

> "disabled by default when cross-compiling as well as when the CC environment
> variable is unset and the default C compiler (typically gcc or clang) cannot be
> found on the system PATH."

Which means a build that cross-compiles, or runs on an image with no C compiler,
is already static without anyone asking — and the same source built natively on a
machine that *has* gcc is not. **A binary that worked on `scratch` from CI and
fails from a developer's laptop is usually this**, not a Dockerfile difference.

### The two packages that reach for libc

Turning cgo off changes behaviour in two standard-library packages, and both
changes are documented and deliberate.

**`net`** has two resolvers. The pure Go one is already preferred on Unix:

> "On Unix the pure Go resolver is preferred over the cgo resolver, because a
> blocked DNS request consumes only a goroutine, while a blocked C call consumes
> an operating system thread."

The cgo resolver is used instead in specific cases the docs list — systems that
do not permit direct DNS requests, a non-empty `RES_OPTIONS`, `HOSTALIASES` or
`LOCALDOMAIN`, or when `/etc/resolv.conf` or `/etc/nsswitch.conf` "specify
unsupported features". The `netgo` build tag removes the choice:

> "netgo: disables entirely the use of the native (CGO) resolver, meaning the Go
> resolver is the only one that can be used."

The practical consequence for a `scratch` image: the pure Go resolver reads
`/etc/resolv.conf` itself, so **that file still has to be in the image** even
though no libc is.

**`os/user`** goes the other way by default:

> "When cgo is available, and the required routines are implemented in libc for a
> particular platform, cgo-based (libc-backed) code is used."
>
> "This can be overridden by using osusergo build tag, which enforces the pure Go
> implementation."

The pure Go implementation parses `/etc/passwd` and `/etc/group` — which a
`scratch` image also does not have unless you put them there.

`CGO_ENABLED=0` gets you both pure-Go paths implicitly. `netgo` and `osusergo`
are how you get them while *keeping* cgo on for some other dependency.

## The glibc catch: "statically linked" is not always fully static

Linking a C program against glibc with `-static` does not reliably produce a
self-contained binary, and this is a design property of glibc rather than a bug.

Name lookups — `getaddrinfo`, `getpwnam` and friends — do not resolve anything
themselves. They dispatch through the **Name Service Switch**, and NSS backends
are shared objects looked up by name at runtime. `nsswitch.conf(5)`:

> "Libraries called _/lib/libnss_SERVICE.so._**X** will provide the named
> _SERVICE_."
>
> "The service specifications supported on your system depend on the presence of
> shared libraries, and are therefore extensible."

The glibc manual names the same mechanism concretely — a `files` lookup for
`gethostbyname` resolves `_nss_files_gethostbyname_r` out of `libnss_files.so.2`.

A binary that is statically linked in every other respect therefore still needs
those `libnss_*.so` files present, with a version matching what it was linked
against, the moment it resolves a hostname or a username. On `scratch` they are
not present.

:::note What the docs settle and what they do not
The documentation establishes the mechanism plainly: NSS services are shared
objects and are available only if the shared library is present. It does **not**
publish a statement of the form "a static glibc binary will fail at
`getaddrinfo`" — the toolchain communicates that as a *link-time warning* rather
than in the manual. The warning is real and long-standing (it is the subject of
[golang/go#21421](https://github.com/golang/go/issues/21421)), but it is a
toolchain message, not a documented guarantee, so this page argues from the
mechanism instead of quoting a promise nobody made.
:::

This is the honest reason musl gets recommended for static linking: musl
implements these lookups without a plugin architecture, so a musl static binary
does not have this class of runtime dependency. That is a real difference, and it
comes with everything [page 05](../05-alpine-and-musl.md) already said about musl
being a genuinely different libc.

## Rust: pick the target

Rust's default Linux target links against glibc dynamically. Static linking is a
**target** choice, and the musl targets are configured for it. The Rust Reference
lists the targets whose C runtime is static by default:

> `arm-unknown-linux-musleabi`, `arm-unknown-linux-musleabihf`,
> `armv7-unknown-linux-musleabihf`, `i686-unknown-linux-musl`,
> `x86_64-unknown-linux-musl`

and notes that `x86_64-unknown-linux-musl` is among the targets that "typically
come with both runtimes and the user selects which one they'd like", via the
`crt-static` target feature. Code can even branch on the outcome with
`#[cfg(target_feature = "crt-static")]`.

```dockerfile
# syntax=docker/dockerfile:1
FROM rust:1.90 AS build
WORKDIR /src
COPY . .
RUN rustup target add x86_64-unknown-linux-musl \
 && cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=build /src/target/x86_64-unknown-linux-musl/release/app /app
ENTRYPOINT ["/app"]
```

The caveat is the same one Alpine has: a crate that binds to a C library needs
that library available **for the musl target**, and a prebuilt glibc one will not
do. Pure-Rust crates are unaffected; anything wrapping OpenSSL, libpq or a
compression library is where this bites.

## Gotchas

**Symptom:** A Go binary runs on the build image and exits immediately on
`scratch` with `no such file or directory`.
**Cause:** cgo was enabled, so the binary is dynamically linked and names an ELF
interpreter that `scratch` does not contain. The message names your binary, which
is why it misleads.
**Fix:** Build with `CGO_ENABLED=0`, or ship on a base that has a libc.

**Symptom:** The same source produces a static binary in CI and a dynamic one
locally.
**Cause:** cgo's default is conditional — off when cross-compiling or when no C
compiler is on `PATH`, on otherwise. Nobody changed the Dockerfile.
**Fix:** Set `CGO_ENABLED` explicitly in the build stage so the outcome does not
depend on what the machine happened to have.

**Symptom:** A statically linked C program resolves hostnames on the build host
and fails inside `scratch`.
**Cause:** glibc NSS lookups load `libnss_*.so` at runtime, so "statically
linked" did not include the resolver backends.
**Fix:** Build against musl, or ship a base that carries the NSS libraries.

**Symptom:** A Rust build switched to a musl target and now fails to link a
dependency.
**Cause:** A crate binds a C library, and the prebuilt one on the build image is
glibc-targeted.
**Fix:** Install the musl-targeted build of that library in the build stage, or
choose a pure-Rust alternative.

## Interview questions

**★ What does `CGO_ENABLED=0` actually do, and what changes as a result?**
It refuses cgo, so no C is compiled in and nothing links against a dynamic libc.
Two standard-library packages change behaviour: `net` uses the pure Go resolver
(the `netgo` tag does the same while leaving cgo on), and `os/user` uses its pure
Go implementation, which parses `/etc/passwd` instead of calling libc — the
`osusergo` tag forces that independently. Note the default is conditional: cgo is
already off when cross-compiling or when no C compiler is on `PATH`, so the same
source can link differently on two machines.

**★ Why is "statically linked against glibc" not the same as self-contained?**
Because glibc's name lookups dispatch through NSS, whose backends are shared
objects — `nsswitch.conf(5)` states the available services "depend on the
presence of shared libraries", and the glibc manual names `libnss_files.so.2`
concretely. So a `-static` binary still needs those `.so` files at runtime the
moment it resolves a hostname or a user. musl has no such plugin architecture,
which is why static linking is normally paired with musl.

**★ A binary you can see in the image fails with `no such file or directory`. What
is going on?**
The message is about the ELF interpreter, not your binary. A dynamically linked
executable names a loader in its header and lists the shared objects it needs;
the kernel cannot find the loader inside `scratch`, and reports the failure
against the file you invoked. Either link statically or ship on a base with a
libc.

**How does Rust produce a static binary?**
By choosing a musl target rather than the default glibc one. The Rust Reference
lists `x86_64-unknown-linux-musl` and the other musl targets as static by
default, governed by the `crt-static` target feature. The catch matches Alpine's:
a crate binding a C library needs that library built for musl.

**If cgo has to stay on for one dependency, can you still get pure-Go networking?**
Yes — that is exactly what the `netgo` and `osusergo` build tags are for. They
force the pure Go resolver and the pure Go user lookup independently of
`CGO_ENABLED`, so one cgo dependency does not drag libc into every subsystem.

---

← Prev: [Supply-chain risk](../09-supply-chain-risk.md) · Index: [Static binaries](README.md) · Next → [The runtimes, and what `scratch` still needs](02-runtimes-and-scratch.md)
