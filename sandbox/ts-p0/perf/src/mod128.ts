export interface Row128 { id: string; qty: number; tags: string[] }
export function total128(rows: Row128[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample128: Row128 = { id: 'r128', qty: 128, tags: ['a', 'b'] };
