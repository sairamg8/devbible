---
title: "Native and desktop apps have three ways to receive a redirect and they differ by who the operating system will believe, which is why the one exception to exact string matching in the whole specification exists for a loopback port"
sidebar_label: "12b · Native apps and loopback"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 8252 §4 (Using Inter-App URI Communication for OAuth), §6
> (Use PKCE), §7 (Redirect URI Options), §7.1 (Private-Use URI Scheme Redirection), §7.2
> (Claimed "https" Scheme URI Redirection), §7.3 (Loopback Interface Redirection), §8.1
> (Embedded User-Agents), §8.5 (Client Authentication), §8.10 (Fake External User-Agents)
> ([datatracker.ietf.org/doc/html/rfc8252](https://datatracker.ietf.org/doc/html/rfc8252));
> RFC 9700 §2.1, §4.1.3
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**A native app is a public client that cannot host a web server on a domain, so "redirect to a
URL you control" has to mean something else. RFC 8252 gives three answers, and they are not
equivalent: one is verified by the operating system against a file on your domain, one is
verified by nothing at all, and one is verified by which process got to the port first. The
security of the whole flow on a device is mostly determined by which of the three you picked.**

## The three options

RFC 8252 §7 requires authorization servers to support all of them:

### §7.2 — Claimed `https` scheme URI

`https://app.example.com/oauth2redirect` where the operating system has verified, by fetching a
file from `app.example.com`, that your app is authorised to handle links for that host. This is
Universal Links on Apple platforms and App Links on Android.

Strongest, because the association is verified against a domain you demonstrably control, and
because if the app is not installed the URL still resolves — in a browser, to your website,
which can display something useful rather than a dead link.

RFC 8252 §7.2 recommends it where available: *"native apps SHOULD use them over the other
options where possible"*, because the operating system guarantees the app's identity to the
authorization server. The cost is platform-specific setup and a real web
server hosting the association file.

### §7.1 — Private-use URI scheme

`com.example.app:/oauth2redirect`. RFC 8252 §7.1 requires the scheme be a domain name under
your control expressed in reverse order — an app controlling `app.example.com` uses
`com.example.app` — and, because *"there is no naming authority for private-use URI scheme
redirects, only a single slash ('/') appears after the scheme component."*

**No verification exists.** Any application may declare any scheme. This is the substrate of the
authorization code interception attack — [05](05-the-interception-attack.md). The reverse-domain
convention reduces *accidental* collisions and does nothing about deliberate ones.

### §7.3 — Loopback interface redirection

`http://127.0.0.1:{port}/oauth2redirect` or `http://[::1]:{port}/…`. The app binds an ephemeral
port on the loopback interface for the duration of the flow. RFC 8252:

> *"The authorization server MUST allow any port to be specified at the time of the request for
> loopback IP redirect URIs, to accommodate clients that obtain an available ephemeral port from
> the operating system at the time of the request."*

This is the **only exception to exact string matching in the entire BCP**. RFC 9700 §2.1:
*"exact string matching except for port numbers in `localhost` redirection URIs of native
apps"*, and §4.1.3: *"The only exception is native apps using a `localhost` URI."*

The exception is narrow and deliberate: the host, the scheme and the path still match exactly;
only the port floats. Anything wider would reintroduce pattern matching.

RFC 8252 §7.3 also prefers the literal IP address over the name `localhost`: *"specifying a
redirect URI with the loopback IP literal rather than `localhost` avoids inadvertently listening
on network interfaces other than the loopback interface."* The name resolves through the host's
name resolution and may map to more than the loopback interface — or be redirected by a `hosts`
file entry — whereas the literal address cannot be.

## The exposure of each

| Option | Who can receive the redirect | Verification |
|---|---|---|
| Claimed `https` (§7.2) | Only an app the OS has verified against your domain | OS-enforced, domain-based |
| Loopback (§7.3) | Any local process that binds the port first, or reaches it | None; a race |
| Private-use scheme (§7.1) | Any app that declared the scheme | None |

In all three cases PKCE is what makes the exposure survivable, which is why RFC 8252 §6 is a
hard requirement:

> *"Public native app clients MUST implement the Proof Key for Code Exchange (PKCE [RFC7636])
> extension to OAuth, and authorization servers MUST support PKCE for such clients."*

With PKCE, an attacker who wins the race for the loopback port or the URI scheme gets a code
they cannot redeem. Without it, they get an account.

## The user-agent rule, which is not about redirect URIs but always comes up with them

RFC 8252 §4:

> *"For authorizing users in native apps, the best current practice is to perform the OAuth
> authorization request in an external user-agent (typically the browser) rather than an
> embedded user-agent."*

§8.1 explains the reasoning: an embedded user-agent is fully controlled by the host application,
so it can read what the user types and can read cookies for the authorization server's origin;
and the user cannot see the address bar or the TLS state, so they cannot distinguish the real
authorization server from a rendering of one.

The modern middle ground is the in-app browser tab — `SFSafariViewController` on Apple
platforms, Custom Tabs on Android — which is the system browser rendered inside your app's task,
sharing the system browser's cookie jar and not readable by your app. RFC 8252 §8.10 also warns
about *fake* external user-agents: a malicious app can render something that looks like a
browser, which is a reason the user experience should route through the OS-provided component
rather than anything the app draws itself.

## Java's place in this

This is not a Spring Security client scenario — a native app is not a Spring servlet
application. Two places Java engineers meet it anyway:

- **A desktop tool in Java** — an IDE plugin, a CLI, an installer — uses the loopback pattern.
  The pattern is: bind `ServerSocket` on port 0 to get an ephemeral port, build the
  `redirect_uri` from the actual bound port, open the system browser with
  `java.awt.Desktop.browse(URI)`, accept exactly one request, extract `code` and `state`, close
  the socket, exchange the code. PKCE is mandatory; the verifier lives in process memory.
- **The backend of a mobile app**. The mobile client does the flow; your backend is the resource
  server. Your obligation is that the *registration* is correct — public client, no secret,
  PKCE required, exact redirect URIs — which is usually configured by whoever administers the
  identity provider and is worth reviewing.

## Gotchas

**★ The loopback exception is *only* the port.**
Scheme, host and path still match exactly. `http://127.0.0.1:51004/cb` against a registered
`http://127.0.0.1/callback` does not match, and `http://localhost:51004/cb` against a registered
`http://127.0.0.1/cb` does not either — different host strings.

**★ Prefer `127.0.0.1` to `localhost`.**
RFC 8252 §7.3: using the literal *"avoids inadvertently listening on network interfaces other
than the loopback interface"*. A listener bound via a name that resolves to a non-loopback
address is reachable from the network, which turns a local-only callback into a remote one.

**★ A fixed loopback port is a fixed target.**
Publishing "we listen on 8765" invites a local attacker to bind it first. Use port 0 and read
back what the OS gave you.

**★ IPv6 loopback is `[::1]` and some servers do not accept it.**
If you support both stacks you may need both registered, and the bracketed form is part of the
string.

**★ A private-use scheme with a single label is both non-conforming and a collision magnet.**
`myapp://callback` is what everyone writes first. RFC 8252 §7.1 wants a reverse-domain scheme
you control. It does not make interception impossible, but `com.example.myapp` collides by
accident far less often than `myapp`.

**★ Claimed `https` URIs fail open on some platforms if verification fails.**
If the association file is unreachable or malformed, the OS falls back to opening the URL in a
browser. That is a graceful degradation for a normal link and a broken login for an OAuth
callback — the user lands on your website with a code in the URL and no app to hand it to.
Monitor the association file like a production endpoint.

**★ An embedded web view makes the app the man in the middle of its own login.**
RFC 8252 §8.1. It also breaks single sign-on, because the web view has its own cookie jar and
the user's existing authorization-server session is invisible to it — so they are asked to
retype credentials, which is the behaviour OAuth2 exists to eliminate.

**★ A desktop app that keeps the loopback listener open after the flow is an open local
endpoint.**
Accept one request, then close. A listener that stays up is a local attack surface for the life
of the process, and on a shared machine it is reachable by every other user's processes.

**★ Native apps are public clients and a secret shipped in the binary is not a secret.**
RFC 8252 §8.5: *"Except when using a mechanism like Dynamic Client Registration [RFC7591] to
provision per-instance secrets, native apps are classified as public clients ... they MUST be
registered with the authorization server as such."* Extracting a string from a mobile binary is
a beginner exercise.

## Interview questions

**★ What is the one exception to exact redirect-URI matching, and why does it exist?**
The port number of a loopback redirect URI for a native app. RFC 9700 §2.1: *"exact string
matching except for port numbers in `localhost` redirection URIs of native apps"*. It exists
because a desktop app binds an ephemeral port at runtime — it cannot know in advance which port
the operating system will give it, so it cannot register the full URI. RFC 8252 §7.3 makes the
corresponding server obligation: *"The authorization server MUST allow any port to be specified
at the time of the request for loopback IP redirect URIs."* Scheme, host and path still match
exactly; only the port floats.

**★ Rank the three native redirect options by security and say why.**
Claimed `https` URI first: the operating system verifies the app's association with a domain you
control by fetching a file from it, so only your app receives the redirect, and an uninstalled
app degrades to your website rather than to nothing. Loopback second: no verification, but the
attack requires local code execution and a race for the port. Private-use URI scheme last: any
installed app can declare the same scheme, with no registry and no enforcement, which is
precisely the authorization code interception attack RFC 7636 was written for. All three require
PKCE, and RFC 8252 §6 makes that a MUST for public native clients.

**★ Why does RFC 8252 push native apps to the system browser rather than a web view?**
Three reasons. The host app fully controls an embedded web view, so it can read credentials the
user types and cookies for the authorization server's origin — which destroys the property that
the client never sees the user's password. The user cannot see the address bar or TLS state, so
they cannot verify they are at the real authorization server. And the web view has its own
cookie jar, so the user's existing session with the identity provider is invisible and they must
authenticate again, training exactly the credential-entry habit OAuth2 removes. The in-app
browser tab components are the right compromise: system browser, system cookies, inside your
app's task.

**★ How would you implement the loopback flow in a Java desktop tool?**
Bind a `ServerSocket` on port 0 to let the OS allocate an ephemeral port; build the
`redirect_uri` from `127.0.0.1` and the actual bound port; generate a `code_verifier` and
`state` and hold them in memory; open the authorization URL in the system browser with
`Desktop.browse`; accept exactly one connection, parse `code` and `state` out of the request
line, respond with a page telling the user to return to the app, and close the listener
immediately; validate `state`; exchange the code with the verifier. The two things people get
wrong are hard-coding the port and leaving the listener open after the flow.

**★ Your mobile app's login stopped working for new installs but works for existing users.
Where do you look?**
The claimed-`https` association file, if you use App Links or Universal Links. Verification
happens at install time on Android and is periodically refreshed on Apple platforms, so an
association file that became unreachable, was served with the wrong content type, or lost an
entry when the app's signing certificate rotated will break new installs while already-verified
installs keep working. The symptom is the callback opening in a browser instead of the app,
leaving a code in a URL with nothing to consume it.

---

← [Redirect URI exact matching](12-redirect-uri-exact-matching.md) · [Topic index](README.md) · Next → [The mix-up attack](13-the-mix-up-attack.md)
