export interface Row12 { id: string; qty: number; tags: string[] }
export function total12(rows: Row12[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample12: Row12 = { id: 'r12', qty: 12, tags: ['a', 'b'] };
