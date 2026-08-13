export interface Row132 { id: string; qty: number; tags: string[] }
export function total132(rows: Row132[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample132: Row132 = { id: 'r132', qty: 132, tags: ['a', 'b'] };
