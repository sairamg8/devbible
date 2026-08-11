import { register } from 'node:module';
register('./hooks.js', import.meta.url);
const { env } = await import('config:prod');
console.log('custom specifier resolved →', env);
