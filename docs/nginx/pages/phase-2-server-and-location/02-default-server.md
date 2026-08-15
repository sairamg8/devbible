---
title: "The default server and host-header safety"
sidebar_label: "02 · The default server"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against [How nginx processes a request](https://nginx.org/en/docs/http/request_processing.html)
> (the default-server rule, the `server_name ""` / `return 444` example, and that
> `""` has been the default for `server_name` since **0.8.48**),
> [Server names](https://nginx.org/en/docs/http/server_names.html) (the `""` and `_`
> special names), [ngx_http_ssl_module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
> (`ssl_reject_handshake`) and [ngx_http_core_module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
> (`$host`, `listen`).
> **No sandbox run** — nothing on this page was executed, and it carries no console output.

**There is always a default server on every socket. If you did not choose it,
nginx chose the first block it read — and that block is now answering for every
hostname anyone points at your IP address.**

## The rule

Quoted: *"If the 'Host' header field does not match any server name, or the
request does not contain this header field at all, then nginx will route the
request to the default server for this port. … By default, the first server is the
default one."*

Three things follow, and each is load-bearing:

1. **The default is a property of the `listen` port, not of any server name.**
   Different ports can have different defaults.
2. **You get one whether you want one or not.** "I did not configure a default"
   means "the first block in include order is the default".
3. **It handles requests with no `Host` header at all**, which HTTP/1.0 clients,
   scanners and misbehaving scripts still send.

```nginx
server {
    listen      80 default_server;      # explicit — this one, not whichever sorted first
    server_name example.net;
}
```

## Why an accidental default is a security problem

Anyone can point a DNS name at your IP address, or simply send whatever `Host`
header they like. If your default server is a real site, that site now answers for
`evil.example`:

```http
GET /reset-password HTTP/1.1
Host: evil.attacker.test
```

nginx matches no `server_name`, routes to the default, and your application
receives `$host = evil.attacker.test`. Two concrete consequences:

- **Password-reset and email links.** An app that builds absolute URLs from the
  forwarded `Host` sends the user a link pointing at the attacker's domain, with a
  valid token in it.
- **Web cache poisoning.** If a cache keys on the path but the response embeds the
  attacker-supplied host, the poisoned response is served to real users
  (Phase 6).

Neither is an nginx bug. `$host` is *"host name from the request line, or … the
'Host' request header field, or the server name matching a request"* — mostly
client-controlled, exactly as documented. The fix is to make sure a request with
an unrecognised host never reaches an application at all.

## The catch-all

```nginx
# The FIRST server block, or one carrying default_server on every listen.
server {
    listen      80 default_server;
    listen      [::]:80 default_server;
    server_name _;                     # an invalid domain name — matches nothing
    return      444;                   # close the connection, send nothing
}
```

Two details from the documentation:

- **`_` is not special.** *"there is nothing special about this name, it is just
  one of a myriad of invalid domain names which never intersect with any real
  name."* It works as a catch-all because it can never match — so the block is
  reached only via the default-server path.
- **`444` closes the connection without sending a response header**, which is the
  documented idiom for traffic you want to give nothing to.

`return 421` (Misdirected Request) is a reasonable alternative when you would
rather a legitimate misconfigured client got a real answer. `444` gives scanners
nothing at all; pick based on whether anything legitimate can end up here.

### Requests with no `Host` header

```nginx
server {
    listen      80;
    server_name "";
    return      444;
}
```

The documentation shows exactly this, and notes that **since 0.8.48 the empty
string has been the default value of `server_name`**. So a `server` block with no
`server_name` at all already matches host-less requests — which is another reason
to be explicit rather than to rely on defaults you did not write.

## HTTPS: the certificate is chosen before the request exists

This is the part that surprises people, and it changes what a default server can
do.

On an HTTPS connection the TLS handshake happens **first**. nginx must present a
certificate before it has seen a request line or a `Host` header, so it chooses
the certificate from the **SNI** value in the ClientHello — and if SNI does not
match any `server_name`, it uses the default server's certificate.

The consequence: a client connecting to your IP with an unknown SNI gets **your
default server's certificate**, which leaks which domain that is and produces a
name-mismatch error rather than a clean refusal.

```nginx
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    ssl_reject_handshake on;      # refuse the handshake outright
}
```

`ssl_reject_handshake` is the correct default-server behaviour for HTTPS: rather
than presenting an unrelated certificate, nginx aborts the TLS handshake. No
certificate is disclosed and no request is ever parsed.

Note that a `default_server` block still needs `ssl_certificate` unless it uses
`ssl_reject_handshake`, because otherwise there is nothing to present.

## `$host`, `$http_host`, `$server_name` — which to trust

| | `$http_host` | `$host` | `$server_name` |
|---|---|---|---|
| Source | the raw `Host` header | request line → `Host` header → **matching server name** | the `server_name` that matched |
| Empty when the header is absent | **yes** | no — falls back | no |
| Normalized (lowercase, port stripped) | no | **yes** | n/a |
| Client-controlled | **entirely** | mostly | **no** |

**Use `$host` for proxying and redirects** — it is normalized and never empty.
**Use `$server_name` when the value must not be influenced by the client**, for
example when constructing something that will be emailed or cached.

And note what "mostly client-controlled" means in practice: `$host` is safe
*because* the catch-all server exists. Without one, `$host` is whatever the
attacker sent.

## The complete safe skeleton

```nginx
# 00-default.conf — sorts first, so it is the default even without the parameter
server {
    listen      80  default_server;
    listen      [::]:80 default_server;
    server_name _;
    return      444;
}

server {
    listen      443 ssl default_server;
    listen      [::]:443 ssl default_server;
    ssl_reject_handshake on;
}

# app.conf — the real site
server {
    listen      443 ssl;
    server_name app.example.com;
    # ...
}

server {
    listen      80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}
```

Four blocks, and between them every combination of "known or unknown host" and
"HTTP or HTTPS" has a deliberate answer.

## Gotchas

**Symptom:** Someone's unrelated domain resolves to your server and shows your
site.
**Cause:** No explicit default server, so the first `server` block answers for
every unmatched hostname.
**Fix:** The catch-all above. Add `default_server` on **every** `listen` line
including the IPv6 ones — a default is per socket, and `[::]:80` is a different
socket from `:80`.

**Symptom:** Password-reset emails contain an attacker's domain.
**Cause:** The application built absolute URLs from a forwarded, client-controlled
`Host`.
**Fix:** The catch-all server stops the request reaching the app at all. As a
second layer, use `$server_name` rather than `$host` for anything durable, and
validate the host in the application.

**Symptom:** `nginx: [emerg] a duplicate default server for 0.0.0.0:80`.
**Cause:** Two blocks both carry `default_server` for the same socket.
**Fix:** Exactly one per socket. This is one of nginx's better errors — it fails
loudly rather than picking.

**Symptom:** Connecting to the IP over HTTPS shows a certificate for an unrelated
internal domain.
**Cause:** The HTTPS default server presented its own certificate for unknown SNI.
**Fix:** `ssl_reject_handshake on;` on the HTTPS default server. It refuses the
handshake instead of disclosing a name.

**Symptom:** The catch-all works on IPv4 and unknown hosts still reach the app
over IPv6.
**Cause:** `default_server` was set only on `listen 80` and not on
`listen [::]:80`.
**Fix:** Both. Every socket has its own default.

**Symptom:** A health check from a load balancer sends no `Host` header and gets
444.
**Cause:** Working as designed — the catch-all caught it.
**Fix:** Give the checker a real `Host`, or add an explicit
`location = /healthz { return 200; }` inside the catch-all server. Do not weaken
the catch-all itself.

## Trade-off

**A strict catch-all can hide a real misconfiguration behind silence.** `444`
sends nothing at all, so a legitimate client that reaches it — a health check
without a `Host`, a new subdomain whose `server_name` you forgot — sees a dropped
connection rather than an error, and there is nothing in the browser to diagnose.

That silence is the point for hostile traffic and a nuisance for your own. Two
mitigations, both cheap: log the catch-all to its own file so unexpected hits are
visible (Phase 10), and use `421` instead of `444` in environments where anything
legitimate might land there. What you should not do is let the default be an
accident.

## Interview questions

**★ What is the default server, and how is it chosen?**
The `server` block that handles requests whose `Host` matches no `server_name`, or
that carry no `Host` at all. It is a property of the listening socket, not of any
name. By default it is the first block defined for that socket; `default_server`
on a `listen` line makes the choice explicit.

**★ Why is an accidental default server a security problem?**
Because anyone can point a DNS name at your IP or send an arbitrary `Host` header,
and the default block will answer. If it is a real site, your application receives
an attacker-controlled `$host` — which produces poisoned password-reset links and
cache-poisoning opportunities.

**★ How do you write a catch-all that refuses unknown hosts?**
A block carrying `default_server` on every `listen` line, `server_name _;` (an
invalid name that can never match, so the block is reachable only as the default),
and `return 444;` — nginx's non-standard code that closes the connection without
sending a response header.

**★ What is special about the `_` server name?**
Nothing, and that is the point. The documentation says it is *"just one of a
myriad of invalid domain names which never intersect with any real name"*. It is a
readable convention for "this block is only ever reached as the default".

**Why does the HTTPS default server need different treatment?**
Because the certificate is selected during the TLS handshake, from SNI, before any
request exists. An unknown SNI gets the default server's certificate — disclosing
a domain name and producing a mismatch error. `ssl_reject_handshake on;` refuses
the handshake instead.

**What does `server_name "";` match?**
Requests with no `Host` header at all. The documentation notes that since 0.8.48
the empty string is the *default* value of `server_name`, so a block with no
`server_name` already matches them — another reason to be explicit.

**When should you use `$server_name` rather than `$host`?**
When the value must not be influenced by the client. `$host` falls back to the
`Host` header and is therefore mostly client-controlled; `$server_name` is the
configured name that matched. Use it for anything durable — emailed links, cache
keys, audit records.

---

← Prev: [Choosing the server block](01-choosing-the-server.md) · Index: [Phase 2](README.md) · Next → [The location matching algorithm](03-location-matching/README.md)
