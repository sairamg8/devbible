const candidates = [false, 0, -0, 0n, '', null, undefined, NaN, '0', 'false', [], {}, ' ', -1, Infinity, function(){}, new Boolean(false)];
const name = (v) => typeof v === 'object' && v !== null ? (Array.isArray(v) ? '[]' : v instanceof Boolean ? 'new Boolean(false)' : '{}') : typeof v === 'function' ? 'function(){}' : typeof v === 'string' ? JSON.stringify(v) : typeof v === 'bigint' ? v + 'n' : Object.is(v,-0) ? '-0' : String(v);
console.log('FALSY: ', candidates.filter(v => !v).map(name).join(', '));
console.log('TRUTHY:', candidates.filter(v => !!v).map(name).join(', '));
