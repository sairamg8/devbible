---
title: "The six APIs, and the ladder they form"
sidebar_label: "01 · The six APIs"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`prefetchDNS`](https://react.dev/reference/react-dom/prefetchDNS),
> [`preconnect`](https://react.dev/reference/react-dom/preconnect),
> [`preload`](https://react.dev/reference/react-dom/preload),
> [`preinit`](https://react.dev/reference/react-dom/preinit),
> [`preloadModule`](https://react.dev/reference/react-dom/preloadModule) and
> [`preinitModule`](https://react.dev/reference/react-dom/preinitModule).
> No sandbox script backs this page; claims are cited, not measured.

`react-dom` exports six functions that do nothing to your UI. They all take a URL, they all
return nothing, and each one asks the browser to get a little further ahead on a resource you
have not asked for yet.

They are easiest to hold as a **ladder**, because that is what they are: each rung does
everything the rung below does, and one thing more.

## The ladder

| Rung | Function | What the browser is asked to do | What you must know |
|---|---|---|---|
| 1 | `prefetchDNS(href)` | resolve the host's IP | the **host** |
| 2 | `preconnect(href)` | open a connection to the host | the **host** |
| 3 | `preload(href, {as})` | download the resource | the **exact URL** and its type |
| 4 | `preinit(href, {as})` | download **and evaluate** it | the exact URL, and that using it now is safe |

with two module-specific rungs beside 3 and 4:

| | Function | Documented as |
|---|---|---|
| 3′ | `preloadModule(href, {as: 'script'})` | *"lets you eagerly fetch an ESM module that you expect to use"* |
| 4′ | `preinitModule(href, {as: 'script'})` | *"lets you eagerly fetch and evaluate an ESM module"* |

**Two axes explain the whole set.** How far down the loading pipeline you push the browser
(DNS → connection → bytes → execution), and how much you know (a host → a specific URL). You
cannot skip: asking for step 4 when you only know the host is not a thing you can express.

## Rungs 1 and 2 — you only know the host

**`prefetchDNS`** — *"lets you eagerly look up the IP of a server that you expect to load
resources from."* The mechanism: *"provides the browser with a hint that it should look up the
IP address of a given server. If the browser chooses to do so, this can speed up the loading of
resources from that server."*

**`preconnect`** — *"provides the browser with a hint that it should open a connection to the
given server. If the browser chooses to do so, this can speed up the loading of resources from
that server."*

Both references carry the same two pieces of advice, and both are worth acting on.

🔴 **Neither helps for your own origin.** *"There is no benefit to preconnecting to the same
server the webpage itself is hosted from because it's already been connected to by the time the
hint would be given."* `prefetchDNS` says the same about *"prefetching the same server the
webpage itself is hosted from"*. These are third-party tools — the font CDN, the image host,
the analytics endpoint. Preconnecting to your own domain is a no-op you can find in a lot of
production code.

🔴 **If you know the resource, skip the rung.** *"If you know the specific resources you'll
need, you can call other functions instead that will start loading the resources right away."*
Both pages say it. A `preconnect` to a host you are about to `preload` from is redundant —
`preload` opens the connection on the way to fetching the bytes.

### Which of the two, and when

The `prefetchDNS` reference makes the only comparison either page offers:

> Compared with `preconnect`, `prefetchDNS` may be better if you are speculatively connecting to
> a large number of domains, in which case the overhead of preconnections might outweigh the
> benefit.

**So: a handful of hosts you are fairly confident about → `preconnect`. A long speculative list
→ `prefetchDNS`.** A connection is a real resource on both ends; a DNS lookup is cheap. That
sentence is the whole decision procedure, and it is the one thing about these two functions
worth memorising.

⬜ React gives no number for "a large number of domains", and this page does not invent one.

## Rung 3 — `preload`, you know the URL

> The `preload` function provides the browser with a hint that it should start downloading the
> given resource, which can save time.

`as` is **required**, and it is the interesting parameter — it is how the browser knows what
priority to give the fetch and which cache to put it in:

> a required string. The type of resource. Its possible values are `audio`, `document`, `embed`,
> `fetch`, `font`, `image`, `object`, `script`, `style`, `track`, `video`, `worker`.

The rest of the options are the `<link rel="preload">` attribute set, in React spelling:
`crossOrigin` (*"required when `as` is set to `"fetch"`"*), `referrerPolicy`, `integrity`,
`type`, `nonce`, `fetchPriority` (*"`auto` (the default), `high`, and `low`"*), and two that
exist only for images — `imageSrcSet` and `imageSizes`, both *"For use only with
`as: "image"`"*.

**The download happens; nothing else does.** The bytes land in the browser's cache and wait for
the element or the import that eventually needs them. That is the whole point of the rung: it
is safe, because nothing about your page changes.

## Rung 4 — `preinit`, you know the URL *and* you want it live

> `preinit` lets you eagerly fetch and evaluate a stylesheet or external script.

And, precisely:

> Scripts that you `preinit` are executed when they finish downloading. Stylesheets that you
> preinit are inserted into the document, which causes them to go into effect right away.

🔴 **This is the rung with consequences.** `preload` is an optimisation; `preinit` is a change
to the running page. A script you preinit runs — before the component that needed it renders,
possibly before the user has navigated anywhere near it. A stylesheet you preinit **applies**,
which means it can restyle what is currently on screen.

React states the fork twice, once from each side:

> If you want the browser to download the script but not to execute it right away, use
> `preload` instead.

> If you want to download the stylesheet but not to insert it into the document right away, use
> `preload` instead.

`as` narrows to two values here — *"Its possible values are `script` and `style`"* — because
those are the only two things "evaluate" means in a browser.

### `precedence`, and where it sits

> `precedence`: a string. Required with stylesheets. Says where to insert the stylesheet
> relative to others. Stylesheets with higher precedence can override those with lower
> precedence. The possible values are `reset`, `low`, `medium`, `high`.

**This is the same idea as the `precedence` prop on a hoisted `<link>`**
([topic 10 · 01](../10-document-metadata/01-hoisting.md)), and for the same reason: a stylesheet
that goes into effect immediately has to go somewhere specific in the cascade, and React will
not guess. Note the difference in how the two references document it — `preinit` enumerates four
values, while `<link>`'s `precedence` is documented only as *"a string"*. Topic 15 is where
`precedence` gets its own treatment; do not read the four names as the complete story until
then.

⚠️ **Required with stylesheets** means exactly that. There is no documented default, so a
`preinit` of a stylesheet without `precedence` is not a call you should be writing.

## The module pair

`preloadModule` and `preinitModule` are rungs 3 and 4 for ESM, and the wording is deliberately
parallel — *"start downloading the given module"* versus *"start downloading and executing the
given module ... Modules that you preinit are executed when they finish downloading."* The same
fork applies: *"If you want the browser to download the module but not to execute it right away,
use `preloadModule` instead."*

Their `as` is fixed: *"a required string. It must be `'script'`."* Options are the security set
only — `crossOrigin`, `integrity`, `nonce`. No `fetchPriority`, no `precedence`, nothing
image-shaped.

**Why a separate function at all?** Because a module is fetched and instantiated differently
from a classic script, and the browser needs to know which it is getting. It is the same
distinction as `<script type="module">` versus `<script>`, expressed as two function names
rather than an option.

## They all return nothing

Every one of the six references ends the Returns section the same way: *"`preload` returns
nothing."* — and the same for the other five.

That is not a detail, it is the design. **These are fire-and-forget hints, not promises.** You
cannot await one, cannot tell whether the browser acted on it, and cannot be notified when the
resource arrives. Every reference hedges the effect with *"If the browser chooses to do so"*.

Which sets the correct expectation: **a preload that turns out to be wrong costs bandwidth and
nothing else**, and a preload that turns out to be right saves a round trip you would otherwise
have started late. That asymmetry is why the hints are cheap to add and why they are worth
adding at the point where you know something the browser does not.

## Gotchas

**Symptom:** `preconnect` to your own origin does nothing measurable.
**Cause:** documented — *"There is no benefit to preconnecting to the same server the webpage
itself is hosted from"*. The connection already exists.
**Fix:** use it for third-party hosts, or drop the call.

**Symptom:** a `preinit`ed stylesheet changed the look of the page before the user navigated.
**Cause:** that is what `preinit` does. Stylesheets *"are inserted into the document, which
causes them to go into effect right away."*
**Fix:** use `preload` if you want the bytes without the effect.

**Symptom:** a `preinit`ed script's side effects ran too early.
**Cause:** *"Scripts that you `preinit` are executed when they finish downloading"* — not when
the component that needs them renders.
**Fix:** `preload` it and let the normal load path execute it.

**Symptom:** `preload` with `as: 'fetch'` is ignored or fails CORS.
**Cause:** `crossOrigin` *"is required when `as` is set to `"fetch"`"*.
**Fix:** pass `crossOrigin`.

**Symptom:** an `as: 'image'` preload downloads a different file than the `<img>` eventually
uses.
**Cause:** responsive images pick a candidate from the source set; a preload without
`imageSrcSet`/`imageSizes` describes a different request.
**Fix:** pass the same `imageSrcSet` and `imageSizes` — which is also what makes two calls
equivalent for de-duplication ([chunk 02](02-calling-them.md)).

**Symptom:** `preinit` of a stylesheet throws or misbehaves.
**Cause:** `precedence` is *"Required with stylesheets"* and has no documented default.
**Fix:** supply one of `reset`, `low`, `medium`, `high`.

## Interview questions

**★ What is the difference between `preload` and `preinit`?**
`preload` downloads; `preinit` downloads **and evaluates**. A preinited script executes when it
finishes downloading and a preinited stylesheet is inserted into the document and takes effect
immediately. React's own advice is explicit: if you want the bytes without the effect, use
`preload`.

**★ When would you choose `prefetchDNS` over `preconnect`?**
When you are speculatively connecting to a large number of domains. The reference says the
overhead of preconnections might then outweigh the benefit — a DNS lookup is cheap, a connection
is not. For a few hosts you are reasonably sure about, `preconnect` gets you further.

**★ Why is `as` required on `preload`?**
Because the browser needs the resource type to fetch it correctly — priority, CORS behaviour and
which cache it lands in all follow from it. It also gates two options: `crossOrigin` is required
for `as: 'fetch'`, and `imageSrcSet`/`imageSizes` are only meaningful for `as: 'image'`.

**★ Both `preconnect` and `preload` target the same host. Do you need both?**
No. Both the `preconnect` and `prefetchDNS` references say that if you know the specific
resources you need, call the functions that start loading them right away. `preload` subsumes
the connection step.

**★ Why do all six return nothing?**
They are hints, not operations — every reference qualifies the effect with *"If the browser
chooses to do so"*. There is nothing to await and no completion signal, which is what makes a
wrong guess cheap: wasted bandwidth, not a broken page.

**★ What does `precedence` do on `preinit`, and why is it required for stylesheets?**
It says where to insert the stylesheet relative to others — higher precedence can override
lower — with the documented values `reset`, `low`, `medium`, `high`. It is required because a
preinited stylesheet goes into effect immediately, so its position in the cascade has to be
decided at the call site rather than guessed.

---

← Index: [11 · Resource preloading](README.md) ·
Next → [Calling them: the rule that decides whether the call counts](02-calling-them.md)
