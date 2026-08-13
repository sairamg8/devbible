export interface Row240 { id: string; qty: number; tags: string[] }
export function total240(rows: Row240[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample240: Row240 = { id: 'r240', qty: 240, tags: ['a', 'b'] };
