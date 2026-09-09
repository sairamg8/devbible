---
title: "Three options turn the dev server into an HTTPS server, and the reason to bother is that half a dozen browser APIs are gated on a secure context — but what happens when you enable `ssl` without supplying a certificate is something the schema does not state and this page will not invent"
sidebar_label: "06i · HTTPS on the dev server"
sidebar_position: 6.8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — option descriptions and defaults quoted from
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`; the `@vitejs/plugin-basic-ssl` **2.3.0** runtime dependency read from the
> published manifest of `@angular/build` 22.1.7
> (`https://registry.npmjs.org/@angular/build/22.1.7`).
> ⚠️ **One claim on this page is explicitly unresolved**: what `ssl: true` uses when no `sslKey` and
> `sslCert` are supplied. Documentation-validated; **no sandbox run** — no certificate was generated
> or served to produce this page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Running the dev server over plain HTTP means developing against a smaller set of browser
capabilities than production has.** Service workers, `SharedArrayBuffer` under cross-origin
isolation, and parts of the media and geolocation APIs are all gated on a secure context, so a
feature that depends on one of them either cannot be exercised locally at all or behaves differently
enough to be misleading. Three options close that gap, and they are as simple as they look — the
only genuinely uncertain part is what happens if you turn on `ssl` and supply nothing else.

## The three options

> `ssl` — *"Serve using HTTPS."* Default `false`.
>
> `sslKey` — *"SSL key to use for serving HTTPS."*
>
> `sslCert` — *"SSL certificate to use for serving HTTPS."*

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "ssl": true,
    "sslKey": "ssl/localhost-key.pem",
    "sslCert": "ssl/localhost.pem"
  },
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" }
  },
  "defaultConfiguration": "development"
}
```

Note what the schema does **not** declare: it does not make `sslKey` and `sslCert` required when
`ssl` is `true`, and it does not make them require each other. All three are independent properties,
so a half-configured pair passes validation.

## ⚠️ What `ssl: true` alone does was not confirmed

The schema says *"Serve using HTTPS"* and stops. There is no statement anywhere in the option
descriptions about a fallback certificate.

The one hard piece of evidence available is the dependency list: `@angular/build` 22.1.7 declares a
runtime dependency on **`@vitejs/plugin-basic-ssl` 2.3.0**, a package whose entire purpose is
producing a self-signed certificate for a dev server. That makes a self-signed fallback the obvious
reading — but a dependency is not a specification, the plugin could be wired to some other
condition, and **the behaviour was not confirmed**. This page therefore states the evidence and
declines to state the conclusion.

The practical consequence is the same either way: if you want a certificate your browser accepts
without an interstitial, supply one explicitly. That path is unambiguous and does not depend on
anything unspecified.

## The certificate has to match the name you browse to

This is ordinary TLS rather than anything Angular-specific, but it is where local HTTPS setups
usually go wrong: a certificate is issued for a set of names, and the browser checks the name in the
URL against them. A certificate generated for `localhost` will produce a name-mismatch warning when
you reach the same server at `127.0.0.1`, at a LAN address, or at a hostname you added to your
`hosts` file.

So HTTPS interacts with the host binding in a way worth planning for in one step rather than two:
decide the name you will browse to, generate a certificate for that name, and bind a host that the
name resolves to. Host binding itself is [06h](06h-host-binding-and-allowedhosts.md).

## HTTPS locally says nothing about production TLS

The dev server's certificate, protocol versions and cipher configuration have no relationship to
whatever terminates TLS in front of your deployment. Enabling `ssl` here buys you one thing — a
**secure context** in the browser, so that secure-context-gated APIs are available and behave as
they will in production. It is not a test of your certificate chain, your HSTS policy, your renewal
process, or your load balancer. Treat it as a capability switch, not as a rehearsal.

## Gotchas

**★ Symptom: a service worker, `SharedArrayBuffer` or another secure-context API works in production
and not under `ng serve`.** Cause: the dev server is plain HTTP by default, and those APIs require a
secure context. Fix: turn on HTTPS locally with a certificate you control:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "ssl": true,
    "sslKey": "ssl/localhost-key.pem",
    "sslCert": "ssl/localhost.pem"
  }
}
```

**★ Symptom: `ssl: true` produces a certificate the browser refuses to trust.** Cause: without a
supplied `sslKey`/`sslCert` you are not using a certificate from an authority your machine trusts.
The schema does not state what is used instead, and it could not be confirmed — the only hard evidence
is that `@angular/build` depends on `@vitejs/plugin-basic-ssl` 2.3.0. Fix: stop depending on
unspecified behaviour and supply a certificate your machine trusts:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "ssl": true, "sslKey": "ssl/localhost-key.pem", "sslCert": "ssl/localhost.pem" }
}
```

**★ Symptom: the certificate is trusted but the browser still warns about the name.** Cause: the
certificate was issued for a name you are not browsing to — generated for `localhost`, reached at
`127.0.0.1` or a LAN address. Fix: generate the certificate for the exact name you will use, and
bind a host that resolves to it:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "ssl": true,
    "host": "dev.localhost",
    "sslKey": "ssl/dev.localhost-key.pem",
    "sslCert": "ssl/dev.localhost.pem"
  }
}
```

**Symptom: `sslKey` is set, `sslCert` is not, and HTTPS does not behave as expected.** Cause: they
are two independent string options with no schema-level requirement that they appear together, so a
half-configured pair passes validation and fails later. Fix: always set both, and treat one without
the other as a configuration error even though the CLI does not:

```json
"options": {
  "ssl": true,
  "sslKey": "ssl/localhost-key.pem",
  "sslCert": "ssl/localhost.pem"
}
```

**Symptom: a private key ends up in version control.** Cause: `sslKey` takes a path, so the natural
thing is to drop the file next to the code. Fix: keep the pair out of the repository and generate it
per machine — the paths in `angular.json` are shared, the files behind them should not be:

```bash
echo "ssl/" >> .gitignore
```

**Symptom: the app is served over HTTPS and the proxied backend calls fail.** Cause: a proxy target
on plain HTTP, or an HTTPS target with a self-signed certificate the proxy will not accept. Fix: the
proxy configuration has its own switch for the second case, `"secure": false` — see
[06j](06j-proxying-to-a-backend.md).

**Symptom: enabling `ssl` did not make an insecure-context warning go away.** Cause: a secure context
is decided by the origin the *page* is loaded from, so a page loaded over HTTPS that pulls a script
or worker over HTTP is still not in the state you wanted. Fix: check that every request the page
makes is over the secure origin, including the proxied ones, before concluding the option did not
work.

## Interview questions

**★ Why would you enable HTTPS on a development server at all?**
Because several browser capabilities are gated on a secure context — service workers,
`SharedArrayBuffer` in combination with cross-origin isolation headers, parts of the media and
geolocation APIs. Without HTTPS locally you are developing against a different capability set from
the one production has, so a feature can appear to work everywhere except where it matters, or can
only be exercised after deployment. `ssl`, `sslKey` and `sslCert` exist to close that gap. What it
does not buy you is any confidence about production TLS: the dev server's certificate and protocol
configuration have nothing to do with whatever terminates TLS in front of your deployment.

**★ What happens if you set `ssl: true` and supply no certificate?**
The honest answer is that the schema does not say, and it could not be confirmed. What is verifiable is
that `@angular/build` 22.1.7 declares a runtime dependency on `@vitejs/plugin-basic-ssl` 2.3.0, a
package that exists to generate a self-signed certificate for a dev server — which makes a
self-signed fallback the obvious reading, but a dependency is evidence of capability rather than a
specification of behaviour. This is worth answering carefully rather than confidently, because the
practical advice does not depend on resolving it: if you need a certificate the browser accepts
without an interstitial, supply one with `sslKey` and `sslCert`, which is unambiguous.

**★ Why does the schema not require `sslKey` and `sslCert` together, or require them when `ssl` is
on?** It simply declares three independent properties, so nothing enforces the relationship even
though the dev-server schema is otherwise strict — `additionalProperties: false` catches keys that
should not be there and says nothing about keys that should be there together. The lesson
generalises: a closed schema constrains the *shape* of your configuration, not its coherence.
Treating a lone `sslKey` as a configuration error is a team convention you have to hold yourself,
because validation will not.

**Someone enabled HTTPS locally and the secure-context warning did not go away. What do you check?**
Whether every request the page makes uses the secure origin. A secure context is a property of the
document's origin, so an HTTPS page that loads a script, worker or stylesheet over plain HTTP does
not get you where you wanted — and in an Angular dev setup the usual culprit is a proxied API target
on `http://`. Check the proxy configuration as well as the serve options, and remember that the
browser's own console is the fastest way to see which request downgraded.

{/* FOOTER */}
