export interface Row227 { id: string; qty: number; tags: string[] }
export function total227(rows: Row227[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample227: Row227 = { id: 'r227', qty: 227, tags: ['a', 'b'] };
