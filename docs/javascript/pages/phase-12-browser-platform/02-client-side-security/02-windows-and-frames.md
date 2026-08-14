---
title: "02.2 · Other windows and frames"
sidebar_label: "02 · Windows and frames"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), [`rel="noopener"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener), [`Window.opener`](https://developer.mozilla.org/en-US/docs/Web/API/Window/opener), [`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options), [`iframe` `sandbox`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox). Documentation-validated.

**The same-origin policy stops other pages reading yours — and then you punch holes in it on
purpose.** Every hole is a place where a security review actually finds something: a
`postMessage` listener with no origin check, a link that hands a stranger a handle to your
window, a page that can be framed.

## `postMessage` — the two checks nobody writes

MDN's security section is unusually blunt, and it is worth taking one clause at a time.

**Sending:**

> "**Always specify an exact target origin, not `*`, when you use `postMessage` to dispatch data
> to other windows.** A malicious site can change the location of the window without your
> knowledge, and therefore it can intercept the data sent using `postMessage`."

```js
iframe.contentWindow.postMessage(payload, "https://widget.example.com");  // ✅
iframe.contentWindow.postMessage(payload, "*");                            // ❌
```

🔴 **`"*"` means "whoever is in that window now"** — and you do not control that. A frame you
navigated, or one whose content redirected, receives whatever you send. It is the single most
common `postMessage` mistake because `"*"` is what makes the example work.

**Receiving** — MDN gives three rules, and the third is the one people skip:

> "If you do not expect to receive messages from other sites, *do not* add any event listeners
> for `message` events. This is a completely foolproof way to avoid security problems."

> "If you do expect to receive messages from other sites, **always verify the sender's identity**
> using the `origin` and possibly `source` properties. **Any window** (including, for example,
> `http://evil.example.com`) **can send a message to any other window** within the iframe
> hierarchy from top to every iframe below of the current document."

> "Having verified identity, however, you still should **always verify the syntax of the received
> message**. Otherwise, a security hole in the site you trusted to send only trusted messages
> could then open a cross-site scripting hole in your site."

```js
window.addEventListener("message", (event) => {
  if (event.origin !== "https://widget.example.com") return;   // 1. identity
  if (event.source !== iframe.contentWindow) return;           // 2. the window you expect
  const data = parseAndValidate(event.data);                   // 3. syntax — still required
  if (!data) return;
  …
});
```

🔴 **A `message` listener is a globally reachable entry point into your page.** Anyone who can
open your site in a frame or a popup can post to it. A listener that does `eval(event.data)`, or
`element.innerHTML = event.data`, is a cross-site scripting hole with extra steps — and the
origin check alone does not save you, which is exactly why MDN adds the third rule.

## `window.opener` — the handle you give away

MDN:

> "The **`noopener`** keyword … instructs the browser to navigate to the target resource
> **without granting the new browsing context access to the document that opened it** — by not
> setting the `Window.opener` property on the opened window (it returns `null`)."

> "especially useful when opening untrusted links, in order to ensure they cannot tamper with the
> originating document via the `Window.opener` property"

Without it, the opened page holds a reference to your window. It cannot *read* your page
cross-origin — the same-origin policy still applies — but it can **navigate** it:
`window.opener.location = "https://phishing.test/login"`. The user clicks a link, glances at the
new tab, comes back, and your site is now a convincing login page they never left.

**The good news, quoted directly:**

> "**Note:** Setting `target="_blank"` on `<a>`, `<area>` and `<form>` elements implicitly
> provides the same `rel` behavior as setting `rel="noopener"` which does not set
> `window.opener`."

🔴 **So `target="_blank"` is safe by default in modern browsers — but `window.open()` is not.**
The implicit behaviour is defined for those elements, not for the scripted call:

```js
const w = window.open(untrustedUrl, "_blank", "noopener");   // ✅ explicit
const w = window.open(untrustedUrl, "_blank");               // ⚠️ opener is set
```

Note that with `noopener` the call returns `null`, so you cannot keep talking to the popup —
which is the trade, and the reason people leave it off.

**Still write `rel="noopener noreferrer"` on user-generated links.** `noopener` is belt and
braces on old browsers, and `noreferrer` additionally withholds the `Referer` header, which is
usually what you want when linking somewhere you do not trust.

## Clickjacking — your page inside someone else's

The attack: your page is loaded in a transparent frame over a decoy, and the user's click lands
on your "confirm payment" button while they believe they are clicking something else. Nothing in
your JavaScript can see this.

MDN on the defence:

> "The HTTP `X-Frame-Options` response header can be used to indicate whether a browser should be
> allowed to render the document in a `<frame>`, `<iframe>`, `<embed>` or `<object>`. Sites can
> use this to avoid **clickjacking** attacks and some cross-site leaks, by ensuring that their
> content is not embedded into other sites."

The two directives that exist:

- **`DENY`** — "The document cannot be loaded in any frame, regardless of origin (both same- and
  cross-origin embedding is blocked)."
- **`SAMEORIGIN`** — "The document can only be embedded if all ancestor frames have the same
  origin as the page itself."

⚠️ **`ALLOW-FROM` is obsolete.** MDN: the CSP header *"has a `frame-ancestors` directive which
you should use instead"*, and for anything beyond the two simple cases *"see the `frame-ancestors`
directive"*. So the modern answer is `Content-Security-Policy: frame-ancestors 'none'` (or a
specific origin list), with `X-Frame-Options` alongside it for older clients.

🔴 **This is a server header, and therefore not something a SPA can fix in its own code.** The
JavaScript-side "frame-busting" scripts of the 2000s (`if (top !== self) top.location = self.location`)
are defeated by `sandbox` and were never reliable. Recognising that the fix is a header — and
whose header it is — is the useful knowledge here.

## Framing someone else: `sandbox`

The reverse direction. When you embed third-party content, `sandbox` removes capabilities by
default and you add back only what is needed:

```html
<iframe src="https://widget.example.com" sandbox="allow-scripts allow-forms"></iframe>
```

A sandboxed frame gets a unique opaque origin, cannot submit forms, run scripts, open popups or
navigate the top-level browsing context, unless the corresponding `allow-*` token is present.

⚠️ **`sandbox="allow-scripts allow-same-origin"` together on same-origin content undoes the
sandbox** — the frame regains its real origin *and* can run scripts, so it can reach out and
remove its own sandbox attribute. It is the combination to look for in a review.

## Gotchas

**Symptom:** Data sent to an iframe reaches an unexpected site
**Cause:** `postMessage(data, "*")`. MDN: a malicious site *"can change the location of the
window without your knowledge."*
**Fix:** Pass the exact target origin.

**Symptom:** A `message` listener is triggered by a site you never integrated with
**Cause:** *"Any window … can send a message to any other window"* in the frame hierarchy.
**Fix:** Check `event.origin`, and `event.source` where you have the reference.

**Symptom:** An origin check is in place and XSS still happens through a message
**Cause:** The payload was trusted after the origin check and passed to a sink.
**Fix:** MDN's third rule — *"always verify the syntax of the received message."*

**Symptom:** Returning to a tab shows a fake login page on your own site
**Cause:** An opened page used `window.opener.location` to navigate you.
**Fix:** `rel="noopener"`, and `window.open(url, "_blank", "noopener")` for scripted opens.

**Symptom:** `window.open(...)` returns `null` after adding `noopener`
**Cause:** That is the defined behaviour — you gave up the handle.
**Fix:** Expected. Communicate via `postMessage` from the opened page, or keep the opener when
the target is your own trusted origin.

**Symptom:** Users confirm actions they say they never clicked
**Cause:** Clickjacking — your page framed under a decoy.
**Fix:** `Content-Security-Policy: frame-ancestors 'none'` (plus `X-Frame-Options` for old
clients). A server header, not client code.

**Symptom:** A frame-busting script does not work
**Cause:** `sandbox` can block top-level navigation, and the technique was never reliable.
**Fix:** Use the headers.

**Symptom:** A sandboxed frame behaves as if unsandboxed
**Cause:** `allow-scripts` and `allow-same-origin` together on same-origin content lets it
remove its own sandbox.
**Fix:** Never combine those two for content you do not fully control.

## Interview questions

**★ Why is `postMessage(data, "*")` dangerous?**
Because the target window's location can change without your knowledge — MDN: *"A malicious site
can change the location of the window … and therefore it can intercept the data sent using
`postMessage`."* Always name the exact target origin.

**★ What are the three checks on a `message` listener?**
Verify the sender's identity via `event.origin` (and `event.source` where available); verify the
*syntax* of the payload even after that, because a trusted site with its own hole would otherwise
open one in yours; and — MDN's first suggestion — do not register the listener at all if you do
not expect cross-site messages.

**★ What is `window.opener` and why does `noopener` exist?**
A reference the opened page holds to the page that opened it. It cannot read your page
cross-origin, but it can **navigate** it — the tab-nabbing phishing flow. `noopener` *"instructs
the browser to navigate to the target resource without granting the new browsing context access to
the document that opened it."*

**★ Is `target="_blank"` still a vulnerability?**
Not in modern browsers: MDN states that setting it on `<a>`, `<area>` and `<form>` *"implicitly
provides the same `rel` behavior as setting `rel="noopener"`."* **`window.open()` is not covered**
— pass `"noopener"` in its features string. Keep writing `rel="noopener noreferrer"` on
user-generated links regardless.

**★ How do you stop your page being clickjacked?**
A response header — `Content-Security-Policy: frame-ancestors`, with `X-Frame-Options:
DENY`/`SAMEORIGIN` for older clients. MDN marks `ALLOW-FROM` obsolete and points at
`frame-ancestors`. It cannot be fixed in client JavaScript; frame-busting scripts are unreliable.

**★ What is wrong with `sandbox="allow-scripts allow-same-origin"`?**
On same-origin content it defeats the sandbox: the frame has its real origin and can run scripts,
so it can remove its own `sandbox` attribute.

**Which of these can a SPA fix by itself?**
The `postMessage` checks and the `noopener` behaviour — those are its own code. Clickjacking
needs a header from whoever serves the document.

---

← [01 · The trust boundary](./01-the-trust-boundary.md) · [Topic index](./README.md) ·
Next → [03 · Storage, dependencies and depth](./03-storage-and-dependencies.md)
