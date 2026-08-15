---
title: "Choosing the server block"
sidebar_label: "01 · Choosing the server block"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html)
> (the two-stage IP-then-Host matching, the default-server rule, the mixed
> name-based/IP-based example) and [Server names](https://nginx.org/en/docs/http/server_names.html)
> (the four-step matching order, the name kinds, the performance ranking,
> `server_names_hash_bucket_size` and `server_names_hash_max_size` defaults).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**Two stages, in this order: nginx narrows by the socket the request arrived on,
then by the `Host` header. Both stages have exact rules, and neither depends on
the order your `server` blocks appear in — except for regular expressions.**

## Stage 1 — the socket

Quoted from the documentation: *"first nginx tests the IP address and port of the
request against the `listen` directives of the `server` blocks. Then it tests the
'Host' header field … against the `server_name` entries of the `server` blocks
that matched the IP address and port."*

```nginx
server {
    listen      192.168.1.1:80;
    server_name example.org www.example.org;
}

server {
    listen      192.168.1.2:80;
    server_name example.com www.example.com;
}
```

A request for `www.example.com` arriving on **192.168.1.1:80** does **not** reach
the second block. The socket stage eliminated it before `Host` was even
considered, so the request goes to the default server for 192.168.1.1:80 — which
is the first block, serving `example.org`'s configuration to someone who asked for
`example.com`.

This is the surprise worth internalising: **an explicit address in `listen`
narrows the candidate set before hostname matching begins.**

`listen 80;` with no address means "any address", which is why most configs never
notice the two-stage rule — every block is a candidate for every request, and only
the `Host` stage does any work.

### `listen` forms worth knowing

```nginx
listen 80;                        # any address, port 80
listen 443 ssl;                   # TLS on this socket
listen 443 ssl default_server;    # ... and it is this port's default
listen 127.0.0.1:8080;            # one address only — narrows stage 1
listen [::]:80;                   # IPv6
listen 443 quic reuseport;        # HTTP/3, alongside a `listen 443 ssl` — Phase 5
listen unix:/run/nginx.sock;      # a Unix socket
```

## Stage 2 — `server_name`, in four steps

The documented order, *terminating on the first match*:

| # | Kind | Example | Notes |
|---|---|---|---|
| 1 | **Exact name** | `example.org` | fastest — hash lookup |
| 2 | **Longest wildcard starting with `*`** | `*.example.org` | hash lookup |
| 3 | **Longest wildcard ending with `*`** | `mail.*` | hash lookup |
| 4 | **First matching regular expression** | `~^(?<user>.+)\.example\.net$` | **in order of appearance**, tested sequentially |

**Steps 1–3 do not care where your blocks appear in the file.** Specificity
decides. Step 4 is the exception and it is the only one where file order matters —
exactly mirroring the location-matching asymmetry on
[page 03](03-location-matching/README.md).

```nginx
server { server_name example.org; }        # wins for example.org, wherever it sits
server { server_name *.example.org; }      # wins for anything.example.org
server { server_name ~^v(?<n>\d+)\.api\.example\.org$; }   # tried only if nothing above matched
```

### Regex server names, and their captures

```nginx
server {
    server_name ~^(www\.)?(?<domain>.+)$;

    location / {
        root /sites/$domain;      # the named capture, used as a variable
    }
}
```

Named captures become variables, which is how per-tenant document roots and
wildcard subdomain routing are done without a `map`. The documentation notes that
digital captures (`$1`, `$2`) also work but *"should be limited to simple cases"*
— named captures survive refactoring, positional ones do not.

### The performance ranking

Documented, fastest to slowest:

1. exact names
2. wildcards starting with `*`
3. wildcards ending with `*`
4. **regular expressions — "slowest and non-scalable"**, tested sequentially

The first three are hash lookups and stay fast with thousands of names. Regexes
are a linear scan per request. A config with fifty regex `server_name`s is doing
fifty regex evaluations on every request that reaches step 4.

**Prefer exact names, then leading wildcards. Use a regex only when you genuinely
need a capture.**

## Sizing the hash

With many server names nginx will tell you to raise these:

| Directive | Default |
|---|---|
| `server_names_hash_bucket_size` | 32, 64 or another value depending on the CPU cache line size |
| `server_names_hash_max_size` | **512** |

Raise the bucket size *to the next power of two*, as the documentation advises,
and raise the max size when you define a large number of names. Both live in
`http`, and both are "fix it when nginx asks" settings — the error message names
the directive.

## Nothing here looks at the path

**Stage 1 and stage 2 use the socket and the `Host` header. The URL path plays no
part.** Path matching happens afterwards, inside the chosen `server`, and is
page 03.

That separation is worth stating because it explains a common confusion: you
cannot route `example.com/api` to one `server` block and `example.com/app` to
another. One hostname on one socket resolves to exactly one `server` block, and
everything after that is `location` matching within it.

## A worked example

```nginx
server {                                   # A
    listen 80;
    server_name example.org;
}

server {                                   # B
    listen 80 default_server;
    server_name *.example.org;
}

server {                                   # C
    listen 80;
    server_name ~^(?<sub>.+)\.example\.net$;
}
```

| Request `Host` | Wins | Why |
|---|---|---|
| `example.org` | **A** | exact name — step 1, regardless of position |
| `api.example.org` | **B** | leading wildcard — step 2 |
| `v2.example.net` | **C** | no exact or wildcard match, first regex — step 4 |
| `unknown.test` | **B** | nothing matched → the port's default server |
| *(no `Host` header)* | **B** | same — no match means the default |

Note that **B wins twice for two completely different reasons.** Being the default
server has nothing to do with its `server_name`; it is a property of the `listen`
line. Page 02 is that distinction in full.

## Gotchas

**Symptom:** A request for one site is served another site's content, with no
error anywhere.
**Cause:** The `Host` did not match any `server_name` on that socket, so it went
to the default server — which is *some* block, whether you chose it or not.
**Fix:** Define an explicit `default_server` that returns 444 or 421 (page 02).
Never let the default be decided by which file sorted first.

**Symptom:** A `server` block with the right `server_name` is never selected.
**Cause:** Its `listen` has an explicit address that does not match the socket the
request arrived on. Stage 1 eliminated it before `Host` was read.
**Fix:** Compare the `listen` lines, not the `server_name`s. `nginx -T | grep -A2
listen` shows all of them together.

**Symptom:** Two `server` blocks declare the same `server_name` and one is
silently ignored.
**Cause:** A duplicate — often an old config file still matching the include glob
([Phase 1](../phase-1-configuration-language/03-include-and-files/01-how-include-works.md)).
nginx logs a `conflicting server name` **warning** and carries on.
**Fix:** Search the error log for `conflicting server name`, and find the second
file with `nginx -T | grep -n server_name`.

**Symptom:** A regex `server_name` never matches although the pattern looks right.
**Cause:** An earlier exact or wildcard name matched first — regexes are step 4
and only run when steps 1–3 all fail.
**Fix:** Check for a `*.example.com` that is swallowing the hostname before your
regex is reached.

**Symptom:** Adding many virtual hosts produced
`could not build the server_names_hash, you should increase
server_names_hash_bucket_size`.
**Cause:** The hash table's defaults are sized for a modest number of names.
**Fix:** Set the directive to the value the message names — the next power of two.
Expected with many names, not a misconfiguration.

## Trade-off

**Specificity-based matching makes configuration order irrelevant, which is what
you want — until you use regexes, where it suddenly is not.** Two rules in one
mechanism is genuinely harder to hold in your head than one rule, and it is the
same split you will meet again on page 03.

The compensation is that the specificity half is the half you use constantly, and
it is the forgiving one: you can reorder files, rename them, change the include
glob, and exact and wildcard matching keep working identically. Only the regexes
care, and if you have very few of them — which the performance ranking already
pushes you toward — you rarely have to think about it.

## Interview questions

**★ How does nginx decide which `server` block handles a request?**
Two stages. First it matches the request's IP address and port against the
`listen` directives; only blocks on that socket remain candidates. Then it matches
the `Host` header against `server_name` among those candidates. If nothing
matches, the request goes to the default server for that socket.

**★ What is the `server_name` matching order?**
Exact name, then the longest wildcard beginning with `*`, then the longest
wildcard ending with `*`, then the first matching regular expression in file
order. It terminates on the first match. Only the regex step depends on the order
blocks appear in the configuration.

**★ Why might a request reach the wrong `server` block even though a block with
the correct `server_name` exists?**
Because `listen` is matched first. A block with an explicit address that does not
match the socket the request arrived on is eliminated before `Host` is examined,
so the request falls through to that socket's default server.

**★ Can you route `example.com/api` and `example.com/app` to different `server`
blocks?**
No. Server selection uses only the socket and the `Host` header — the path plays
no part. One hostname on one socket resolves to exactly one `server` block, and
path-based routing happens with `location` blocks inside it.

**Which `server_name` form is fastest, and which should you avoid?**
Exact names are fastest (hash lookup), then leading wildcards, then trailing
wildcards. Regular expressions are documented as slowest and non-scalable — they
are tested sequentially on every request that reaches that step. Use a regex only
when you need a capture.

**What do captures in a regex `server_name` give you?**
Variables. `server_name ~^(www\.)?(?<domain>.+)$;` makes `$domain` available in
the block, which is how per-tenant roots and wildcard subdomain routing work
without a `map`. Named captures are preferred; the docs say positional ones should
be limited to simple cases.

**You see `conflicting server name` in the error log. What is it telling you?**
Two `server` blocks on the same socket declare the same name. nginx warns and
keeps the first one it read, silently ignoring the other — usually a retired
config file that still matches the include glob.

---

← Index: [Phase 2](README.md) · Next → [The default server and host-header safety](02-default-server.md)
