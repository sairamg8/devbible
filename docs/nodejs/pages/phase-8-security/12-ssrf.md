---
title: "SSRF"
sidebar_label: "12 · SSRF"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** with **undici 8.10.0** — every URL, connection
> and block below was executed against local servers on this machine.

**Your server is inside the network the attacker wants to reach.** Any feature that
fetches a URL the user supplied — webhook registration, "import from URL", avatar
fetching, link previews, PDF rendering, health checks against a customer endpoint — hands
an outsider your firewall position. The interesting targets are not on the internet:
`169.254.169.254` for cloud instance credentials, an unauthenticated admin port on
`127.0.0.1`, a database on `10.x`, a Kubernetes API on the cluster network.

[Phase 7](../phase-7-background-work/09-outbound-side-effects.md) raised this for outbound
webhooks and left the defence here.

## Good news first: `new URL()` normalises the obfuscated forms

The classic advice is that attackers evade IP blocklists with decimal, octal or hex
notation. On Node, WHATWG URL parsing collapses all of them before you see the hostname:

```console
http://127.0.0.1/            -> hostname 127.0.0.1        net.isIP = 4
http://2130706433/           -> hostname 127.0.0.1        net.isIP = 4
http://0x7f000001/           -> hostname 127.0.0.1        net.isIP = 4
http://0177.0.0.1/           -> hostname 127.0.0.1        net.isIP = 4
http://127.1/                -> hostname 127.0.0.1        net.isIP = 4
http://[::1]/                -> hostname [::1]            net.isIP = 0
http://[::ffff:127.0.0.1]/   -> hostname [::ffff:7f00:1]  net.isIP = 0
http://localhost/            -> hostname localhost        net.isIP = 0
```

All four IPv4 spellings connected successfully to a local server — `200 SECRET` each
time — so they are real attacks, but a check on `url.hostname` sees the canonical
`127.0.0.1` for every one of them.

**Two traps in that table.** IPv6 hostnames keep their brackets, so `net.isIP('[::1]')`
returns `0` — strip the brackets before testing. And `::ffff:127.0.0.1` is re-spelled as
`::ffff:7f00:1`, so a string comparison against the address you expected fails while the
address still points at loopback.

## The check that does not work: validate the URL, then fetch it

```js
// pseudo-code: the version that looks right and isn't
const url = new URL(input);
if (isPrivate(await dns.lookup(url.hostname))) throw new Error('blocked');
const res = await fetch(url);          // resolves DNS again, independently
```

Two separate failures live in this.

**Redirects.** `fetch` follows them by default, and the hop is never validated:

```console
default fetch      -> 200 SECRET | redirected = true
redirect:'manual'  -> 302        | location = http://127.0.0.1:35919/
redirect:'error'   -> threw unexpected redirect
```

A public URL that 302s to `http://169.254.169.254/` passes any up-front check and then
fetches the metadata service anyway.

**DNS rebinding.** Your check resolves the name; `fetch` resolves it again. Between the
two answers, an attacker-controlled DNS server with a one-second TTL can return a public
address to the validator and a private one to the connection. The gap is inherent to
check-then-fetch — only a check at connect time closes it.

## The defence, in three parts

### 1. Reject at parse time

```js
import net from 'node:net';

const SCHEMES = new Set(['http:', 'https:']);

export function parseTarget(input) {
  const url = new URL(input);                       // throws on garbage
  if (!SCHEMES.has(url.protocol)) throw new Error(`scheme ${url.protocol} not allowed`);
  const host = url.hostname.replace(/^\[|\]$/g, ''); // IPv6 arrives bracketed
  if (net.isIP(host) && isPrivateAddress(host)) throw new Error('private address');
  return url;
}
```

Scheme filtering matters more than it looks. Against Node's `fetch`:

```console
file:///etc/passwd   -> threw not implemented... yet...
ftp://example.com/x  -> threw unknown scheme
data:text/plain,hi   -> 200 hi
```

`file:` and `ftp:` are refused by the runtime, but **`data:` returns 200** — a naive
fetcher will happily "download" attacker-authored content and treat it as a remote
document. Allowlist the two schemes you meant.

### 2. Check the address at connect time

```js
import dns from 'node:dns';
import net from 'node:net';

export function isPrivateAddress(ip) {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 127 || a === 10 || a === 0 ||
           (a === 172 && b >= 16 && b < 32) ||
           (a === 192 && b === 168) ||
           (a === 169 && b === 254);              // cloud metadata
  }
  return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip);
}

export function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);
    const first = Array.isArray(address) ? address[0].address : address;
    if (isPrivateAddress(first)) {
      return callback(Object.assign(new Error(`blocked: ${hostname} resolved to ${first}`),
                                    { code: 'ESSRFBLOCKED' }));
    }
    callback(null, address, family);
  });
}
```

This drops straight into the built-in HTTP client — no dependency:

```js
const req = http.request(url, { lookup: guardedLookup }, (res) => { /* … */ });
```

```console
http://127.0.0.1:32995/    -> 200 SECRET
http://2130706433:32995/   -> 200 SECRET
http://localhost:32995/    -> blocked: localhost resolved to ::1
```

**Read those first two lines carefully — the guard did not fire.** Instrumenting the
lookup function shows why:

```console
127.0.0.1    -> SECRET | lookup called with: NEVER CALLED
2130706433   -> SECRET | lookup called with: NEVER CALLED
localhost    -> SECRET | lookup called with: localhost
```

**A custom `lookup` is never invoked for a literal IP address** — there is no name to
resolve, so the socket connects directly. This is the single most important detail on
this page: a connect-time DNS guard on its own is *not* an SSRF defence. Step 1 handles
literals, step 2 handles names, and you need both.

### 3. Re-check every redirect hop

`http.request` does not follow redirects, which turns the problem into an explicit loop
you control:

```console
redirector (no follow) -> 302 Location: http://127.0.0.1:32995/
```

```js
export async function safeFetch(input, { maxHops = 3 } = {}) {
  let url = parseTarget(input);
  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await requestWith(url, guardedLookup);      // your http.request wrapper
    if (![301, 302, 303, 307, 308].includes(res.status)) return res;
    if (!res.headers.location) return res;
    url = parseTarget(new URL(res.headers.location, url));  // validated again, every hop
  }
  throw new Error('too many redirects');
}
```

With `fetch`, the equivalent is `redirect: 'manual'` and the same loop. `redirect: 'error'`
is the blunt option — verified to throw `unexpected redirect` — and is the right choice
when your integration has no legitimate reason to redirect.

## A dependency trap worth knowing

Passing an undici `Agent` as `dispatcher` to Node's **global** `fetch` fails:

```console
fetch(url, { dispatcher: agent })  -> invalid onRequestStart method
```

Node's `fetch` is built on the undici bundled *inside* the runtime; `npm install undici`
gives you a second, separate copy whose handler interface does not match. Import `fetch`
from the same package as the `Agent` and it works:

```js
import { fetch, Agent } from 'undici';
const agent = new Agent({ connect: { lookup: guardedLookup } });
```

```console
http://localhost:32995/  -> blocked: localhost resolved to ::1
http://example.com/      -> 200
```

Same rule as above: literal IPs still bypass the lookup, so keep step 1.

**The permission model will not help here.** As measured for
[page 24](./24-permission-model.md), Node 24 has no `--allow-net`, and network access is
unrestricted under `--permission`. Containing SSRF at the runtime boundary is not an
option on the target LTS.

## The design that removes the problem

Where the set of destinations is knowable, an **allowlist of hosts** beats any blocklist —
blocklists are a guess about the whole address space, allowlists are a statement about
your integration. Where it isn't (user-registered webhooks), the strong version is an
**egress proxy**: outbound requests leave through one host whose firewall rules permit
public ranges only, so an application bug cannot reach the private network at all. The
in-process checks above then become defence in depth rather than the only wall.

Two smaller habits: give outbound requests their own timeout and size cap, and never
return the upstream response body verbatim — echoing it turns a blind SSRF into a
readable one.

## Gotchas

**Symptom:** A URL allowlist passes validation, then the fetch reaches an internal host
**Cause:** The response was a redirect and `fetch` follows redirects by default.
**Fix:** `redirect: 'manual'` (or `http.request`) and re-validate each hop.

**Symptom:** A custom `lookup` guard never blocks `http://127.0.0.1/`
**Cause:** `lookup` is not called for literal IP addresses — verified `NEVER CALLED`.
**Fix:** Check `net.isIP(url.hostname)` at parse time as well.

**Symptom:** `net.isIP(url.hostname)` returns 0 for an IPv6 URL
**Cause:** `new URL()` keeps the brackets: `[::1]`.
**Fix:** Strip `[` and `]` before the test.

**Symptom:** A blocklist string comparison misses an IPv4-mapped IPv6 address
**Cause:** `::ffff:127.0.0.1` is normalised to `::ffff:7f00:1`.
**Fix:** Compare parsed addresses, not strings, and treat the `::ffff:` range as IPv4.

**Symptom:** `fetch(url, { dispatcher })` throws `invalid onRequestStart method`
**Cause:** An `Agent` from the npm `undici` passed to the runtime's bundled `fetch`.
**Fix:** Import `fetch` from `undici` too, or use `http.request({ lookup })`.

**Symptom:** Validation passes but the connection goes somewhere else
**Cause:** DNS rebinding — separate resolutions for the check and the connection.
**Fix:** Validate inside the `lookup` used by the request; never check-then-fetch.

**Symptom:** A `data:` URL is accepted as a remote document
**Cause:** No scheme allowlist; `fetch('data:text/plain,hi')` returns 200.
**Fix:** Allow `http:` and `https:` only.

## Interview questions

**★ What is SSRF and why is it worse than it sounds?**
The server makes a request to a URL the user controls, from inside the network. That
reaches cloud metadata at `169.254.169.254`, loopback admin ports and private ranges that
no external attacker can address — using your server's network position and often its
identity.

**★ Why isn't "validate the URL before fetching" enough?**
Two holes, both verified. Redirects: `fetch` follows them by default and the hop is never
re-validated, so a public URL can 302 into the private range. And DNS rebinding: the
validator and the connection resolve the name separately, so the answer can change
between them.

**★ You add a custom `lookup` that rejects private addresses. What still gets through?**
Literal IPs. There is no name to resolve, so `lookup` is never invoked — verified: a
request to `http://127.0.0.1/` reached the server with the guard installed and the guard
never called. Parse-time `net.isIP` checking is required alongside it.

**★ Do attackers still bypass filters with decimal or hex IPs on Node?**
They can send them, but `new URL()` normalises `2130706433`, `0x7f000001`, `0177.0.0.1`
and `127.1` all to `127.0.0.1`, so a check on `url.hostname` sees the canonical form.
The hostname is the thing to check — not the raw input string.

**Allowlist or blocklist?**
Allowlist whenever the destinations are knowable; a blocklist is a claim about every
address that exists, and misses IPv6, link-local, and whatever range your cloud adds next.
For genuinely user-supplied URLs, put the allowlist in the network — an egress proxy —
rather than in the process.

**Can Node's permission model contain SSRF?**
No. On Node 24 there is no `--allow-net` flag and network access is not restricted under
`--permission` — verified. Granular network permissions arrived after the target LTS.

---

← Prev: [CSRF](./11-csrf.md) · Next → [Prototype pollution](./13-prototype-pollution.md)
