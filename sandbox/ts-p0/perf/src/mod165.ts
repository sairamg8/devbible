export interface Row165 { id: string; qty: number; tags: string[] }
export function total165(rows: Row165[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample165: Row165 = { id: 'r165', qty: 165, tags: ['a', 'b'] };
