---
title: "Performance & Scalability Patterns: Rendering Strategy & Caching Layers"
sidebar_label: "Performance & Scalability Patterns"
sidebar_position: 1
---

# 🏛️ Performance & Scalability Patterns: Rendering Strategy & Caching Layers

## 1. The Decision Framework

Choosing a rendering strategy per route (not per app — different routes genuinely warrant different strategies) is one of the highest-leverage architectural decisions available, directly trading off freshness, personalization, and infrastructure cost.

```
                    Does this page's content differ PER USER (personalized/authenticated)?
                                        │
                    ┌───────YES─────────┴─────────NO──────────┐
                    ▼                                          ▼
                  SSR                              Is the content the SAME for
        (Server-Side Rendering)                      every visit, changing RARELY?
        rendered FRESH, per request,                          │
        personalized correctly           ┌──────YES───────────┴──────NO (highly interactive)──┐
                                          ▼                                                     ▼
                                   STATIC / ISR                                              CSR
                          pre-rendered once (or periodically           (Client-Side Rendering)
                          revalidated) — marketing pages,          rendered entirely client-side —
                          blog posts, product catalogs               apps BEHIND auth where SEO/initial
                                                                        load speed matters less than
                                                                        rich, ongoing interactivity
```

### Micro-Frontends: A Real Cost, Not a Default Choice
As covered in depth in the [Webpack Module Federation architecture doc](../../../webpack/pages/11-module-federation/04-architecture-patterns-and-topologies.md), micro-frontends solve a genuine organizational problem (multiple teams needing truly independent deploy cadences) at the cost of real runtime/tooling overhead (shared dependency version negotiation, cross-remote error isolation, more complex CI/CD). This is a decision that should be justified by an actual organizational need, not adopted as a default "scalable architecture" pattern for a team that doesn't actually have the multi-team independent-deploy requirement driving it.

### Caching Layers: Knowing Which One Actually Needs Invalidating
```
Browser cache ──► CDN edge cache ──► server data cache ──► database
```
A "the data isn't updating" bug requires knowing WHICH of these four layers is actually serving the stale response — the same diagnostic discipline covered in the Next.js caching architecture doc, generalized: invalidating the database (a `UPDATE` statement) does nothing to a CDN edge cache still serving a cached response from before that update, and vice versa. Effective cache architecture requires deliberately deciding, per layer, WHAT invalidates it and HOW.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Marketing Site Wrongly Built With Full Client-Side Rendering, Hurting Both SEO and Initial Load.
A marketing site (whose content changes rarely — a handful of static pages updated occasionally by a content team) was built as a fully client-side-rendered SPA, inheriting that choice from the team's other, genuinely-interactive authenticated app. This meant search engine crawlers saw an empty initial HTML shell (hurting SEO for a site whose entire business value depended on organic search traffic), and every visitor paid the cost of downloading and executing JS before seeing any content, for pages that could have been fully pre-rendered. Migrating those specific marketing pages to static generation (with ISR for the occasional content update) fixed both problems simultaneously — search engines saw fully-rendered HTML immediately, and visitors saw content without waiting for JS — while the genuinely interactive, authenticated parts of the same application correctly remained CSR, since THEIR requirements (rich, ongoing client interactivity behind auth, no SEO need) were genuinely different from the marketing pages'.

---

## 3. Reference Implementation

```tsx
// Static/ISR — for content that's the same for every visitor, changing rarely
// app/blog/[slug]/page.tsx
export async function generateStaticParams() { /* pre-render every known blog post */ }
async function getPost(slug: string) {
  return fetch(`/api/posts/${slug}`, { next: { revalidate: 3600 } }); // ISR — refreshed hourly, not per-request
}
```

```tsx
// SSR — for genuinely per-user, personalized content
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const session = await getSession(); // MUST be fresh, per-request — cannot be pre-rendered/shared across users
  const data = await fetchPersonalizedDashboard(session.userId);
  return <Dashboard data={data} />;
}
```

```tsx
// CSR — for a highly-interactive app behind auth, where SEO/initial-static-content isn't the priority
'use client';
function InteractiveEditor() {
  const [document, setDocument] = useState(initialDocument);
  return <RichTextEditor value={document} onChange={setDocument} />; // rich, ongoing client interactivity
}
```

```
# Caching layer invalidation — deliberately mapped, not assumed
Database UPDATE          ──► does NOT invalidate the CDN edge cache automatically
Server data cache purge  ──► invalidateTag()/revalidateTag() — invalidates the APP's OWN cache layer
CDN edge cache purge     ──► a SEPARATE, explicit CDN invalidation API call
Browser cache            ──► controlled by Cache-Control headers on each specific response
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: One Rendering Strategy for the Entire App, Regardless of Per-Route Needs
As the scenario shows, defaulting an ENTIRE app to one rendering strategy (usually inherited from whichever part of the app was built first) ignores that different routes genuinely have different requirements — apply the decision framework PER ROUTE, not once for the whole application.

### ⚠️ Anti-Pattern 2: Adopting Micro-Frontends Without an Actual Multi-Team Independent-Deploy Need
Micro-frontend architecture's overhead (shared dependency negotiation, cross-remote error isolation complexity, more involved CI/CD) is a real, ongoing cost — paying it without the organizational driver that actually justifies it (multiple teams genuinely needing independent deploy cadences) means accepting real complexity for zero corresponding benefit.

### ⚠️ Anti-Pattern 3: Invalidating One Cache Layer and Assuming the Whole Chain Is Now Fresh
Purging the application's own data cache (`revalidateTag`) while a CDN edge cache or a client's browser cache still serves an older cached response produces a confusing "I invalidated the cache but it's still stale" experience — each of the four layers needs its OWN invalidation strategy, deliberately designed, not assumed to cascade automatically from invalidating just one of them.
