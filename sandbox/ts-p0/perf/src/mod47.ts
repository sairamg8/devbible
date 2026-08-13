export interface Row47 { id: string; qty: number; tags: string[] }
export function total47(rows: Row47[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample47: Row47 = { id: 'r47', qty: 47, tags: ['a', 'b'] };
