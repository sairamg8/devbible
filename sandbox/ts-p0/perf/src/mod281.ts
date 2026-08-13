export interface Row281 { id: string; qty: number; tags: string[] }
export function total281(rows: Row281[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample281: Row281 = { id: 'r281', qty: 281, tags: ['a', 'b'] };
