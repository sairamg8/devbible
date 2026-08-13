export interface Row100 { id: string; qty: number; tags: string[] }
export function total100(rows: Row100[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample100: Row100 = { id: 'r100', qty: 100, tags: ['a', 'b'] };
