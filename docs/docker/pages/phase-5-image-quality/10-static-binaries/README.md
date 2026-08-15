---
title: "Static binaries"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [the Go `cmd/cgo` documentation](https://pkg.go.dev/cmd/cgo),
> [the Go `net` package](https://pkg.go.dev/net),
> [the Go `os/user` package](https://pkg.go.dev/os/user),
> [The Rust Reference — Linkage](https://doc.rust-lang.org/reference/linkage.html),
> [`nsswitch.conf(5)`](https://man7.org/linux/man-pages/man5/nsswitch.conf.5.html),
> [the GNU C Library manual — NSS Module Names](https://sourceware.org/glibc/manual/latest/html_node/NSS-Module-Names.html)
> and [Node.js — Single executable applications](https://nodejs.org/api/single-executable-applications.html).
> **No sandbox** — no console output on this page.

**A `scratch` image works when the binary needs nothing from the filesystem it
lands in — and that is a property of how the binary was linked, not of the
language's reputation.** "Go ships on `scratch`" is a true statement about a
default, not a law. The same Go program compiled a slightly different way needs a
loader and a libc like anything else.

[Page 06](../06-distroless-and-scratch.md) established *what* `scratch` is. This
topic is the linking question underneath it, in two parts.

| # | Part | What it settles |
|---|---|---|
| 01 | **[Linking, and how a binary becomes self-sufficient](01-linking.md)** | Why dynamic linking is a runtime dependency, `CGO_ENABLED=0` and the two Go packages it changes, why "static against glibc" is not fully static, and Rust's musl targets |
| 02 | **[The runtimes, and what `scratch` still needs](02-runtimes-and-scratch.md)** | The three independent reasons Node cannot, what single-executable applications actually produce, the same question for Python and Java, and the five data files a static binary still expects |

**Read 01 first** — part 02's argument about Node depends on the distinction 01
draws between a linking property and a packaging one.

---

← Prev: [Supply-chain risk](../09-supply-chain-risk.md) · Index: [Phase 5](../README.md) · Next → [SBOMs and provenance](../11-sbom-and-provenance.md)
