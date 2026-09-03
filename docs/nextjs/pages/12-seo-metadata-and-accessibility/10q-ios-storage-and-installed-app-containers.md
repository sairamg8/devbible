---
title: "Safari puts a seven-day fuse on everything a script wrote, and the only way off it is an installed app that also cannot see the session the user just signed in with"
sidebar_label: "10q · iOS storage and app containers"
sidebar_position: 23
description: "The seven-day script-writable storage cap, what it covers, the Home Screen carve-out, and the separate storage container that logs users out the moment they install."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against WebKit's
> [Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)
> and [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
> Target: **Next.js 16.3.4**; browser floor **Safari 16.4+**.
> Documentation-verified; **no sandbox run**.

**Two WebKit storage decisions decide whether a PWA on iOS is a real app or a page with an
icon, and they pull in opposite directions. One deletes your service worker caches after a week
of disuse unless the app is installed. The other gives the installed app a storage container
that does not contain the session the user established in Safari five seconds earlier.** Both
are documented, neither has a code workaround, and both have to be designed around rather than
fixed. This continues [10p](10p-ios-and-safari-limits.md).

## The seven-day storage cap, and the carve-out that saves you

Safari deletes **all** of a site's script-writable storage after seven days of Safari use
without user interaction on that site. WebKit's own list of what that covers includes IndexedDB,
LocalStorage, SessionStorage, media keys, and — the one that matters here — **service worker
registrations and their caches**.

Read that as: on iOS, in a browser tab, your carefully built offline experience has a
seven-day fuse, reset only by the user actually visiting.

The carve-out is the reason installation is the whole game. Home Screen web apps run
independently of Safari with their own counter of days of use, which tracks actual use of the
web app rather than of Safari. WebKit's conclusion:

> *"We do not expect the first-party in such a web application to have its website data deleted."*

So an installed app's caches persist under normal use, and an uninstalled one's do not. If your
offline story is load-bearing for iOS users, the install prompt is not a growth feature — it is
the mechanism.

## The separate storage container

A Home Screen web app on iOS gets its own storage, distinct from Safari's. The practical
consequence lands on your first-run experience: **a user who is signed in inside Safari is
signed out the moment they open the installed app**, because the session cookie is in the other
container. They tapped an icon expecting their app and got a login screen.

There is no way to migrate it. What you can do is expect it:

- Put the install prompt *after* sign-in, not before, so the user has credentials fresh in mind.
- Make sure `start_url` lands somewhere that handles being unauthenticated gracefully — a login
  screen with your branding, not a redirect chain.
- If you use a magic-link or OAuth flow, verify it completes inside the standalone window;
  see the authentication patterns in
  [authentication patterns](../10-forms-authentication-and-security-hardening/03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md).


## Gotchas

### An offline experience on iOS that has not been installed
**Symptom.** Offline works in testing and users report it stopping after about a week.
**Cause.** Safari's seven-day script-writable storage cap covers service worker registrations
and their caches, and it is reset only by user interaction with the site in Safari.
**Fix.** There is no code fix — the mechanism is installation, which moves the app into a
container with its own usage counter and, per WebKit, is not expected to have its data deleted.
Promote installation to anyone whose offline experience you care about, and design the browser
tab experience to degrade to online-only.

### Users installing and finding themselves logged out
**Symptom.** Support tickets immediately after you start promoting installation.
**Cause.** The Home Screen web app has a storage container separate from Safari's, so the
session cookie does not come with it.
**Fix.** Prompt for installation after sign-in, land `start_url` on a route that handles being
unauthenticated well, and test the whole auth flow inside the standalone window rather than in
a tab.


## Interview questions

**★ What is Safari's seven-day storage rule and what does it do to a PWA?**
Safari deletes all of a site's script-writable storage after seven days of Safari use without
user interaction on that site — and WebKit's own list of what that covers includes service
worker registrations and their caches. So an offline experience built for iOS users browsing in
a tab has a one-week fuse. Home Screen web apps are the carve-out: they run with their own
counter of days of use, and WebKit states it does not expect such an app's first-party data to
be deleted.

**★ A user installs your app on iOS and is immediately logged out. Why?**
Because a Home Screen web app has a storage container separate from Safari's, so the session
cookie stays behind in Safari. There is no migration path. The mitigations are ordering and
design: promote installation after sign-in, make `start_url` a route that handles an
unauthenticated visitor well, and validate the entire auth flow inside the standalone window
rather than in a tab.

---

← [10p · iOS and Safari limits](10p-ios-and-safari-limits.md) · [Chapter 12 overview](01-explanation.md) · Next → [10r · The offline write queue](10r-the-offline-write-queue-and-the-durable-outbox.md)
