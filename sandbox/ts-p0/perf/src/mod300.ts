export interface Row300 { id: string; qty: number; tags: string[] }
export function total300(rows: Row300[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample300: Row300 = { id: 'r300', qty: 300, tags: ['a', 'b'] };
