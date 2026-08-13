export interface Row113 { id: string; qty: number; tags: string[] }
export function total113(rows: Row113[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample113: Row113 = { id: 'r113', qty: 113, tags: ['a', 'b'] };
