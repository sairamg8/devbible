export interface Row104 { id: string; qty: number; tags: string[] }
export function total104(rows: Row104[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample104: Row104 = { id: 'r104', qty: 104, tags: ['a', 'b'] };
