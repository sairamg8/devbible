---
title: "The runtimes, and what scratch still needs"
sidebar_label: "02 · Runtimes and scratch"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [Node.js — Single executable applications](https://nodejs.org/api/single-executable-applications.html)
> and the Go, Rust and glibc sources named in [part 01](01-linking.md). The
> `scratch` and distroless facts it builds on are established in
> [page 06](../06-distroless-and-scratch.md), against
> [Docker — create a base image](https://docs.docker.com/build/building/base-images/).
> **No sandbox** — no console output on this page.

**Two of the three reasons a Node service cannot ship on `scratch` are not
linking problems at all — which is why no build flag has ever fixed them.**
Part 01 established what makes a binary self-sufficient. This part is why that
property is available to some runtimes and structurally unavailable to others,
and what a `scratch` image still expects even when you have it.

## Why Node cannot — three separate reasons

It is worth separating these, because only one of them is about linking and the
other two are the ones that actually decide it.

**1. Your program is not a binary.** Go and Rust compile to machine code. A Node
service is JavaScript interpreted by a separate executable. `scratch` plus your
`.js` files is not a runnable image; the thing that has to be self-sufficient is
**`node` itself**, and it is a large C++ program with V8 inside it. Even
statically linked, that is not a small-image story.

**2. Native addons are `dlopen`ed by design.** A `.node` file is a shared object
loaded at runtime. That is the mechanism, not an implementation detail — which is
why the runtime exposes `process.dlopen()` at all. A program whose extension
model *is* dynamic loading cannot be closed up into one static file without
giving that up.

**3. Dependencies are a tree of files, not a link step.** `node_modules` is read
from disk at require time. There is no link stage that could fold it in.

Reasons 2 and 3 survive any amount of static linking, because they are about
*when files are read*, not about what the executable was linked against.

### What single-executable applications actually produce

Node does ship a single-file story, and it is worth knowing precisely what it is:

> "Node.js supports the creation of single executable applications by allowing
> the injection of a blob prepared by Node.js, which can contain a bundled
> script, into the `node` binary. During start up, the program checks if anything
> has been injected. If the blob is found, it executes the script in the blob.
> Otherwise Node.js operates as it normally does."

Read that carefully. The output is **a copy of the `node` binary** with your
script attached — the runtime is still all of it. The docs state the purpose in
the same terms:

> "This feature allows the distribution of a Node.js application conveniently to
> a system that does not have Node.js installed."

Two qualifications matter before anyone builds a pipeline on it. The feature is
marked **Stability: 1.1 — Active development**. And native addons, where they are
supported, go back through dynamic loading anyway — the documented route is to
bundle the addon as an asset, then write it "to a temporary file and [load] it
with `process.dlopen()`".

So SEA solves distribution to a machine without Node installed. It does not turn
a Node service into a `scratch`-shaped artefact, and it was never trying to.

**The right target for Node is distroless, not `scratch`** — which is exactly
what [page 06](../06-distroless-and-scratch.md) concluded from the other
direction.

### The same question for the other runtimes

| Runtime | Can it produce a self-sufficient binary? | What you actually ship on |
|---|---|---|
| **Go** | Yes, `CGO_ENABLED=0` | `scratch` or distroless `static` |
| **Rust** | Yes, a musl target | `scratch` or distroless `static` |
| **C/C++** | Yes with musl; with glibc, NSS is the catch | `scratch` if genuinely static |
| **Node.js** | No — interpreter, `dlopen`ed addons, `node_modules` | distroless `nodejs` |
| **Python** | No, for the same three reasons | distroless `python3` or `-slim` |
| **Java** | Only via a native-image compiler, which is a different toolchain | distroless `java` |

The Java row is the one worth a sentence. A native-image compiler genuinely does
produce a self-contained executable, so the answer is not "impossible" — it is
that you have adopted a different toolchain with its own constraints on
reflection and dynamic class loading. That is a language decision, not a
packaging one, and it belongs upstream of the Dockerfile.

## What `scratch` still needs even with a static binary

Static linking removes the *libraries*. It does not remove the **data files** a
program expects, and this is where a first `scratch` attempt usually fails:

| Missing | Symptom |
|---|---|
| `/etc/ssl/certs/ca-certificates.crt` | Every outbound HTTPS call fails to verify |
| `/etc/resolv.conf` | Even the pure Go resolver has no nameserver to ask |
| `/etc/passwd` | `USER appuser` cannot resolve the name — use a numeric uid |
| Zone data (`/usr/share/zoneinfo`) | Every local time is UTC |
| `/tmp` | Anything writing a temp file fails; there is no directory |

All five are `COPY --from=build` lines, or a distroless `static` base that already
includes them. That trade — a handful of `COPY` lines versus a base image you did
not build — is the actual decision, and it is the reason distroless `static`
exists.

Note that the `/etc/resolv.conf` row has a wrinkle: the engine normally writes
that file into the container at start-up, so it is present at runtime even though
it is not in the image. It is listed here because a build-time check of the image
contents will not find it, and because the pure Go resolver's dependency on it is
the thing people are surprised by.

## Choosing, in one paragraph

If the language compiles to a self-contained binary, `scratch` is available and
distroless `static` is the version of it that already carries the five files
above. If the language ships a runtime — Node, Python, a JVM without native-image
— `scratch` is not a target you should be arguing toward, and distroless is the
minimal base that exists for exactly that case. The size work that remains is
then the work [page 01](../01-where-size-goes.md) describes, not a linking
question.

## Podman

Nothing on this page is engine-specific. Linking happens in the build, and the
build produces the same OCI image either way; Buildah and `podman build` execute
the identical multi-stage Dockerfile. `FROM scratch` is understood by both.

The one Podman-adjacent note is the rootless one, and it is unchanged from
[page 03](../03-least-privilege.md): a static binary running as a numeric uid on
`scratch` is the least-privilege end state under either engine, and having no
shell in the image is a larger practical gain under rootless Podman than the
static linking itself.

## Gotchas

**Symptom:** Someone proposes putting the Node service on `scratch` to match the
Go service.
**Cause:** Treating "static binary" as a language-agnostic packaging choice
rather than a linking property.
**Fix:** Distroless `nodejs`. The interpreter, the `dlopen`ed addons and
`node_modules` each independently rule `scratch` out.

**Symptom:** A single-executable Node build is adopted expecting a small image,
and the image is not small.
**Cause:** SEA injects a blob into **a copy of the `node` binary** — the whole
runtime is still in the artefact. It targets distribution to machines without
Node, not image size.
**Fix:** Judge SEA on the problem it solves. For image size, multi-stage plus a
distroless base is the lever.

**Symptom:** A static Go binary on `scratch` fails every HTTPS request.
**Cause:** No CA bundle. Static linking removed the libraries, not the data files.
**Fix:** `COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/`,
or use distroless `static`, which ships it.

**Symptom:** `USER appuser` fails on a `scratch` image that otherwise works.
**Cause:** There is no `/etc/passwd`, so the name cannot be resolved to a uid.
**Fix:** A numeric uid — `USER 65532:65532` — or a distroless `nonroot` tag.

## Interview questions

**★ Why can a Go service ship on `scratch` when a Node service cannot?**
Go compiles to machine code and, with cgo disabled, links everything including
its runtime into one file with no ELF interpreter and no shared-object
dependencies — so it needs nothing from the filesystem it lands in. A Node
service is JavaScript run by a separate interpreter, its native addons are shared
objects loaded with `process.dlopen()` at runtime, and `node_modules` is read
from disk at require time. Two of those three are not linking problems at all,
which is why no build flag fixes them.

**★ Does Node's single-executable feature change the answer?**
Not for image size. SEA injects a blob containing your script into **a copy of
the `node` binary**, so the whole runtime is still there, and the feature is
marked *Stability: 1.1 — Active development*. Bundled native addons are written
to a temporary file and loaded with `process.dlopen()` at runtime. It solves
distribution to a machine without Node installed; it does not make a
`scratch`-shaped artefact.

**★ A static binary is on `scratch` and every HTTPS request fails. What is
missing?**
The CA bundle. Static linking removes library dependencies, not data files —
`/etc/ssl/certs/ca-certificates.crt` has to be copied in from the build stage, as
do `/etc/passwd` if you use a named `USER`, zone data if you need local time, and
`/tmp` if anything writes one.

**Is Java a yes or a no?**
Conditionally yes, and the condition is a different toolchain: a native-image
compiler produces a self-contained executable, at the cost of constraints on
reflection and dynamic class loading. Without it, the JVM is a runtime like any
other and distroless `java` is the target.

**If distroless `static` and `scratch` both work, which do you pick?**
Distroless `static`, unless you have a reason not to. It is the `scratch` case
with the CA bundle, `/etc/passwd`, zone data and `/tmp` already present and
maintained by someone else — which is the same set of files you would otherwise
be copying in and keeping current yourself.

---

← Prev: [Linking](01-linking.md) · Index: [Static binaries](README.md) · Next → **SBOMs and provenance** *(not written yet)*
