---
title: "Since 15.2 a dynamic route's metadata is appended to the body after the UI, and the only reason your Slack unfurl still works is a User-Agent list you did not know existed"
sidebar_label: "01e · Streaming metadata and HTML-limited bots"
sidebar_position: 5
description: "What streaming metadata changes about where tags land, the HTML-limited bot list that gets blocking metadata instead, how htmlLimitedBots overrides rather than extends it, when to disable streaming entirely, and why prerendered routes never stream."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
> section *Streaming metadata* (page `lastUpdated: 2026-08-25`);
> [`htmlLimitedBots`](https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots)
> (`2025-10-03`); and
> [Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
> (`2026-08-25`).
> Target: **Next.js 16.3.4**; streaming metadata introduced in **15.2.0**.
> Documentation-verified — **no sandbox run**.

**Before 15.2, a slow `generateMetadata` held the entire response: nothing reached the browser
until the metadata resolved, because the tags had to be in `<head>` and `<head>` comes first.
Since 15.2 that trade is off by default — Next sends the UI immediately and appends the
metadata tags to the `<body>` when they resolve. That is safe for anything that runs JavaScript
and builds a DOM, and catastrophic for anything that only reads the raw HTML looking for a
`<head>`. So Next keeps a list of user agents that get the old blocking behaviour, decides by
User-Agent header, and exposes exactly one knob over it. Understanding that split is the
difference between "our TTFB improved" and "our link previews stopped working on one channel".**

## The two paths

For a **dynamically rendered** route:

- **Ordinary browsers and JavaScript-executing crawlers** get the UI first. When
  `generateMetadata` resolves, the resulting tags are appended to the `<body>` tag. Vercel state
  they verified that bots which execute JavaScript and inspect the full DOM — Googlebot is the
  named example — interpret this correctly.
- **HTML-limited bots** — agents that cannot execute JavaScript and expect metadata in
  `<head>` — get the pre-15.2 behaviour: metadata blocks the render, and the tags are in
  `<head>` when the document arrives.

For a **prerendered** route, none of this applies. Metadata is resolved at build time and is
simply part of the HTML. Streaming metadata is a property of the dynamic path only.

That last sentence is the practical takeaway for most sites: **if your marketing and content
pages are prerendered, streaming metadata never touches them.** It is a dynamic-rendering
feature, and it matters most on exactly the routes you were least likely to have thought about
crawlers for.

## The bot list

Detection is by User-Agent header, against a list Next ships. The documented examples are:

- Google crawlers — `Mediapartners-Google`, `AdsBot-Google`, `Google-PageRenderer`
- `Bingbot`
- `Twitterbot`
- `Slackbot`

The full list lives in the Next source at
`packages/next/src/shared/lib/router/utils/html-bots.ts`, which the docs link. Note the shape
of that list: the agents on it are largely **unfurlers** — the things that turn a pasted link
into a card in a chat client — plus ad crawlers. Those are precisely the consumers that read
raw HTML and never build a DOM.

Googlebot itself is *not* in that category; it renders. Which is why the streaming default is
defensible at all: the crawler whose opinion determines your ranking is the one that handles
the appended tags.

## `htmlLimitedBots` overrides — it does not extend

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  htmlLimitedBots: /MySpecialBot|MyAnotherSpecialBot|SimpleCrawler/,
}

export default config
```

🔴 **Setting this replaces the built-in list entirely.** The reference says so directly, and it
is the trap: someone adds their partner's crawler to the list, ships it, and silently removes
Slackbot, Twitterbot, Bingbot and the Google ad crawlers from blocking treatment. The unfurl in
the company Slack breaks a week later and nobody connects it to a config change.

If you must add an agent, add it *to* the default rather than replacing it — which means
writing a regex that includes the defaults you care about:

```ts
// next.config.ts — additive by hand, because the option is not additive
const DEFAULTS = 'Mediapartners-Google|AdsBot-Google|Google-PageRenderer|Bingbot|Twitterbot|Slackbot'

const config: NextConfig = {
  htmlLimitedBots: new RegExp(`${DEFAULTS}|PartnerCrawler|LinkPreviewBot`),
}
```

⚠️ That constant is a **hand-maintained copy** of a list that lives in the framework and can
change between releases. Write down where it came from, and re-check it on a major upgrade. The
docs' own advice is that overriding is advanced behaviour and the default suffices for most
cases — take that seriously before you reach for it.

## Turning streaming off entirely

```ts
// next.config.ts
const config: NextConfig = {
  htmlLimitedBots: /.*/,
}
```

A regex matching every user agent means every request is treated as HTML-limited, so metadata
always blocks and always lands in `<head>`. This is the documented way to disable the feature.

When it is the right call:

- You have a real, reproducible consumer that reads raw HTML and is not on the list — an
  internal scraper, an enterprise proxy that generates previews, a partner integration.
- You are debugging a metadata problem and want to remove streaming as a variable.

What it costs: the reference is explicit that overriding can lead to longer response times, and
that streaming metadata reduces TTFB and can help LCP. You are trading a measurable
first-paint regression on every dynamic route for a correctness guarantee against unknown
agents. Usually the better trade is to make the route prerenderable instead — which removes
streaming from the picture without slowing anything down.

## What this changes about debugging

Two habits stop working:

**"View source and look at the head."** On a dynamically rendered route requested from a normal
browser, the metadata is not in `<head>` in the raw HTML — it is appended to `<body>`. The
DevTools Elements panel shows the live DOM, where the tags have been hoisted by React and look
normal, so the panel and `curl` disagree. Neither is lying.

**`curl` with a default user agent.** `curl` sends `curl/8.x`, which is not on the bot list, so
you get the streaming path — the one no unfurler will ever see. To reproduce what a link
preview gets, send an agent that is on the list:

```bash
# What a browser-ish client gets: metadata appended to the body
curl -s https://sprintdesk.app/board/abc | head -c 2000

# What an unfurler gets: metadata blocking, in the head
curl -s -A 'Slackbot-LinkExpanding 1.0' https://sprintdesk.app/board/abc | head -c 2000
```

This is the same class of problem as the crawler render path in
[05 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md):
**the response depends on the User-Agent header, so a single-agent test proves nothing about
the other path.**

## Gotchas

**★ Setting `htmlLimitedBots` deletes the default list.** It overrides, it does not extend. The
symptom is delayed and confusing: link previews in Slack or on X quietly stop resolving for
dynamic routes, weeks after an unrelated-looking config change. If you must extend it, re-state
the defaults in your regex and note where you copied them from.

**★ `curl` without a `-A` flag tests the path no unfurler uses.** The default `curl` agent is
not on the bot list, so you see the streaming behaviour. Every "the og tags aren't in the head"
investigation that starts with a plain `curl` starts by measuring the wrong thing.

**★ The Elements panel and view-source disagree, and both are correct.** React hoists the
appended tags in the live DOM; the raw bytes have them after the body content. Judge crawler
behaviour from the bytes, not the panel.

**★ Streaming metadata does not apply to prerendered routes at all.** If you are looking for
streamed tags on a static page and not finding them, nothing is broken — metadata was resolved
at build time and is in the head. Conversely, do not assume you are safe because you tested a
static route; the dynamic ones behave differently.

**★ Disabling streaming globally regresses TTFB and LCP on every dynamic route.** The docs say
so. It is a real cost paid on all traffic to fix a problem that usually affects one agent. Fix
the agent, or make the route prerenderable.

**★ A slow `generateMetadata` is still slow for the bots that matter for unfurls.** Streaming
hides the latency from browsers; the HTML-limited agents still wait for it. If your OG previews
time out in a chat client, streaming did not help you — cache the metadata
([01f](01f-metadata-under-cache-components.md)).

**★ The bot list is a User-Agent list, so anything that spoofs a browser gets the streamed
path.** There is no way to opt an unknown agent in except by pattern. If a partner's scraper
sends a Chrome user agent and reads raw HTML, it will never see your metadata and no
configuration can detect it.

## Interview questions

**★ Where do metadata tags physically appear in the HTML of a dynamically rendered route, and
why does that not break Google?**
Appended to the `<body>` element, after the UI, when `generateMetadata` resolves. It does not
break Google because Googlebot executes JavaScript and inspects the finished DOM, where React
has hoisted those tags into the head — the docs state this was verified. It *would* break an
agent that only parses the raw bytes looking for a head, which is why those agents are detected
separately and given blocking metadata.

**★ What exactly does `htmlLimitedBots` do, and what is the trap?**
It sets the regex of user agents that receive blocking metadata instead of streamed metadata.
The trap is that it replaces the built-in list rather than adding to it, so naming one extra
crawler removes Slackbot, Twitterbot, Bingbot and the Google ad crawlers from that treatment.
The failure is delayed and looks nothing like a config bug.

**★ Your OG image works when you paste the link into Slack but the `og:` tags are not in the
HTML you `curl`. Explain.**
`curl`'s default user agent is not on the HTML-limited list, so your request took the streaming
path and the tags were appended to the body. Slackbot is on the list, so its request took the
blocking path and got the tags in the head. Reproduce Slack's view by passing its user agent
with `-A`.

**★ When is `htmlLimitedBots: /.*/` the right answer?**
When you have an identified consumer that reads raw HTML, cannot execute JavaScript, and is not
on the default list — an internal indexer, an enterprise link-preview proxy, a partner
integration. It is a blunt fix: every request now blocks on metadata, which the docs note
costs response time, and streaming exists to improve TTFB and LCP. Making the route
prerenderable achieves the same correctness with no latency cost, and is the better answer
whenever it is available.

**★ Does streaming metadata affect a statically generated blog post?**
No. Prerendered routes resolve metadata at build time and ship it in the head. Streaming is
purely a dynamic-rendering behaviour. This is worth knowing in both directions: it means most
content sites are unaffected, and it means testing a static route tells you nothing about how
your dynamic ones behave.

**★ A dynamic product page's `generateMetadata` takes 800ms. Who feels it?**
Every HTML-limited bot — every link unfurl, every ad crawler — waits the full 800ms, because
their path still blocks. Browsers do not, because they get the UI first. So streaming has moved
the cost onto exactly the consumers with the tightest timeouts. The fix is to make the metadata
cacheable rather than to tune the streaming behaviour.

---

← [`metadataBase` and the parent promise](01d-metadatabase-url-composition-and-the-parent-promise.md) · [Chapter 12 overview](01-explanation.md) · Next → [Metadata under Cache Components](01f-metadata-under-cache-components.md)
