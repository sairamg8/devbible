export interface Row273 { id: string; qty: number; tags: string[] }
export function total273(rows: Row273[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample273: Row273 = { id: 'r273', qty: 273, tags: ['a', 'b'] };
