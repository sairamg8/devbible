---
title: "The dev server binds `localhost` and warns the moment you move it — the warning is not boilerplate, it names a real websocket failure, and the `allowedHosts` option that gates requests is Vite's, not Angular's"
sidebar_label: "06h · Host binding and allowedHosts"
sidebar_position: 6.7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the host check and its warning text are
> quoted verbatim from
> [`packages/angular/build/src/builders/dev-server/builder.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/builder.ts)
> at tag `v22.1.7`; option descriptions and defaults from
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json);
> the `@vitejs/plugin-basic-ssl` **2.3.0** dependency from the published manifest of
> `@angular/build` 22.1.7 (`https://registry.npmjs.org/@angular/build/22.1.7`); the `@angular/ssr`
> host-validation change from the `22.0.0 (2026-06-03)` Breaking Changes section of
> [`CHANGELOG.md`](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md).
> ⚠️ **The behaviour of Vite's own `server.allowedHosts` was not fetched** — this page states what
> the Angular option is and points at the source the schema itself names.
> Documentation-validated against source; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Three options control who can reach the dev server, and all three are easy to get half-right.**
`host` defaults to `localhost`, so the server is unreachable from a phone, a VM or a sibling
container until you change it — and the moment you change it the builder prints a warning that
people skim, even though its last sentence describes a real, specific failure they are about to
hit. `allowedHosts` is a Vite passthrough whose semantics belong to Vite. And `ssl` turns on HTTPS
without, in the schema, saying what happens if you do not supply a certificate.

## `host` and the warning that is not boilerplate

> `host` — *"Host to listen on."* Default `"localhost"`.

The builder tests the resolved host and warns for anything outside a small allow-list. Verbatim from
`dev-server/builder.ts` at `v22.1.7`:

```ts
if (
  !/^127\.\d+\.\d+\.\d+/g.test(normalizedOptions.host) &&
  normalizedOptions.host !== '::1' &&
  normalizedOptions.host !== 'localhost'
) {
  context.logger.warn(`
Warning: This is a simple server for use in testing or debugging Angular applications
locally. It hasn't been reviewed for security issues.

Binding this server to an open connection can result in compromising your application or
computer. Using a different host than the one passed to the "--host" flag might result in
websocket connection issues.
  `);
}
```

The condition is precise and worth reading rather than summarising:

| Host | Warns? | Why |
|---|---|---|
| `localhost` | no | explicit exception |
| `::1` | no | explicit exception |
| `127.0.0.1`, `127.0.1.1` | no | matches `/^127\.\d+\.\d+\.\d+/` |
| `0.0.0.0` | **yes** | binds every interface |
| a LAN address such as `192.168.1.20` | **yes** | not loopback |
| a hostname such as `dev.internal` | **yes** | not loopback |

**The first two sentences are the security warning.** *"This is a simple server for use in testing
or debugging Angular applications locally. It hasn't been reviewed for security issues."* That is a
statement about the software, not about your network — the dev server is not a hardened HTTP server
and was never meant to face one.

🔴 **The third sentence is an operational bug report, and it is the one people skip.** *"Using a
different host than the one passed to the `--host` flag might result in websocket connection
issues."* The dev server's live-reload and HMR channel is a websocket. If you bind `0.0.0.0` and
then browse to `http://192.168.1.20:4200`, the host you *reached* is not the host that was
*passed*, and the websocket is what breaks — the page loads, and then nothing ever updates. The
symptom looks like "HMR is broken"; the cause is the address you typed.

```bash
# Reachable from other devices, and the address you browse to is the address you passed.
ng serve --host 192.168.1.20
```

## `allowedHosts` is Vite's option, and its description says so

> `allowedHosts` — *"The hosts that the development server will respond to. This option sets the
> Vite option of the same name. For further details:
> https://vite.dev/config/server-options.html#server-allowedhosts"* Default `[]`.

Two facts, and one deliberate silence.

**It is a passthrough.** Angular declares the option, validates it as an array, and hands it to
Vite. That is one of only three places the dev server exposes a Vite setting at all.

**Its default is the empty array.** That is what the Angular schema declares.

⚠️ **What Vite does with an empty list, and what its matching rules are, is Vite's documentation to
state — and it was not fetched.** The schema points you at
[vite.dev's `server.allowedHosts`](https://vite.dev/config/server-options.html#server-allowedhosts)
for exactly that reason. If the dev server is refusing requests based on their `Host` header, this
is the option that governs it; read Vite's page for the semantics rather than inferring them from
Angular's one-line description.

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "host": "0.0.0.0",
    "allowedHosts": ["dev.internal", "my-app.localhost"]
  }
}
```

## 🔴 The other `allowedHosts` — `@angular/ssr`, and it now returns 400

There is a second, unrelated host-validation mechanism in the Angular ecosystem, and v22.0.0 changed
its failure mode. From the same Breaking Changes block:

> *"The server no longer falls back to Client-Side Rendering (CSR) when a request fails host
> validation. Requests with unrecognized 'Host' headers will now return a 400 Bad Request status
> code. Users must ensure all valid hosts are correctly configured in the 'allowedHosts' option."*
> — CLI `CHANGELOG.md`, `22.0.0 (2026-06-03)`, `@angular/ssr`

**This is about `@angular/ssr` — the production server — not about `ng serve`.** Before v22 a
request with an unknown `Host` degraded to client-side rendering and mostly worked; now it is
rejected outright. The two mechanisms share a name and nothing else: one is a dev-server option
passed to Vite, the other is server-side rendering behaviour in a deployed application behind a
proxy or load balancer that rewrites `Host`.

Confusing them costs real time in both directions — configuring the dev server will not fix a 400
from a deployed SSR app, and configuring the SSR app will not make `ng serve` answer your phone.

## Reaching it over HTTPS is a separate concern

`ssl`, `sslKey` and `sslCert` are the remaining three socket options, and they answer a different
question from *who can connect* — they answer *what the connection is*. They have their own page:
[06i](06i-https-on-the-dev-server.md).

## Gotchas

**★ Symptom: a multi-line security warning on every `ng serve --host 0.0.0.0`.** Cause: the host is
neither `localhost`, nor `::1`, nor a `127.x.x.x` address, so the builder's check fires. Fix: it is
a warning, not an error — but read the last sentence before dismissing it, because it predicts a
websocket failure. If you only need one other device to reach the server, bind the specific address
rather than every interface:

```bash
ng serve --host 192.168.1.20
```

**★ Symptom: the dev server is unreachable from a phone, a VM or another container.** Cause: `host`
defaults to `localhost`, so the socket is bound to loopback and nothing outside the machine or the
container's network namespace can connect. Fix: bind an address the other side can route to:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "host": "0.0.0.0" }
}
```

**★ Symptom: the page loads over the network but never live-reloads, and HMR appears dead.** Cause:
exactly what the warning says — *"Using a different host than the one passed to the `--host` flag
might result in websocket connection issues."* You bound `0.0.0.0` and browsed to a concrete
address, so the websocket's expected host and the one in use differ. Fix: pass the address you will
actually browse to:

```bash
ng serve --host 192.168.1.20
```

**★ Symptom: a deployed SSR app returns 400 Bad Request behind a proxy, and it used to render.**
Cause: the v22.0.0 `@angular/ssr` change — *"The server no longer falls back to Client-Side
Rendering (CSR) when a request fails host validation. Requests with unrecognized 'Host' headers will
now return a 400 Bad Request status code."* Fix: configure the SSR application's `allowedHosts` with
every host the proxy will present. 🔴 Do **not** change the dev server's `allowedHosts`; it is a
different mechanism in a different package and will not affect a deployment.

**★ Symptom: the dev server refuses requests that arrive under a hostname rather than an IP.**
Cause: host validation, governed by `allowedHosts` — *"The hosts that the development server will
respond to. This option sets the Vite option of the same name."* Fix: list the hostnames you use,
and read Vite's own page for the matching rules, which the Angular schema deliberately delegates to:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "host": "0.0.0.0",
    "allowedHosts": ["dev.internal"]
  }
}
```

**Symptom: `--host 127.0.0.1` produces no warning but `--host 0.0.0.0` does, and you assumed they
were equivalent.** Cause: they are not — the regex `/^127\.\d+\.\d+\.\d+/` matches loopback and
nothing else, while `0.0.0.0` binds every interface on the machine. Fix: this is the check doing its
job. Use loopback when only the local machine needs access, and be deliberate when you widen it.

## Interview questions

**★ The dev server prints a security warning when you change `--host`. Is it safe to ignore?**
The first half is a statement about the software: *"This is a simple server for use in testing or
debugging Angular applications locally. It hasn't been reviewed for security issues."* On a trusted
network, for a short session, most teams accept that. The half that should never be ignored is the
last sentence — *"Using a different host than the one passed to the `--host` flag might result in
websocket connection issues"* — because it is not a security note at all, it is a prediction. The
live-reload and HMR channel is a websocket, and binding `0.0.0.0` while browsing a concrete address
is exactly the mismatch it describes. The result is a page that loads and then never updates, which
people spend an afternoon blaming on HMR.

**★ Which hosts avoid the warning, and what does that tell you about the check?**
`localhost`, `::1`, and anything matching `/^127\.\d+\.\d+\.\d+/` — that is, loopback in all three
of its usual spellings. Everything else warns, including a specific LAN address and a hostname. The
check is therefore about *reachability*, not about a list of dangerous values: the question it asks
is "can something other than this machine connect", and the answer for loopback is no. Knowing the
exact predicate is useful because it tells you that `127.0.0.1` and `0.0.0.0` are not
interchangeable, which is a mistake people make when a container's port mapping needs the latter.

**★ There are two `allowedHosts` in the Angular ecosystem. What is the difference?**
One is a dev-server option that Angular passes straight to Vite — its description says so, and it
links to Vite's documentation for the semantics. The other belongs to `@angular/ssr`, the production
server-rendering package, and v22.0.0 changed its failure mode: *"The server no longer falls back to
Client-Side Rendering (CSR) when a request fails host validation. Requests with unrecognized 'Host'
headers will now return a 400 Bad Request status code."* They share a name and nothing else.
Confusing them wastes time in both directions — editing `angular.json`'s serve target will never fix
a 400 from a deployed SSR app behind a proxy that rewrites `Host`.

**Someone reports "the dev server works for me and not for my colleague on the same network." What
do you check?**
The `host` value first: `localhost` binds loopback, so nobody outside the machine can reach it
regardless of the port. Then the address they are using versus the address that was passed, because
that mismatch is what the builder's own warning predicts will break the websocket — a page that
loads but never reloads is that failure, not a networking problem. Then `allowedHosts`, if they are
reaching the server by hostname rather than IP and the server is refusing based on `Host`. Those
three cover almost every variant of the report, and they are all readable from the serve target plus
the URL your colleague typed.

{/* FOOTER */}
