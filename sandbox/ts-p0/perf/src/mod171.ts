export interface Row171 { id: string; qty: number; tags: string[] }
export function total171(rows: Row171[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample171: Row171 = { id: 'r171', qty: 171, tags: ['a', 'b'] };
