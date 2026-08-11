export async function resolve(specifier, context, next) {
  if (specifier.startsWith('config:')) {
    return {
      url: new URL('./config-' + specifier.slice(7) + '.js', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return next(specifier, context);
}
