export interface Row221 { id: string; qty: number; tags: string[] }
export function total221(rows: Row221[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample221: Row221 = { id: 'r221', qty: 221, tags: ['a', 'b'] };
