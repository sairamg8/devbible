export interface Row277 { id: string; qty: number; tags: string[] }
export function total277(rows: Row277[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample277: Row277 = { id: 'r277', qty: 277, tags: ['a', 'b'] };
