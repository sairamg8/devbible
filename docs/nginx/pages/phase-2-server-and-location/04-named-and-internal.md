---
title: "Named locations, internal and nesting"
sidebar_label: "04 · Named locations and internal"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (`location @name`, `internal`, `try_files`, `error_page`) and
> [njs reference](https://nginx.org/en/docs/njs/reference.html), which states that
> *"In a new location, all request processing is repeated starting from
> `NGX_HTTP_SERVER_REWRITE_PHASE` for ordinary locations and from
> `NGX_HTTP_REWRITE_PHASE` for named locations."*
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Two kinds of location that the matching algorithm on
[page 03](03-location-matching/README.md) never selects: named locations, which
have no URI at all, and `internal` ones, which refuse to be reached from outside.
Both exist so that a request can be *sent* somewhere rather than *routed* there.**

## Named locations — `@name`

```text
location @name { ... }
```

Documented as *"not used for a regular request processing"* but *"instead used for
request redirection"*. A named location:

- **is never matched against a URI** — the algorithm skips it entirely;
- **cannot be nested**, and cannot contain nested locations;
- is reachable only from `try_files`, `error_page` or `rewrite … last`.

```nginx
location / {
    try_files $uri $uri/ @app;      # nothing on disk? hand it to the named location
}

location @app {
    proxy_pass http://backend;
    proxy_set_header Host $host;
}
```

Read `@app` as **a label, not a path**. `try_files` walks its list, finds no file
and no directory, and jumps to the label.

### Why not just use `location /` with `proxy_pass`?

Because `try_files` needs somewhere to send the request that is *not itself*.
Writing `try_files $uri $uri/ /index.html;` sends it to a URI, which re-enters
matching and can loop. A named location is a destination that cannot be reached
any other way, so there is nothing to loop with.

### The phase difference, and why it matters

The documented sentence is worth reading twice:

> *"In a new location, all request processing is repeated starting from
> `NGX_HTTP_SERVER_REWRITE_PHASE` for **ordinary** locations and from
> `NGX_HTTP_REWRITE_PHASE` for **named** locations."*

An internal redirect to an ordinary URI restarts **earlier** — server-level
rewrites run again. A jump to a named location restarts **later**, skipping the
server-rewrite stage. That is the mechanical reason named locations are the safe
target for a fallback: less of the pipeline re-runs, so there is less to loop on.

## `internal` — reachable only from inside

```text
Syntax:  internal;
Context: location
```

*"Specifies that a given location can only be used for internal requests"* —
those arising from `error_page`, `index`, `random_index`, `try_files`, `rewrite`,
or `X-Accel-Redirect`. *"External requests return a 404 error."*

```nginx
location /protected-files/ {
    internal;                        # a browser asking directly gets 404
    alias /srv/private/;
}

location /download/ {
    proxy_pass http://app;           # Node decides whether this user may have it
}
```

### `X-Accel-Redirect` — authorise in Node, send bytes in nginx

This is the pattern `internal` exists for, and it is genuinely useful in a MERN or
PERN stack:

```js
// Express — checks permission, then hands the file back to nginx
app.get('/download/:id', requireAuth, async (req, res) => {
  const file = await files.findById(req.params.id);
  if (!file || file.ownerId !== req.user.id) return res.sendStatus(404);

  res.set('X-Accel-Redirect', `/protected-files/${file.storageKey}`);
  res.set('Content-Disposition', `attachment; filename="${file.name}"`);
  res.end();                          // no body — nginx supplies it
});
```

Node does the authorisation and returns an empty response with a header. nginx
sees `X-Accel-Redirect`, issues an internal redirect to `/protected-files/…`, and
streams the file itself.

**What this buys you:** a 2 GB download does not occupy a Node handler or pass
through the event loop, and the real path is never exposed. **What `internal`
buys you:** a user who guesses `/protected-files/anything` gets a 404 rather than
the file — the authorisation cannot be bypassed by URL.

Without `internal`, that whole scheme is a public file server with extra steps.

### `auth_request` — the same idea for authorisation decisions

```nginx
location /private/ {
    auth_request /_auth;             # subrequest; 2xx allows, 401/403 denies
    proxy_pass http://app;
}

location = /_auth {
    internal;                        # never reachable from outside
    proxy_pass http://app/verify;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
}
```

Phase 9 covers `auth_request` properly. The point here is the shape: the
subrequest target is `internal`, because it is an implementation detail of the
gateway and not an endpoint anyone should call.

## Nested locations

```nginx
location /api/ {
    proxy_pass http://app;
    proxy_read_timeout 30s;

    location /api/uploads/ {
        client_max_body_size 100m;
        proxy_read_timeout   300s;
        proxy_pass http://app;        # repeated — not inherited
    }
}
```

The matching algorithm runs again inside the chosen parent, with the same rules.
Nesting expresses **"this is a special case of that"** and inherits the parent's
directives — subject to
[Phase 1's replace rule](../phase-1-configuration-language/02-inheritance.md),
which is why `proxy_pass` appears twice.

**Nest only when the child genuinely is a variation of the parent.** Two top-level
prefixes behave identically, because prefix matching cares about string length,
not about structure:

```nginx
# behaves the same as the nested version, and reads more plainly
location /api/uploads/ { client_max_body_size 100m; proxy_read_timeout 300s; proxy_pass http://app; }
location /api/         { proxy_read_timeout 30s;    proxy_pass http://app; }
```

The case for nesting is when the shared directive list is long and duplicating it
would be worse than the indentation. The case against is that inheritance inside a
nest is subject to the replace rule, so "it inherits the parent" is true only for
directives the child does not touch.

One hard rule: **a named location cannot be nested**, and cannot contain nested
locations. `location @app { location /x { … } }` is invalid.

## Gotchas

**Symptom:** `nginx: [emerg] location "@app" cannot be inside the named location`.
**Cause:** A nested location inside `@name`, which is not allowed.
**Fix:** Flatten it. Named locations are single destinations by design.

**Symptom:** A `try_files … @fallback;` produces
`rewrite or internal redirection cycle`.
**Cause:** The named location sends the request back to something that reaches
`try_files` again — usually a `rewrite` inside it, or a `proxy_pass` back to
nginx itself.
**Fix:** A named location should terminate: proxy to a backend, return a status,
or serve a file. It should not re-enter matching.

**Symptom:** Users can download protected files by guessing the internal path.
**Cause:** The `X-Accel-Redirect` target location has no `internal;`.
**Fix:** Add it. Without `internal`, the entire authorisation scheme is
decorative.

**Symptom:** `X-Accel-Redirect` reaches the browser as a header instead of
triggering a download.
**Cause:** nginx is not consuming it — a proxy in between stripped it, or the
response did not go through `proxy_pass`, or the header name is wrong.
**Fix:** Confirm the response passes through nginx's proxy module, and check that
the target path matches a location. nginx removes the header when it acts on it,
so seeing it in the browser means it was never processed.

**Symptom:** A nested location lost its parent's `proxy_set_header` values.
**Cause:** It set one of its own, replacing the whole inherited set.
**Fix:** The include-snippet pattern. Nesting does not change the replace rule.

**Symptom:** An `internal` location returns 404 to your own health checker.
**Cause:** Working as designed — the checker is an external request.
**Fix:** Give the checker a non-internal endpoint. Do not remove `internal` from
something that guards files.

## Trade-off

**`X-Accel-Redirect` and `auth_request` split one decision across two systems.**
The authorisation lives in Node where it can be tested, and the delivery lives in
nginx where it is fast — but debugging now means reading two logs and knowing that
an empty Express response is *supposed* to be empty. A new engineer will not guess
that from either side alone.

The performance argument is decisive for large files: a Node process streaming a
multi-gigabyte download is a Node process not serving requests, and nginx does it
with none of that cost. For small files it is not worth the indirection. Use it
where the file is big or the concurrency is high, and leave small downloads in the
application.

## Interview questions

**★ What is a named location, and how is it reached?**
A `location @name` block. It is never matched against a URI — the matching
algorithm skips it entirely. It is reachable only from `try_files`, `error_page`
or `rewrite … last`, which makes it a safe fallback destination that cannot be
requested directly and cannot be looped into by ordinary matching.

**★ What does the `internal` directive do, and why does it matter?**
It marks a location as reachable only by internal redirect — from `error_page`,
`try_files`, `rewrite`, `index` or `X-Accel-Redirect`. External requests get a
404. It is what makes `X-Accel-Redirect` a real access control rather than an
obfuscated public path.

**★ Explain the `X-Accel-Redirect` pattern.**
The application authorises the request and returns an empty response carrying
`X-Accel-Redirect: /internal-path/file`. nginx sees the header, issues an internal
redirect to that location — which is marked `internal` — and streams the file
itself. The application never moves the bytes, so a large download does not occupy
a Node handler, and the real storage path is never exposed.

**Why is a named location a safer `try_files` fallback than a URI?**
Because a URI fallback re-enters normal location matching and can reach
`try_files` again, producing a redirection cycle. A named location cannot be
matched by URI, so nothing routes back into it. The documentation also notes that
processing restarts later for named locations — from the rewrite phase rather than
the server-rewrite phase — so less of the pipeline re-runs.

**When should you nest `location` blocks?**
When the child is genuinely a variation of the parent and the shared directive
list is long enough that duplicating it would be worse. Two top-level prefixes
behave identically, since prefix matching depends on string length rather than
structure — and the child still inherits subject to the replace rule, so "it
inherits the parent" holds only for directives it does not set itself.

**Can a named location be nested?**
No. Named locations cannot be nested and cannot contain nested locations. They are
single destinations by design.

---

← Prev: [The location matching algorithm](03-location-matching/README.md) · Index: [Phase 2](README.md) · Next → [The request-processing phases](05-request-phases.md)
