export interface Row283 { id: string; qty: number; tags: string[] }
export function total283(rows: Row283[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample283: Row283 = { id: 'r283', qty: 283, tags: ['a', 'b'] };
