export interface Row289 { id: string; qty: number; tags: string[] }
export function total289(rows: Row289[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample289: Row289 = { id: 'r289', qty: 289, tags: ['a', 'b'] };
