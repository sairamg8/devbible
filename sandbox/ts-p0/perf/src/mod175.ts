export interface Row175 { id: string; qty: number; tags: string[] }
export function total175(rows: Row175[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample175: Row175 = { id: 'r175', qty: 175, tags: ['a', 'b'] };
