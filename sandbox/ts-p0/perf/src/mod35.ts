export interface Row35 { id: string; qty: number; tags: string[] }
export function total35(rows: Row35[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample35: Row35 = { id: 'r35', qty: 35, tags: ['a', 'b'] };
