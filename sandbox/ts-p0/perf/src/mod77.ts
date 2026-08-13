export interface Row77 { id: string; qty: number; tags: string[] }
export function total77(rows: Row77[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample77: Row77 = { id: 'r77', qty: 77, tags: ['a', 'b'] };
