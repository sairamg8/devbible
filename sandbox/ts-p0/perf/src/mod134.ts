export interface Row134 { id: string; qty: number; tags: string[] }
export function total134(rows: Row134[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample134: Row134 = { id: 'r134', qty: 134, tags: ['a', 'b'] };
