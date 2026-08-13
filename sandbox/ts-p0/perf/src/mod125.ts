export interface Row125 { id: string; qty: number; tags: string[] }
export function total125(rows: Row125[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample125: Row125 = { id: 'r125', qty: 125, tags: ['a', 'b'] };
