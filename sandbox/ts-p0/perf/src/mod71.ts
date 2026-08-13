export interface Row71 { id: string; qty: number; tags: string[] }
export function total71(rows: Row71[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample71: Row71 = { id: 'r71', qty: 71, tags: ['a', 'b'] };
