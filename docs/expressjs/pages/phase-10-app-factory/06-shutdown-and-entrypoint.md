---
title: "Shutdown and entrypoint"
sidebar_label: "06 · Shutdown · entry"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**Keep `server` from `listen`. On SIGTERM: stop accepting, drain, close pools (Node). `server.js` listens; `app.js` exports the factory.**

```js
// server.js
const app = createApp(deps);
const server = app.listen(config.port);
process.on('SIGTERM', () => {
  server.close(() => deps.pool.end().then(() => process.exit(0)));
});
```

Feature flags and serverless adapters (`serverless-http`) are When Needed.

## Interview questions

**★ What object do you call close on?**  
The `http.Server`, not the Express `app`.


---

← Prev: [Health and boot](05-health-and-boot.md) · Index: [Phase 10](README.md)
