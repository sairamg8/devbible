---
title: "The proxy path-matching rules changed when the dev server changed — under webpack `/api` matched every sub-path, under Vite it matches only `/api`, and a config file that worked for years starts proxying exactly one URL"
sidebar_label: "06j · Proxying to a backend"
sidebar_position: 6.9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the proxy configuration shape, the
> `angular.json` wiring, the restart note and the two builders' path-matching rules are quoted
> verbatim from [angular.dev/tools/cli/serve](https://angular.dev/tools/cli/serve); the
> `proxyConfig` description and the fact that it is one of only three Vite passthroughs from
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This is the single most under-advertised breaking change in the move off webpack, and it is not in
the migration guide's list — it is on the serve page.** A `proxy.conf.json` keyed `"/api"` proxied
`/api` *and every path beneath it* under the webpack dev server. Under `@angular/build:dev-server`
the same key matches exactly `/api` and nothing else, so `/api/users` falls through to the Angular
app, gets the SPA fallback, and your HTTP client receives HTML where it expected JSON. Nothing
errors. The fix is one character.

## The option and the file

> `proxyConfig` — *"Proxy configuration file. For more information, see
> https://angular.dev/tools/cli/serve#proxying-to-a-backend-server."*

The file, verbatim from angular.dev:

```json
{
  "/api/**": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```

and the wiring, also verbatim:

```json
{
  "projects": {
    "my-app": {
      "architect": {
        "serve": {
          "builder": "@angular/build:dev-server",
          "options": {
            "proxyConfig": "src/proxy.conf.json"
          }
        }
      }
    }
  }
}
```

⚠️ That fragment uses `architect` rather than `targets` — angular.dev's own illustrative snippet
does, and both key names are accepted. Your generated file will say `targets`. Which one wins when
both are present is topic 06's problem, and the short answer is: do not have both.

## 🔴 The path-matching rules, and the trap

angular.dev spells out the difference between the two dev servers, verbatim:

> ***`@angular/build:dev-server`** (based on [Vite](https://vite.dev/config/server-options#server-proxy))*
> *- `/api` matches only `/api`.*
> *- `/api/*` matches `/api/users` but not `/api/users/123`.*
> *- `/api/**` matches `/api/users` and `/api/users/123`.*
>
> ***`@angular-devkit/build-angular:dev-server`** (based on [Webpack DevServer](https://webpack.js.org/configuration/dev-server/#devserverproxy))*
> *- `/api` matches `/api` and any sub-paths (equivalent to `/api/**`)."*

Put the two side by side and the migration hazard is obvious:

| Key | Webpack dev server | Vite dev server |
|---|---|---|
| `/api` | `/api` **and all sub-paths** | `/api` only |
| `/api/*` | (prefix match) | one segment: `/api/users`, not `/api/users/123` |
| `/api/**` | (prefix match) | `/api/users` **and** `/api/users/123` |

**The old default behaviour is now spelled `/api/**`.** A configuration written for the webpack dev
server keeps working for whichever single URL it names and silently stops working for everything
below it. Because the dev server serves the Angular application for unmatched paths, the failing
request usually returns `index.html` with a 200 status — so client code sees a successful response
whose body is HTML, and the error surfaces as a JSON parse failure or an unexpected shape rather
than a 404.

```json
{
  "/api/**": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```

That is the migration of a `"/api"` key: add `/**`.

## The config is read at startup

> *"NOTE: To apply changes made to your proxy configuration file, you must restart the `ng serve`
> process."*
> — [angular.dev/tools/cli/serve](https://angular.dev/tools/cli/serve)

The proxy table is not part of the watched build inputs. Editing `proxy.conf.json` while the server
runs changes nothing, and there is no message saying so — you edit, retry, see the same behaviour,
and conclude the syntax is wrong.

## `secure`

The example sets `"secure": false`. That is the switch for a target whose TLS certificate the proxy
would otherwise reject — the usual case being a backend on HTTPS with a self-signed or internal
certificate. It is a development convenience and belongs nowhere near a deployment; the dev server
is not what serves your application in production.

If your dev server is itself on HTTPS, the proxy target does not have to be — but a plain-HTTP
target loaded into an HTTPS page has consequences for secure contexts, which is
[06i](06i-https-on-the-dev-server.md).

## Why the option is not more configurable than this

`proxyConfig` is one of only three places the dev server exposes a Vite setting, and the semantics
above are Vite's `server.proxy`, not Angular's. angular.dev links Vite's page from the rule list
itself, which is the strongest available signal about where to look when a matching question is not
answered here. Angular's contribution is the *file* — a path to JSON, resolved once at startup, in
place of an inline configuration object.

## Gotchas

**★ Symptom: after migrating off the webpack dev server, `/api` proxies and `/api/users` 404s or
returns HTML.** Cause: path-matching changed with the builder — *"`/api` matches only `/api`"* under
the Vite-based dev server, whereas the webpack one treated it as a prefix. Fix: spell the old
behaviour explicitly:

```json
{
  "/api/**": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```

**★ Symptom: an HTTP client throws a JSON parse error on a request that returned 200.** Cause: the
path did not match the proxy, so the dev server served the Angular application instead — a
successful response whose body is `index.html`. Fix: the same one character. Diagnose it by looking
at the response body rather than the status, because the status will not tell you.

**★ Symptom: edits to `proxy.conf.json` have no effect.** Cause: the file is read once at startup —
*"To apply changes made to your proxy configuration file, you must restart the `ng serve`
process."* Fix: restart the process; there is no watch on this file and no warning that you are
looking at a stale table.

**★ Symptom: `/api/*` does not match `/api/users/123`.** Cause: a single `*` matches one path
segment; `**` matches any depth. This is the rule that differs most from what people assume, because
in many other tools `*` is greedy across separators. Fix: use `**` when the path has variable depth:

```json
{
  "/api/*": { "target": "http://localhost:3000" },
  "/api/**": { "target": "http://localhost:3000" }
}
```

**Symptom: a proxied HTTPS backend fails with a certificate error.** Cause: the proxy validates the
target's certificate by default, and internal or self-signed certificates fail that check. Fix: the
documented development switch:

```json
{
  "/api/**": {
    "target": "https://internal.example.test",
    "secure": false
  }
}
```

**Symptom: the proxy works locally and the same paths 404 after deployment.** Cause: the proxy is a
dev-server feature and does not exist in a build artefact — nothing in `dist/` knows about
`proxy.conf.json`. Fix: reproduce the routing in whatever fronts the deployment (a reverse proxy, an
ingress rule, the SSR server), and treat the dev proxy purely as a local convenience.

**Symptom: a tutorial's `angular.json` proxy snippet does not match your file — it says `architect`
and yours says `targets`.** Cause: both key names are accepted for the target map and angular.dev's
own proxy example uses the older one. Fix: read whichever key your file has, and keep exactly one.

**Symptom: two proxy keys overlap and the wrong one wins.** Cause: the matching rules above decide
which entry applies, and a `/api/**` alongside a narrower `/api/users` is genuinely ambiguous to
reason about from Angular's documentation alone — the resolution belongs to Vite's `server.proxy`.
Fix: avoid overlapping keys rather than relying on precedence; if you need different targets for
different sub-paths, make the keys disjoint.

## Interview questions

**★ A team migrated off the webpack dev server and their API calls broke in a way that returns 200.
What happened?**
Their `proxy.conf.json` was keyed `"/api"`. Under `@angular-devkit/build-angular:dev-server` that
matched `/api` *and every sub-path* — angular.dev describes it as *"equivalent to `/api/**`"*. Under
`@angular/build:dev-server`, which is Vite-based, *"`/api` matches only `/api`"*. So every real
endpoint below that prefix stopped being proxied, fell through to the SPA fallback, and returned
`index.html` with a 200 status — which is why the failure surfaces as a JSON parse error rather than
a 404. The fix is to write `"/api/**"`. The reason this catches teams is that it is not in the
migration guide's list of changes; it is on the serve documentation page.

**★ What is the difference between `/api/*` and `/api/**` in an Angular proxy configuration?**
One asterisk matches a single path segment and two match any depth: *"`/api/*` matches `/api/users`
but not `/api/users/123`"*, while *"`/api/**` matches `/api/users` and `/api/users/123`"*. This
trips people up because several other tools treat a single `*` as greedy across separators. For a
REST API with nested resources you almost always want `**`; `*` is useful when you deliberately want
to proxy one level and let deeper paths reach the application.

**★ You edited `proxy.conf.json` and nothing changed. Why?**
Because the file is read once, when the dev server starts. angular.dev states it directly: *"To
apply changes made to your proxy configuration file, you must restart the `ng serve` process."* It
is not one of the watched build inputs, and nothing logs a warning that the running table is stale.
This is worth knowing as a habit rather than a fact — the reflex to reach for a restart after
touching that one file saves the ten minutes otherwise spent doubting the syntax.

**Why does `"secure": false` exist, and when is it the right answer?**
It disables certificate validation for the proxy's connection to the target, which is what you need
when a local or internal backend serves HTTPS with a self-signed or privately-issued certificate.
angular.dev's own example includes it. It is a development-only convenience and has no equivalent in
a deployment, because the dev server does not exist there — the routing that replaces it lives in a
reverse proxy, an ingress rule or your SSR server, and those have their own trust configuration.

**How much of the proxy's behaviour is Angular's, and how much is Vite's?**
Almost all of the behaviour is Vite's. `proxyConfig` is one of only three Vite passthroughs the dev
server exposes; Angular contributes the *file* — a JSON path resolved once at startup — and the
matching semantics, precedence between overlapping keys, and the full option set of an entry belong
to Vite's `server.proxy`. angular.dev acknowledges this by linking Vite's documentation from the
rule list itself. Practically, that means when a proxy question is not answered by the Angular page,
the correct next source is Vite's, not a deeper reading of Angular's.

{/* FOOTER */}
