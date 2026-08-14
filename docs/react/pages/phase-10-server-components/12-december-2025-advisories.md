---
title: "The December 2025 advisories"
sidebar_label: "12 · The December 2025 advisories"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 from documentation — react.dev
> [Critical Security Vulnerability in React Server Components](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
> (3 Dec 2025) and
> [Denial of Service and Source Code Exposure in React Server Components](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components)
> (11 Dec 2025), plus GitHub advisory
> [GHSA-fv66-9v8q-g76r](https://github.com/advisories/GHSA-fv66-9v8q-g76r) for the CVSS
> vector and version ranges.
> ⚠️ **Neither React writeup describes the underlying code defect**, and this page does not
> invent one — third-party reconstructions exist and are not cited here.
> No sandbox script backs this page; claims are cited, not measured.

**In December 2025 the RSC renderer packages had a CVSS 10.0 unauthenticated remote code
execution vulnerability, and eight days later a second advisory added denial of service and
source-code exposure.** The interview-relevant lesson is not the CVE numbers — it is what the
advisories say about *who* was affected, which is broader than almost anyone expected.

## The critical one — CVE-2025-55182

> **This vulnerability was disclosed as CVE-2025-55182 and is rated CVSS 10.0.**
>
> **An unauthenticated attacker could craft a malicious HTTP request to any Server Function
> endpoint that, when deserialized by React, achieves remote code execution on the server.**

| | |
|---|---|
| **Affected** | `react-server-dom-webpack`, `react-server-dom-parcel`, `react-server-dom-turbopack` — **19.0, 19.1.0, 19.1.1, 19.2.0** |
| **Fixed in** | **19.0.1, 19.1.2, 19.2.1** |
| **Vector** | network, no privileges required, unauthenticated |

The GitHub advisory gives the ranges as `= 19.0.0`, `≥ 19.1.0 < 19.1.2`, and `= 19.2.0`, with
the CVSS vector reading *"Attack vector: Network, Privileges required: None"* and every
impact category High. That combination — remote, unauthenticated, full compromise — is what
a 10.0 means.

### 🔴 You did not need to write a Server Function to be exposed

> **Even if your app does not implement any React Server Function endpoints it may still be
> vulnerable if your app supports React Server Components.**

This is the sentence to remember. The vulnerable code is the **deserializer** in the renderer
package, which exists wherever RSC is supported. "We don't use Server Functions" was not a
defence.

### The frameworks named

> **Some React frameworks and bundlers depended on, had peer dependencies for, or included
> the vulnerable React packages. The following React frameworks & bundlers are affected:**
> `next`, `react-router`, `waku`, `@parcel/rsc`, `@vitejs/plugin-rsc`, and `rwsdk`.

So a project whose `package.json` never mentions `react-server-dom-*` could still be
vulnerable through a transitive dependency — which is exactly why "we pinned React" is not
the same as "we are patched" ([topic 01 · 02](01-what-a-server-component-is/02-defaults-and-limits.md)).

### Who was not affected

> **If your app's React code does not use a server, your app is not affected by this
> vulnerability. If your app does not use a framework, bundler, or bundler plugin that
> supports React Server Components, your app is not affected by this vulnerability.**

A pure client-side React SPA — `createRoot` in a browser, no RSC — was never in scope.

### The timeline

| Date | Event |
|---|---|
| **29 Nov** | Lachlan Davidson reports it via Meta Bug Bounty |
| **30 Nov** | Meta security researchers confirm and start work with the React team |
| **1 Dec** | fix created; coordination with hosting providers and open-source projects |
| **3 Dec** | fix published to npm and disclosed as CVE-2025-55182 |

Four days from report to coordinated disclosure, with a pre-notified ecosystem. Worth knowing
as an example of how a critical disclosure is *supposed* to run.

## The follow-ups — 11 December

Eight days later, a second advisory:

| Issue | CVEs | Severity |
|---|---|---|
| **Denial of service** | CVE-2025-55184, CVE-2025-67779, **CVE-2026-23864** | High, **CVSS 7.5** |
| **Source code exposure** | CVE-2025-55183 | Medium, **CVSS 5.3** |

**Fixed in 19.0.4, 19.1.5 and 19.2.4** — and the affected list is much longer than the first
advisory's, covering 19.0.0 through 19.2.3 of the same three packages.

### Denial of service

> **A malicious HTTP request can be crafted and sent to any Server Functions endpoint that,
> when deserialized by React, can cause an infinite loop that hangs the server process and
> consumes CPU.**

The later CVE-2026-23864 broadens it:

> **The vulnerabilities are triggered by sending specially crafted HTTP requests to Server
> Function endpoints, and could lead to server crashes, out-of-memory exceptions or excessive
> CPU usage; depending on the vulnerable code path being exercised, the application
> configuration and application code.**

Same "even if you implement no Server Functions" caveat applies.

### Source code exposure

> **A malicious HTTP request sent to a vulnerable Server Function may unsafely return the
> source code of any Server Function. Exploitation requires the existence of a Server Function
> which explicitly or implicitly exposes a stringified argument.**

The documented example is worth reading closely, because it looks like ordinary code:

```js
'use server';

export async function serverFunction(name) {
  const conn = db.createConnection('SECRET KEY');
  const user = await conn.createUser(name); // implicitly stringified, leaked in db

  return {
    id: user.id,
    message: `Hello, ${name}!`              // explicitly stringified, leaked in reply
  };
}
```

**What leaks is the function's source**, so what an attacker gets is anything *hardcoded* in
it — the `'SECRET KEY'` literal above. And the crucial distinction:

> **runtime secrets such as `process.env.SECRET` are not affected.**

Which turns a piece of ordinary hygiene into a concrete mitigation: a secret read from the
environment at runtime was not exposed by this bug, and a secret written into the source was.

## 🔴 Two patch levels were incomplete

> **If you updated to 19.0.3, 19.1.4, and 19.2.3, these are incomplete, and you will need to
> update again.**

An organisation that responded promptly in early December could still have been on an
incomplete fix. **"We patched" is a claim about a version number, and the number matters** —
19.0.4, 19.1.5, 19.2.4 or later.

> **We recommend upgrading immediately due to the severity of the newly disclosed
> vulnerabilities.**

## What this means for how you manage versions

The docs recommend that bundler and framework authors **pin an exact React version** because
the RSC implementation APIs do not follow semver
([topic 01 · 02](01-what-a-server-component-is/02-defaults-and-limits.md)). December 2025 is
the counterweight to that advice:

- **Pinning without a review process is how you stay unpatched.** The pin protects you from a
  breaking minor; it does nothing about a 10.0.
- **The dependency is often transitive.** Audit for `react-server-dom-*` in the resolved
  lockfile, not in `package.json`.
- **An RSC app must not float its React version** *and* **must not freeze it forever.** Pin
  deliberately, watch the release channel, and treat an RSC advisory as a same-day upgrade.

## Gotchas

**Symptom:** "we don't use Server Functions, so we were fine."
**Cause:** the flaw was in the deserializer that ships wherever RSC is supported.
**Fix:** the advisory's own test is whether your app uses a framework, bundler or plugin that
supports RSC.

**Symptom:** `package.json` does not mention `react-server-dom-*`, so it looks unaffected.
**Cause:** frameworks depended on, had peer dependencies for, or included the vulnerable
packages.
**Fix:** audit the resolved lockfile.

**Symptom:** upgraded in early December and still vulnerable.
**Cause:** 19.0.3, 19.1.4 and 19.2.3 were incomplete fixes.
**Fix:** 19.0.4, 19.1.5, 19.2.4 or later.

**Symptom:** a hardcoded API key was exposed with no breach of the host.
**Cause:** source-code exposure returns the Server Function's source, including literals.
**Fix:** read secrets from the environment at runtime — those were explicitly not affected.

**Symptom:** the version is pinned, so upgrades are assumed handled.
**Cause:** pinning is a stability decision, not a security process.
**Fix:** pair the pin with a watch on the release channel.

**Symptom:** a client-only SPA team spent a week auditing.
**Cause:** the scope was misread.
**Fix:** an app whose React code does not use a server, or does not use an RSC-supporting
toolchain, was not affected.

## Interview questions

**★ What was CVE-2025-55182?**
An unauthenticated remote code execution vulnerability in React Server Components, rated
**CVSS 10.0**, disclosed 3 December 2025. A crafted HTTP request to any Server Function
endpoint achieved RCE when React deserialized it. It affected `react-server-dom-webpack`,
`-parcel` and `-turbopack` at 19.0, 19.1.0, 19.1.1 and 19.2.0, fixed in 19.0.1, 19.1.2 and
19.2.1.

**★ Who was affected — and what is the sentence people got wrong?**
*"Even if your app does not implement any React Server Function endpoints it may still be
vulnerable if your app supports React Server Components."* The defect was in the
deserializer that ships with RSC support, so writing no Server Functions was not a defence.
Not affected: apps whose React code does not use a server, and apps not using an
RSC-supporting framework, bundler or plugin.

**★ What did the second advisory add?**
Denial of service — CVE-2025-55184, CVE-2025-67779 and later CVE-2026-23864, CVSS 7.5, where
a crafted request causes an infinite loop, a crash, out-of-memory or excessive CPU — and
source-code exposure, CVE-2025-55183, CVSS 5.3, where a Server Function that explicitly or
implicitly stringifies an argument can be made to return its own source. Fixed in 19.0.4,
19.1.5 and 19.2.4.

**★ Why is "we patched in December" not a sufficient answer?**
Because 19.0.3, 19.1.4 and 19.2.3 were **incomplete** and needed updating again. The answer
has to name a version at or above 19.0.4, 19.1.5 or 19.2.4.

**What is the practical difference between a hardcoded secret and one read from the
environment, given the source-exposure bug?**
The bug returned the Server Function's source, so anything written as a literal in it — a
key, a token, a connection string — could leak. React states that runtime secrets such as
`process.env.SECRET` were not affected. It is a rare case where a standard hygiene rule maps
exactly onto a specific CVE's blast radius.

**How should an RSC app manage its React version?**
Pin deliberately rather than floating, because the RSC implementation APIs do not follow
semver — but treat the pin as something under review, not as done. Audit the resolved
lockfile for `react-server-dom-*`, since the dependency usually arrives through a framework,
and treat an RSC advisory as a same-day upgrade.

---

← Prev: [Where interactivity goes](11-where-interactivity-goes.md) ·
Index: [Phase 10](README.md) ·
Next → [The RSC payload](13-the-rsc-payload.md)
