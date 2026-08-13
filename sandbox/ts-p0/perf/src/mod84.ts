export interface Row84 { id: string; qty: number; tags: string[] }
export function total84(rows: Row84[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample84: Row84 = { id: 'r84', qty: 84, tags: ['a', 'b'] };
