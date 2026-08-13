type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const payload: JsonValue = { id: 'O-1', total: 4800, items: [{ sku: 'a', qty: 2 }], note: null };

type MenuItem = { label: string; href?: string; items?: MenuItem[] };
const menu: MenuItem = { label: 'Root', items: [{ label: 'Child', href: '/c' }] };

function sizeOf(v: JsonValue): number {
  if (v === null || typeof v !== 'object') return 1;
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + sizeOf(x), 0);
  return Object.values(v).reduce<number>((n, x) => n + sizeOf(x), 0);
}
console.log(payload, menu, sizeOf(payload));
