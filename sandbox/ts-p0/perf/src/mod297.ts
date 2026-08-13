export interface Row297 { id: string; qty: number; tags: string[] }
export function total297(rows: Row297[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample297: Row297 = { id: 'r297', qty: 297, tags: ['a', 'b'] };
