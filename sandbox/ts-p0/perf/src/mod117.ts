export interface Row117 { id: string; qty: number; tags: string[] }
export function total117(rows: Row117[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample117: Row117 = { id: 'r117', qty: 117, tags: ['a', 'b'] };
