export interface Row142 { id: string; qty: number; tags: string[] }
export function total142(rows: Row142[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample142: Row142 = { id: 'r142', qty: 142, tags: ['a', 'b'] };
