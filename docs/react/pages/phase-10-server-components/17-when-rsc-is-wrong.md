---
title: "When RSC is the wrong choice"
sidebar_label: "17 · When RSC is the wrong choice"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Server Components](https://react.dev/reference/rsc/server-components) (the build-time
> mode, the stability note, and what Server Components cannot do) and the two December 2025
> advisories. The trade-off judgements on this page are **arguments, not documented facts**,
> and are labelled as such.
> No sandbox script backs this page; claims are cited, not measured.

**Saying no is a valid outcome, and this topic exists because the honest version of a
technology page has to include it.** Everything below is built on facts established earlier
in the phase; the conclusions drawn from them are engineering judgement, and you should
disagree where your situation differs.

## The four cases where the answer is no

### 1. An app that is 95 % interactive

A dashboard where every panel filters, sorts, drags and updates live has almost nothing that
can stay in the server graph. Push `'use client'` down as far as you like
([topic 11](11-where-interactivity-goes.md)) and it still ends up near the root, because the
interactivity genuinely is near the root.

What you get for the trouble: a build that resolves modules twice
([topic 14](14-renderer-packages.md)), a serialization boundary to design around
([topic 05](05-what-crosses-the-boundary.md)), and a bundle that barely shrank.

⚠️ **Test it honestly before concluding this.** "Everything is interactive" is said far more
often than it is true — headers, navigation, tables of read-only data and empty states
usually are not. The test is whether the interactive leaves are *leaves*.

### 2. A working SPA with a working API

If the API exists, is used by other clients, and is not the bottleneck, RSC's headline
benefit — *"letting you access your data layer without having to build an API"* — is a
benefit you have already paid for. You would be adopting a new architecture to remove a layer
you still need for the mobile app ([topic 01](01-what-a-server-component-is/01-the-definition.md)).

Migration is not free either: every component becomes a question about which graph it belongs
in, and the answer is only obvious once the team knows this phase.

### 3. A team that cannot own a server

RSC's request-time mode needs a running server, and Server Functions are **public endpoints**
that need authorization, validation and rate limiting inside every one of them
([topic 06](06-server-function-security/README.md)). If nobody on the team owns
backend concerns, RSC hands them a backend anyway — one that looks like a function call.

⚠️ **The build-time mode is the exception, and it is a real one.** A blog, docs site or
marketing page can use Server Components with **no web server at all** and deploy static
files to a CDN. "We can't run a server" rules out request-time RSC, not RSC.

### 4. When the version-management cost is not acceptable

The bundler-facing APIs **explicitly do not follow semver** within 19.x, so a framework or
plugin integration can break on a minor. And December 2025 established that RSC has a
security surface that reaches apps which never wrote a Server Function
([topic 12](12-december-2025-advisories.md)).

That combination — pin, but watch, and upgrade the day an advisory lands — is a standing
commitment. It is a small one for a team with a release process and a real one for a project
maintained in someone's spare afternoon.

## Where the answer is clearly yes

The mirror image, so the topic is not one-sided:

- **Content-heavy pages** — docs, blogs, marketing, catalogues, anything with a lot of
  rendering and a little interaction. The 75K markdown example is exactly this shape.
- **Pages whose data lives in your own database** and whose components would otherwise
  waterfall through an API built only for them.
- **Anything with expensive render-time dependencies** — a markdown pipeline, a syntax
  highlighter, a date/locale library, a charting library that could render server-side.
- **Static builds** where the CI job is the "server".

## The questions to ask before adopting

1. **Which components genuinely need state?** If the answer is "most of the leaves", good.
   If it is "most of the tree", stop.
2. **Does the API exist for anyone but this app?** If yes, RSC removes nothing.
3. **Who owns the server** — its deploys, its errors, its dependency upgrades?
4. **Can you upgrade React within a day** when an advisory lands?
5. **Is the bundle actually your problem?** If the app is slow because of a render loop or an
   N+1 query, RSC will not fix it and will make it harder to see.

⚠️ **Question 5 is the one that catches teams.** RSC is a strong answer to "too much
JavaScript reaches the browser" and no answer at all to most other performance problems.

## Adopting partially is allowed

The choice is not binary, and the composition rules are what make it gradual
([topic 10](10-composition-rules.md)):

- Start with **the routes that are mostly content** and leave the interactive ones as they
  were.
- Keep the existing API and call it from Server Components; removing it can come later, or
  never.
- Use `'use client'` **high** at first — deliberately, as a migration state — and push it
  down once the boundaries are understood.

**A half-migrated RSC app is a normal state, not a failure.** The thing to avoid is a
half-*understood* one, where directives are placed by trial and error until the errors stop.

## Gotchas

**Symptom:** RSC adopted and the bundle barely moved.
**Cause:** the interactivity is genuinely near the root, so almost everything is in the
client graph anyway.
**Fix:** measure before adopting; this is case 1.

**Symptom:** the API was going to be deleted and it cannot be.
**Cause:** other clients depend on it. RSC removes the endpoint that existed only for your
own browser.
**Fix:** keep it; call it from Server Components if that is simpler.

**Symptom:** "we can't use RSC, we deploy static files."
**Cause:** assuming RSC requires a running server.
**Fix:** the build-time mode is documented — CI is the server, output goes to a CDN.

**Symptom:** a team adopts RSC and quietly ships unauthorized Server Functions.
**Cause:** they look like function calls, and nobody owned backend concerns.
**Fix:** the security topic is not optional reading; treat every Server Function as a route.

**Symptom:** adopted for performance, and performance did not improve.
**Cause:** the bottleneck was not bundle size.
**Fix:** find the actual bottleneck first.

**Symptom:** the migration stalls halfway and feels like failure.
**Cause:** partial adoption is a normal, supported state.
**Fix:** finish understanding the boundaries; the half-migrated app is fine.

## Interview questions

**★ When would you argue against RSC?**
Four cases. An app that is genuinely interactive nearly everywhere, where the client boundary
ends up at the root anyway. An existing SPA with an API that other clients also use, so the
headline benefit is already paid for. A team with nobody to own a server, given that Server
Functions are public endpoints needing authorization inside each one. And a project that
cannot commit to version management, since the bundler-facing APIs do not follow semver and
the December 2025 advisories reached apps that wrote no Server Functions.

**★ Which of those objections is usually wrong?**
"We deploy static files." Server Components can run at build time — react.dev says a web
server *"is not required"* — with the output server-rendered to HTML and put on a CDN. The
CI job is the server. Also frequently wrong: "everything is interactive", which is worth
testing rather than asserting.

**★ What problems does RSC not solve?**
Anything that is not "too much JavaScript reaches the browser". A render loop, an N+1 query,
a slow database, an unindexed table — RSC addresses none of them and can make them harder to
observe, because the work moved somewhere you were not watching.

**Is it all-or-nothing?**
No, and the composition rules are what make partial adoption work. Convert the content-heavy
routes first, keep the existing API and call it from Server Components, and start with the
client boundary deliberately high, pushing it down as the boundaries become clear. A
half-migrated app is a normal state; a half-understood one, where directives are placed until
the errors stop, is the actual failure mode.

**What would you ask a team that wants to adopt RSC?**
Which components genuinely need state; whether the API has other consumers; who owns the
server; whether they can upgrade React within a day of an advisory; and whether bundle size
is actually the problem they have. The last one is the one that most often ends the
conversation.

---

← Prev: [Next.js App Router vs React Router](16-nextjs-vs-react-router.md) ·
Index: [Phase 10](README.md) ·
Next → [Server Components without a framework](18-without-a-framework.md)
