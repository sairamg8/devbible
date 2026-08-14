---
title: "What the framework does, and what it does not"
sidebar_label: "02 · What the framework does"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8** and **Next.js 16.3.1**, from documentation —
> Next.js [How to think about data security](https://nextjs.org/docs/app/guides/data-security)
> (secure action IDs, dead code elimination, closures and encryption, the encryption-key
> override, allowed origins) and react.dev
> [`'use server'`](https://react.dev/reference/rsc/use-server) (the WIP taint-API note).
> ⚠️ **Everything on this page except the taint note is framework behaviour, not React.**
> No sandbox script backs this page; claims are cited, not measured.

**A framework does add real protections around Server Functions.** Knowing them is worth a
lot in an interview and worth very little as a defence — because the documentation that
describes each one also tells you not to rely on it.

## Secure action IDs

> **Secure action IDs:** Next.js creates encrypted, non-deterministic IDs to allow the client
> to reference and call the Server Action. These IDs are periodically recalculated between
> builds for enhanced security.
>
> The IDs are created during compilation and are cached for a maximum of **14 days**. They
> will be regenerated when a new build is initiated or when the build cache is invalidated.

So the endpoint is not `/api/deletePost`. It is an opaque, rotating identifier the client
receives because the framework put it there.

**What that buys:** an attacker cannot guess endpoint names from your function names, and a
harvested id has a bounded life.
**What it does not buy:** anything against a caller who simply reads the id out of the page
they were legitimately served. It raises the cost of enumeration, not of abuse.

## Dead code elimination

> **Dead code elimination:** Unused Server Actions (referenced by their IDs) are removed from
> client bundle to avoid public access.

An exported Server Function that your application never references is removed at build time
and gets no public endpoint.

⚠️ **Do not invert this into a rule.** "Unused actions are removed" is a build optimisation
that happens to reduce surface. The moment anything references the function it is live
again, and the documentation's own framing — the default is *"reachable via a direct POST
request"* — is the one to design against.

## 🔴 Closures: your captured variables go to the client and come back

This is the mechanism most people have never thought about, and it is the reason the
"encrypted closure caveat" exists.

```jsx
export default async function Page() {
  const publishVersion = await getLatestVersion();

  async function publish() {
    'use server';
    if (publishVersion !== await getLatestVersion()) {
      throw new Error('The version has changed since pressing publish');
    }
    // …
  }

  return <form><button formAction={publish}>Publish</button></form>;
}
```

> **Closures are useful when you need to capture a *snapshot* of data (e.g.
> `publishVersion`) at the time of rendering so that it can be used later when the action is
> invoked.**
>
> **However, for this to happen, the captured variables are sent to the client and back to
> the server when the action is invoked.**

**Read that twice.** A variable you never passed as a prop, never rendered, and never
returned — merely *closed over* — makes a round trip through the browser. It has to: the
server does not keep the render's scope alive waiting for a click.

> **To prevent sensitive data from being exposed to the client, Next.js automatically
> encrypts the closed-over variables. A new private key is generated for each action every
> time a Next.js application is built. This means actions can only be invoked for a specific
> build.**

And then, immediately:

> **Good to know:** We don't recommend relying on encryption alone to prevent sensitive
> values from being exposed on the client.

🔴 **Treat that sentence as the rule.** Do not close over secrets in a Server Function.
Re-read what you need inside the function body, where it never leaves the server:

```jsx
// ✖ apiKey is captured, encrypted, and round-trips through the browser
const apiKey = process.env.API_KEY;
async function send() { 'use server'; await post(apiKey, …); }

// ✅ read it inside the function
async function send() { 'use server'; await post(process.env.API_KEY, …); }
```

The same reasoning applies to a bound argument: `action.bind(null, secret)` puts `secret`
into the same captured-and-returned channel.

### The multi-server consequence

> When **self-hosting** your Next.js application across multiple servers, each server
> instance may end up with a different encryption key, leading to potential inconsistencies.

The fix is `process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` — *"base64-encoded value whose
decoded length matches a valid AES key size (16, 24, or 32 bytes)"*, 32 by default. Worth
knowing because the symptom (actions failing on some instances and not others behind a load
balancer) looks nothing like a key problem.

## CSRF: POST-only plus an origin check

> **Since Server Actions can be invoked in a `<form>` element, this opens them up to CSRF
> attacks.** … **Behind the scenes, Server Actions use the `POST` method, and only this HTTP
> method is allowed to invoke them. This prevents most CSRF vulnerabilities in modern
> browsers, particularly with SameSite cookies being the default.**
>
> **As an additional protection, Server Actions in Next.js also compare the Origin header to
> the Host header (or `X-Forwarded-Host`). If these don't match, the request will be
> aborted.**

This also explains a Phase 9 fact from the other end: a function `action` is **POST
regardless of the `method` prop** ([Phase 9 · Actions](../../phase-9-forms-actions/02-actions.md)).
It is not an arbitrary restriction — GET mutations are exactly what CSRF exploits.

Behind a reverse proxy or a multi-layer backend, the Origin/Host comparison can fail
legitimately; `serverActions.allowedOrigins` is the escape hatch, and it takes an array of
hosts.

## Do not mutate during render

> **Mutations (e.g. logging out users, updating databases, invalidating caches) should never
> be a side-effect, either in Server or Client Components.** Next.js *"explicitly prevents
> setting cookies or triggering cache revalidation within render methods"*.

A `?logout=1` handled during render is a GET that mutates — one crafted link or a prefetch
away from being triggered without intent. Mutations go through Server Functions, which are
POST-only and origin-checked. This is [Phase 4](../../phase-4-effects/README.md)'s "render
must be pure" rule arriving with a security consequence attached.

## The taint APIs

React's own security section ends with a work-in-progress note:

> **To prevent sending sensitive data from a Server Function, there are experimental taint
> APIs to prevent unique values and objects from being passed to client code.**

`experimental_taintObjectReference` and `experimental_taintUniqueValue` are
[topic 19](../19-taint-apis.md). Two things to hold now: they are **experimental**, and
Next.js requires opting in via `experimental.taint` in `next.config.js`. Next.js's own
framing is the right one — *"it's an additional layer of protection, you should still filter
and sanitize the data in your DAL"*.

Also worth knowing, from the same page: *"Functions and classes are already blocked from
being passed to Client Components by default"* — the serialization rules from
[topic 05](../05-what-crosses-the-boundary.md) are themselves a security control, and the
taint APIs cover what serialization cannot catch: a perfectly serializable string that
happens to be a token.

## The audit checklist

Next.js's own list for `"use server"` files, which is as good a review checklist as exists:

> Are the Action arguments validated in the action or inside the Data Access Layer? Is the
> user re-authorized inside the action? Does the action check ownership of the resource
> (authorization, not just authentication)? Are return values filtered to only what the
> client needs? Is database access delegated to a `server-only` Data Access Layer?

And for the other side: *"`'use client'` files: Are the Component props expecting private
data? Are the type signatures overly broad?"* — an overly broad prop type is a standing
invitation for a Server Component to pass the whole record
([topic 05](../05-what-crosses-the-boundary.md)).

## Gotchas

**Symptom:** "the endpoint name is obfuscated, so it is hard to attack."
**Cause:** action IDs raise the cost of *enumeration*, not of abuse — a legitimate page
hands the id to whoever loaded it.
**Fix:** authorize inside the function.

**Symptom:** an unused exported action is assumed to be harmless.
**Cause:** dead code elimination removes it only while nothing references it; the documented
default is reachable by direct POST.
**Fix:** design against the default, not the optimisation.

**Symptom:** a secret from `process.env` was never passed as a prop and still ended up in
the client payload.
**Cause:** it was closed over by a Server Function, and captured variables are sent to the
client and back.
**Fix:** read secrets inside the function body. Do not rely on the encryption.

**Symptom:** actions fail intermittently behind a load balancer after a deploy.
**Cause:** each self-hosted instance generated its own per-build encryption key.
**Fix:** set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a shared base64 key of 16, 24 or 32
decoded bytes.

**Symptom:** actions are rejected behind a reverse proxy.
**Cause:** the Origin header does not match Host / `X-Forwarded-Host`, so the request is
aborted.
**Fix:** `serverActions.allowedOrigins`.

**Symptom:** a mutation runs from a link or a prefetch.
**Cause:** it was performed during render, off a query parameter, so a GET triggered it.
**Fix:** move it into a Server Function — POST-only and origin-checked.

**Symptom:** tainting was enabled and a secret still reached the client.
**Cause:** the taint APIs are experimental, opt-in, and explicitly an additional layer.
**Fix:** filter and sanitize in the data access layer; treat taint as a backstop.

## Interview questions

**★ What does the framework do for you, and why is none of it a defence?**
Encrypted non-deterministic action IDs, rotated between builds and cached for at most 14
days; dead code elimination of unreferenced actions; POST-only invocation with an
Origin-versus-Host check for CSRF; and encryption of closed-over variables. The
documentation that describes them also says to still treat Server Actions as reachable via
direct POST and to verify authentication and authorization inside each one — so they raise
cost, they do not remove the obligation.

**★ What happens to a variable a Server Function closes over?**
It is **sent to the client and back to the server** when the action is invoked, because the
server does not hold the render's scope open. Next.js encrypts closed-over variables with a
key generated per action per build — and immediately recommends not relying on encryption
alone. So never close over a secret; read it inside the function body. `bind` arguments go
through the same channel.

**★ Why is a function `action` always POST, even with `method="get"`?**
Because a GET that mutates is the classic CSRF target. Server Actions are POST-only by
design, and the framework additionally compares Origin to Host and aborts on mismatch. It is
the security reason behind a caveat that looks like an arbitrary restriction in the forms
documentation.

**★ Are the taint APIs the answer to leaking secrets?**
They are a backstop, not the answer. They are experimental, opt-in per framework, and
described as *an additional layer* — the recommendation is still to filter and sanitize in
the data access layer. Note also that functions and classes are already blocked from being
passed to Client Components, so serialization catches structural mistakes; taint exists for
the serializable-but-secret case, such as a token string.

**Why do multi-instance deployments break Server Actions after a deploy?**
Because the encryption key for closed-over variables is generated per build, so each
self-hosted instance can hold a different one and actions only work for a specific build.
Setting a shared `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` fixes it. The symptom — intermittent
failures behind a load balancer — looks nothing like a key mismatch, which is why it is worth
recognising.

**How would you review a `'use server'` file?**
Exactly the checklist the docs give: are the arguments validated in the action or the data
access layer; is the user re-authorized inside the action; does it check ownership of the
resource and not just login; are return values filtered to what the client needs; is
database access delegated to a `server-only` layer. Then check the `'use client'` side for
props whose types are broader than the component actually needs.

---

← Prev: [Everything you write is an endpoint](01-everything-is-an-endpoint.md) ·
Index: [Server Function security](README.md) ·
Next → [Passing Server Components as `children`](../07-server-components-as-children.md)
