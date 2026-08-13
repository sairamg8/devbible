export interface Row115 { id: string; qty: number; tags: string[] }
export function total115(rows: Row115[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample115: Row115 = { id: 'r115', qty: 115, tags: ['a', 'b'] };
