export interface Row13 { id: string; qty: number; tags: string[] }
export function total13(rows: Row13[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample13: Row13 = { id: 'r13', qty: 13, tags: ['a', 'b'] };
