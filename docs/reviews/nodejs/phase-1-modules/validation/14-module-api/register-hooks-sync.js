import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('config:')) {
      return {
        url: new URL('./config-' + specifier.slice(7) + '.js', import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { env } = await import('config:prod');
console.log('registerHooks →', env);
