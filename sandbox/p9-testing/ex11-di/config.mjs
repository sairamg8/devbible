// A module-level singleton, read once at import time.
export const config = { region: process.env.REGION ?? 'eu-west-1' };
console.log(`  [config.mjs evaluated] region=${config.region}`);
