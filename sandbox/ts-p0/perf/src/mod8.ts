export interface Row8 { id: string; qty: number; tags: string[] }
export function total8(rows: Row8[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample8: Row8 = { id: 'r8', qty: 8, tags: ['a', 'b'] };
