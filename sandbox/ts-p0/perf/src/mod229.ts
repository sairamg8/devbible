export interface Row229 { id: string; qty: number; tags: string[] }
export function total229(rows: Row229[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample229: Row229 = { id: 'r229', qty: 229, tags: ['a', 'b'] };
