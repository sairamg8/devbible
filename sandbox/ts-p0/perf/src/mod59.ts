export interface Row59 { id: string; qty: number; tags: string[] }
export function total59(rows: Row59[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample59: Row59 = { id: 'r59', qty: 59, tags: ['a', 'b'] };
