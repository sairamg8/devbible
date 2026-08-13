export interface Row290 { id: string; qty: number; tags: string[] }
export function total290(rows: Row290[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample290: Row290 = { id: 'r290', qty: 290, tags: ['a', 'b'] };
