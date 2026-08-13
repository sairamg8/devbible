export interface Row186 { id: string; qty: number; tags: string[] }
export function total186(rows: Row186[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample186: Row186 = { id: 'r186', qty: 186, tags: ['a', 'b'] };
