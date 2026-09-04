---
title: "Code injection is the attack where every check the authorization server performs passes, because the attacker is not impersonating your client — they are using it, correctly authenticated, as the instrument that redeems a code they stole"
sidebar_label: "11 · Code injection"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against RFC 9700 §4.5 (Authorization Code Injection), §4.5.1 (Attack
> Description), §4.5.3 (Countermeasures), §4.5.3.1 (PKCE), §4.5.3.2 (Nonce), §2.1.1
> (Authorization Code Grant), §4.6 (Access Token Injection)
> ([datatracker.ietf.org/doc/html/rfc9700](https://datatracker.ietf.org/doc/html/rfc9700));
> RFC 6749 §4.1.3 (Access Token Request)
> ([rfc-editor.org/rfc/rfc6749](https://www.rfc-editor.org/rfc/rfc6749.txt)); OpenID Connect
> Core 1.0 §3.1.2.1 (`nonce`), §3.1.3.7 (ID Token Validation)
> ([openid.net](https://openid.net/specs/openid-connect-core-1_0.html)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x.

**A confidential client with a client secret and a validated `state` is still vulnerable to
this, and that is the whole point of the chunk. The attacker does not need to authenticate as
your client, because they get *your* client — correctly authenticated, with its correct secret,
in a flow it correctly started — to redeem a code that belongs to a different account. This is
the specific reason RFC 9700 recommends PKCE for confidential clients, and it is the reason
"we have a client secret, so we do not need PKCE" is wrong.**

## The attack

RFC 9700 §4.5.1, step by step:

1. **The attacker obtains an authorization code.** By any of the routes in this topic:
   interception on a public client, a `Referer` leak (§4.2), browser history on a shared device
   (§4.3), an open redirector (§4.1), a mix-up (§4.4), or a leaked log. The code belongs to the
   **victim's** account.
2. **The attacker starts a legitimate OAuth flow at your client, in their own browser.** They
   click "Sign in", get redirected, authenticate as themselves — or do not even need to; they
   just need the client to have an authorization request pending in their session.
3. **They replace the code in the authorization response with the stolen one.** They control
   their own browser, so this is trivial: intercept the redirect and edit the query string
   before it hits your callback.
4. **Your client sends the injected code to the token endpoint** with its own client
   credentials and its own `redirect_uri`.
5. **The authorization server checks everything.** Client authentication: valid. Code issued to
   this `client_id`: yes. `redirect_uri` matches: yes. Code not expired, not used: yes.
6. RFC 9700's own words: *"All checks succeed and the authorization server issues access and
   other tokens to the client."*
7. **Your client now holds the victim's tokens, in the attacker's session.** The attacker reads
   the victim's data through your application's own UI.

Two things to notice.

**`state` matched.** The attacker started that flow, so the `state` in the response is the one
your client stored for the attacker's session. The CSRF check passes correctly. See
[10b · `state` vs PKCE](10b-state-vs-pkce.md).

**The client secret was used correctly.** It authenticated the client, which is what it is for.
It has nothing to say about *which code* the client is presenting.

## Why PKCE stops it

RFC 9700 §4.5.3.1:

> *"When the attacker attempts to inject an authorization code, the check of the `code_verifier`
> fails: the client uses its correct verifier, but the code is associated with a
> `code_challenge` that does not match this verifier."*

The mechanism is worth stating precisely, because it is the cleanest illustration of what PKCE
actually binds:

- The **victim's** code is bound to the **victim's** flow's `code_challenge`.
- Your client, in the **attacker's** session, holds the **attacker's** flow's `code_verifier`.
- The token endpoint recomputes `BASE64URL-ENCODE(SHA256(ASCII(attacker_verifier)))` and
  compares it to the challenge stored with the victim's code. They differ. → `invalid_grant`.

PKCE binds the code to *the authorization request that produced it*, not to a client identity.
The attacker cannot supply the victim's verifier because it never left the victim's client
session, and cannot derive it from the challenge because `S256` is one-way.

Note this is also why `plain` is inadequate here: if the attacker could read the victim's
authorization request, `plain` hands them the verifier along with the challenge.

## Why the OIDC `nonce` also stops it

RFC 9700 §4.5.3.2:

> *"If an attacker injects an authorization code in the authorization response, the nonce value
> in the client session and the `nonce` value in the ID Token received from the token endpoint
> will not match, and the attack is detected."*

Same shape, different carrier. The client puts a random `nonce` in the authorization request and
stores it in the session; the authorization server binds it to the code and copies it into the
ID token it issues; the client compares. An injected code produces an ID token carrying the
*victim's* nonce, which does not match the attacker session's stored nonce.

This is why RFC 9700 §2.1.1 offers confidential OIDC clients a choice — *"confidential OpenID
Connect clients MAY use the `nonce` parameter"* — rather than a bare PKCE requirement. It is
also why the requirement in §2.1.1 covers both: *"In any case, the PKCE challenge or OpenID
Connect `nonce` MUST be transaction-specific and securely bound to the client and the user agent
in which the transaction was started."*

The `nonce` mechanism, ID token validation and the `at_hash` claim belong to **07 · OpenID
Connect** *(not written yet)*. What matters here is that it is an *alternative* to PKCE for this
one attack, not an addition you get for free.

## The access-token variant

RFC 9700 §4.6 describes the same idea one step later: injecting a stolen *access token* into a
client that receives tokens in the authorization response — i.e. the implicit and hybrid flows.
The countermeasure there is the OIDC `at_hash` claim:

> *"The authorization response additionally contains an ID Token containing the `at_hash` claim.
> The attacker therefore needs to replace both the access token as well as the ID Token."*

Which is a mitigation, not a fix, and is part of why response types that return access tokens
on the front channel are discouraged — **16 · The implicit
grant** *(not written yet)*.

## The normative wording, stated exactly

Because this is the chunk that most tempts overstatement, RFC 9700 §2.1.1 in full where it
matters:

> *"Clients MUST prevent authorization code injection attacks ... and misuse of authorization
> codes using one of the following options: Public clients MUST use PKCE [RFC7636] to this
> end"*; *"For confidential clients, the use of PKCE [RFC7636] is RECOMMENDED"*; *"confidential
> OpenID Connect clients MAY use the `nonce` parameter"*.

So: the MUST on *preventing the attack* covers all clients. The MUST on *using PKCE
specifically* covers public clients. Confidential clients get a RECOMMENDED for PKCE and a MAY
for `nonce` — but they still have to prevent the attack by one of those means. Saying "RFC 9700
requires PKCE for everyone" overstates it; saying "confidential clients do not need to worry" is
worse, because the MUST at the top of the list applies to them.

## Gotchas

**★ A client secret does not defend against code injection.**
It authenticates the client, and in this attack the client is the *victim*, not the
impersonator. Every client-authentication check passes. This is the single most common reason
teams conclude they do not need PKCE on a server-side app.

**★ A correct `state` check does not defend against code injection.**
The attacker started the flow, so `state` is legitimately theirs. The check passes by design.

**★ PKCE and `nonce` are alternatives for *this* attack, not for every attack.**
`nonce` requires an ID token, so it only exists for OIDC flows, and it only detects the
injection *after* the token exchange has already happened — the tokens were issued and must now
be discarded. PKCE fails the exchange, so no tokens are ever minted. If you have the choice,
PKCE fails earlier.

**★ Detecting the injection after the fact still means tokens were issued.**
With `nonce`, the authorization server has already minted an access token and possibly a refresh
token for the victim before the client notices the mismatch. Your client must discard them and
should treat the event as a security incident — ideally revoking them (RFC 7009), which is topic
05's material.

**★ If the client does not validate the `nonce`, having sent it achieves nothing.**
This is a real and common defect: libraries send `nonce` because OIDC says to, and application
code never checks it, because the check lives in ID token validation which somebody stubbed out.
OIDC Core §3.1.3.7 makes the client's comparison a requirement, not an option.

**★ The attacker needs a code from somewhere, so every leak path in this topic feeds this
attack.**
Referrer leakage, browser history, open redirectors, mix-up, logs. Fixing code injection with
PKCE does not make those leaks harmless — a leaked code is still redeemable by a public client
with no PKCE, and is still a correlation record.

**★ "We validate that the code belongs to the right user" is not something a client can do.**
The client cannot inspect the code; it is opaque. There is no client-side check that
distinguishes an injected code from a legitimate one. The binding has to be enforced by the
authorization server, which is exactly what PKCE arranges.

**★ This attack survives a perfect TLS setup.**
Nothing in it involves reading the wire. The attacker uses their own browser and their own
session throughout.

## Interview questions

**★ What is authorization code injection, and why does a client secret not prevent it?**
The attacker obtains an authorization code belonging to a victim, starts their own legitimate
flow at the target client, and substitutes the stolen code into the authorization response
before the client's callback processes it. The client then redeems the victim's code with its
own correct credentials, and per RFC 9700 §4.5.1 *"All checks succeed and the authorization
server issues access and other tokens to the client"* — which the attacker then reads through
the client's own interface. The client secret does not help because the client is not being
impersonated; it is being used. Client authentication answers "who is asking", and the attack
does not lie about that.

**★ Why is PKCE the countermeasure, given that PKCE was designed for public clients?**
Because PKCE binds the code to the specific authorization request that produced it, not to a
client identity. The stolen code carries the victim's `code_challenge`; the client, sitting in
the attacker's session, holds the attacker's `code_verifier`. RFC 9700 §4.5.3.1: *"the client
uses its correct verifier, but the code is associated with a `code_challenge` that does not
match this verifier."* That binding is exactly what a confidential client lacks otherwise —
which is why §2.1.1 says PKCE is RECOMMENDED for confidential clients rather than treating the
secret as sufficient.

**★ Is the OIDC `nonce` as good as PKCE here?**
It detects the same attack by a different route: the ID token returned for the injected code
carries the victim's `nonce`, which will not match the value stored in the attacker's client
session, so the client rejects the login. RFC 9700 §2.1.1 explicitly permits confidential OIDC
clients to use it. It is weaker in two practical ways: it only exists in OIDC flows, and it
detects the injection *after* the authorization server has already issued tokens, which the
client must then discard and ideally revoke. PKCE fails the token request, so nothing is ever
issued. And it only works if the client actually validates the `nonce`, which a surprising
amount of code does not.

**★ Exactly what does RFC 9700 require of a confidential client here?**
That it prevent the attack — §2.1.1 opens with *"Clients MUST prevent authorization code
injection attacks ... using one of the following options"* — and then gives it two acceptable
options: PKCE, which is RECOMMENDED, or the OIDC `nonce`, which confidential OIDC clients MAY
use. The blanket MUST-use-PKCE applies to public clients only. Getting the modality right
matters: overstating it as "the RFC mandates PKCE for everyone" is wrong, and understating it as
"confidential clients are exempt" is worse, because the obligation to prevent the attack applies
to every client.

**★ You have found a code in an application log from six months ago. Is that a problem?**
The code itself is long expired and single-use, so it is not directly redeemable. It is still a
finding for three reasons: it correlates a user, a client and a timestamp; it demonstrates that
your logging pipeline captures credentials, which means live codes are in the same pipeline
right now; and a live code from that pipeline is precisely the input this attack needs. Fix the
logging, not the old entries — and check whether the same pipeline captures `Authorization`
headers or token responses.

---

← [state vs PKCE](10b-state-vs-pkce.md) · [Topic index](README.md) · Next → [Redirect URI exact matching](12-redirect-uri-exact-matching.md)
