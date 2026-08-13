export interface Row243 { id: string; qty: number; tags: string[] }
export function total243(rows: Row243[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample243: Row243 = { id: 'r243', qty: 243, tags: ['a', 'b'] };
