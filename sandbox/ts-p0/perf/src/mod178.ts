export interface Row178 { id: string; qty: number; tags: string[] }
export function total178(rows: Row178[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample178: Row178 = { id: 'r178', qty: 178, tags: ['a', 'b'] };
