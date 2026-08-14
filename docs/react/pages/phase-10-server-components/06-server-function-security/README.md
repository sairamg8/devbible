---
title: "Server Function security"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8** and **Next.js 16.3.1**, from documentation —
> react.dev [`'use server'`](https://react.dev/reference/rsc/use-server) (Security
> considerations) and Next.js
> [How to think about data security](https://nextjs.org/docs/app/guides/data-security).
> No sandbox script backs this topic; claims are cited, not measured.

**Every Server Function is a public HTTP endpoint that anyone can call with any arguments.**
Not "effectively", not "in theory" — it is reachable by direct POST, whether or not your UI
ever calls it. Once that is internalised, the rest of this topic is just the standard
backend discipline you would apply to any route.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Everything you write is an endpoint](01-everything-is-an-endpoint.md)** | The threat model, why arguments are untrusted, why a page-level auth check does not protect the action defined inside it, authorization versus authentication, and controlling what you return |
| 02 | **[What the framework does, and what it does not](02-what-the-framework-does.md)** | Action IDs, dead code elimination, closed-over variables being sent to the client and encrypted, the CSRF origin check — and why none of them replace a check inside the function |

## The one-line version

React states the obligation in two sentences and no more than that:

> **Arguments to Server Functions are fully client-controlled. For security, always treat
> them as untrusted input, and make sure to validate and escape arguments as appropriate.**
>
> **In any Server Function, make sure to validate that the logged-in user is allowed to
> perform that action.**

⚠️ **React's documented security guidance stops there.** Everything about action IDs,
closures, encryption keys and origin checking is **framework** behaviour — the material
below is cited to Next.js and labelled as such. Another RSC implementation may do none of
it, which is precisely why the checks belong inside your function rather than in the
platform.

## Where this connects

- **[Topic 04 · `'use server'`](../04-use-server.md)** — the module-level form marks *every
  export* as an endpoint, which is where most accidental exposure starts.
- **[Topic 05 · What crosses the boundary](../05-what-crosses-the-boundary.md)** —
  serialization decides what an attacker can send you and what you accidentally send back.
- **[Topic 19 · Taint APIs](../19-taint-apis.md)** — turning "a secret reached the client"
  into a runtime error.
- **Express** — validation, status codes, rate limiting and error contracts are Express
  material and transfer wholesale. A Server Function is a route handler with a nicer calling
  convention.

---

← Index: [Phase 10](../README.md) ·
Next → [Everything you write is an endpoint](01-everything-is-an-endpoint.md)
