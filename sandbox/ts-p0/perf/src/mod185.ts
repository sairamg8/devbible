export interface Row185 { id: string; qty: number; tags: string[] }
export function total185(rows: Row185[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample185: Row185 = { id: 'r185', qty: 185, tags: ['a', 'b'] };
