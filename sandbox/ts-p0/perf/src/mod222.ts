export interface Row222 { id: string; qty: number; tags: string[] }
export function total222(rows: Row222[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample222: Row222 = { id: 'r222', qty: 222, tags: ['a', 'b'] };
