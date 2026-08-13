export interface Row15 { id: string; qty: number; tags: string[] }
export function total15(rows: Row15[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample15: Row15 = { id: 'r15', qty: 15, tags: ['a', 'b'] };
