export interface Row190 { id: string; qty: number; tags: string[] }
export function total190(rows: Row190[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample190: Row190 = { id: 'r190', qty: 190, tags: ['a', 'b'] };
