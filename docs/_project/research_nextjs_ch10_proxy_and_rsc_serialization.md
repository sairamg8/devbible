---
name: research-nextjs-ch10-proxy-and-rsc-serialization
description: Banked verbatim primary-source quotes for Next.js chapter 10 topics 04 (proxy.ts / defence in depth) and 05 (RSC serialization, React2Shell). Do not re-derive; every quote below was fetched 2026-09-05.
metadata:
  type: research
---

# Banked research — nextjs ch10 topics 04 & 05

🔴 **Do not re-derive.** Fetched 2026-09-05. Version spine: **Next.js 16.3.4 · React 19.2.8 · TypeScript 7.0.2 · zod 4.4.3.**
`nextjs.org/docs` serves Markdown — append `.md`. Cite `lastUpdated:`, never `version:`.

## Sources fetched

| Source | URL | `lastUpdated` |
|---|---|---|
| `proxy.js` file convention | https://nextjs.org/docs/app/api-reference/file-conventions/proxy.md | 2026-08-25 |
| How to implement authentication | https://nextjs.org/docs/app/guides/authentication.md | 2026-08-25 |
| How to think about data security | https://nextjs.org/docs/app/guides/data-security.md | 2026-08-25 |
| The Server and Client Boundary | https://nextjs.org/docs/app/guides/server-and-client-boundary.md | 2026-08-25 |
| Server and Client Components | https://nextjs.org/docs/app/getting-started/server-and-client-components.md | 2026-08-25 |
| `use server` directive | https://nextjs.org/docs/app/api-reference/directives/use-server.md | 2026-08-25 |
| GHSA-fv66-9v8q-g76r (JSON) | `curl https://api.github.com/advisories?cve_id=CVE-2025-55182` | published 2025-12-03 |
| React blog, React2Shell | https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components | 2025-12-03 |

## 🔴 The load-bearing quotes for topic 04

**Server Functions are not routes in the matcher chain** (`proxy.js`, under Execution order):
> "Server Functions are not separate routes in this chain. They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on that path."
> "A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."

**Runtime** (`proxy.js`): "Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."
Version history: `v16.0.0` "Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime" · `v15.5.0` "Middleware can now use the Node.js runtime (stable)" · `v15.2.0` "(experimental)".

**Matchers** (`proxy.js`): "Without a `matcher`, Proxy runs on **every request**, including static files (`_next/static`), image optimizations (`_next/image`), and assets in the `public/` folder." · "The `matcher` values need to be constants so they can be statically analyzed at build-time. Dynamic values such as variables will be ignored." · "Even when `_next/data` is excluded in a negative matcher pattern, proxy will still be invoked for `_next/data` routes. This is intentional behavior to prevent accidental security issues where you might protect a page but forget to protect the corresponding data route."

**Deployment / statelessness** (`proxy.js`): "Proxy is meant to be invoked separately of your render code and in optimized cases deployed to your CDN for fast redirect/rewrite handling, you should not attempt relying on shared modules or globals." · "To pass information from Proxy to your application, use headers, cookies, rewrites, redirects, or the URL."

**RSC header stripping** (`proxy.js`): "During RSC requests, Next.js strips internal Flight headers from the `request` instance in Proxy … This is to prevent accidentally handling an RSC request differently than the HTML request as both need to align."

**Rename intent** (`proxy.js`, Migration to Proxy): "Middleware is highly capable, so it may encourage the usage; however, this feature is recommended to be used as a last resort." · "The term 'proxy' implies a network boundary in front of the app, which is how this feature behaves."

**Optimistic checks** (authentication guide): "since Proxy runs on every route, including prefetched routes, it's important to only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues." · "While Proxy can be useful for initial checks, it should not be your only line of defense in protecting your data. The majority of security checks should be performed as close as possible to your data source." · "for auth, it's recommended Proxy runs on all routes."
🔴 The guide's own snippet uses `protectedRoutes.includes(path)` — **exact match**, so `/dashboard/billing` is not protected. Prefix-match instead.

**Layouts are not a boundary** (authentication guide): "A layout also does not control whether the rest of the route renders. Route segments and parallel route slots are rendered by the router, so a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload." · "Due to Partial Rendering, be cautious when doing checks in Layouts as these don't re-render on navigation." · "A common pattern in SPAs is to `return null` … This pattern is **not recommended** since Next.js applications have multiple entry points."

**Static-route exception** (authentication guide): "for static routes that share data between users, data will be fetched at build time and not at request time. Use Proxy to protect static routes."

**Auditing** (data security): "`proxy.ts` and `route.ts`: Have a lot of power. Spend extra time auditing these using traditional techniques."

## 🔴 The load-bearing quotes for topic 05

**RSC Payload contents** (Server and Client Components): "The RSC Payload contains: The rendered result of Server Components · Placeholders for where Client Components should be rendered and references to their JavaScript files · Any props passed from a Server Component to a Client Component." · "On the initial load, the RSC Payload ships with the HTML."

**Boundary rules** (Server and Client Boundary): "Code crosses through imports … Data crosses through props, and it must be serializable, so functions like event handlers cannot cross." · "A Server Function marked with `'use server'` crosses as a reference." · "A Server Function is not distinguishable from a plain function by its type. The TypeScript plugin allows a Client Component prop typed as a function when its name is `action` or ends in `Action`."

**Reachability + IDs** (data security): "when a Server Action is created and exported, it is reachable via a direct POST request, not just through your application's UI … even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally." · "The IDs are created during compilation and are cached for a maximum of 14 days." · "you should still treat Server Actions as reachable via direct POST requests and verify authentication and authorization inside each one."

**DTO / classes** (data security): "Use classes to avoid accidentally passing the whole object to the client." · "Functions and classes are already blocked from being passed to Client Components by default." · "only return the data relevant for this query and not everything" · "Don't pass values, read back cached values" · "EXPOSED: This exposes all the fields in userData to the client because we are passing the data from the Server Component to the Client."

**Closures** (data security): "the captured variables are sent to the client and back to the server when the action is invoked … Next.js automatically encrypts the closed-over variables. A new private key is generated for each action every time a Next.js application is built. This means actions can only be invoked for a specific build." · "We don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."

**Encryption key** (data security): "The key must be a base64-encoded value whose decoded length matches a valid AES key size (16, 24, or 32 bytes). Next.js generates 32-byte keys by default." · `openssl rand -base64 32` · "Follow standard security practices such as key rotation and signing."

**Tainting** (data security): "it's an additional layer of protection, you should still filter and sanitize the data in your DAL before passing it to React's render context." Flag: `experimental: { taint: true }`.

**`use server` scope** (directive reference): "It can be used at the top of a file to indicate that all functions in the file are server-side."

## 🔴 CVE-2025-55182 / GHSA-fv66-9v8q-g76r — every fact, from the fetched advisory

- Summary: "React Server Components are Vulnerable to RCE". Severity **critical**. CVSS v3.1 **10.0**, `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H`. **CWE-502**, Deserialization of Untrusted Data. Published 2025-12-03. Reporter: Lachlan Davidson, 29 Nov 2025.
- "The vulnerability is present in versions 19.0.0, 19.1.0, 19.1.1, and 19.2.0 of: react-server-dom-webpack · react-server-dom-parcel · react-server-dom-turbopack"
- "A fix was introduced in versions 19.0.1, 19.1.2, and 19.2.1."
- Mechanism (react.dev): "a flaw in how React decodes payloads sent to React Server Function endpoints" · "An unauthenticated attacker could craft a malicious HTTP request to any Server Function endpoint that, when deserialized by React, achieves remote code execution on the server."
- 🔴 "Even if your app does not implement any React Server Function endpoints it may still be vulnerable if your app supports React Server Components."
- Affected frameworks/bundlers: "next, react-router, waku, @parcel/rsc, @vitejs/plugin-rsc, and rwsdk".
- Next.js patched lines: 14.2.35 (13.3.x–14.x) · 15.0.8 · 15.1.12 · 15.2.9 · 15.3.9 · 15.4.11 · 15.5.10 · 16.0.11 · 16.1.5 · canaries 15.6.0-canary.60, 16.1.0-canary.19. **`next@14.3.0-canary.77`+ must DOWNGRADE to stable 14.x.**
- "We have worked with a number of hosting providers to apply temporary mitigations. You should not depend on these to secure your app, and still update immediately."
- ⚠️ The advisory does **not** state the exploitation technique beyond "a flaw in how React decodes payloads". Do not reconstruct one.

## T1 probe (2026-09-05, this checkout)

`node -p "require('./node_modules/react/package.json').version"` → **19.2.8** (matches the corpus pin).
`Object.keys(require('react'))` filtered for `/taint/i` → **no `experimental_taint*` export**. Stable React does not ship them; the App Router reaches them via Next's bundled React canary, the Pages Router gets `undefined`. Tainting is a development backstop; the hand-written DTO projection is the certifiable control.

## Ownership map inside chapter 10 (measured on disk 2026-09-05)

`01`/`01b`–`01e` per-action authorization, validation, closures, return values, request envelope · `02`/`02b`/`02c` boundary validation · `03`/`03b`–`03h` sessions, DAL, auth libraries, authorization · `04`/`04b`/`04c`/`04d` proxy + defence-in-depth layering · `05`/`05b`/`05c` RSC serialization + React2Shell · `06`+ milestone · `10`/`11` CSP · `12`/`13` Cache Components auth · **`14` owns the entire 2026 CVE record** · `15` owns patching cadence.
