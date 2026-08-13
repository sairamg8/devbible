export interface Row291 { id: string; qty: number; tags: string[] }
export function total291(rows: Row291[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample291: Row291 = { id: 'r291', qty: 291, tags: ['a', 'b'] };
