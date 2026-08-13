export let mutableCity = 'Hyderabad';
export const constCity = 'Hyderabad';

export const rates = { standard: 120, express: 260 };
export const frozen = { standard: 120, express: 260 } as const;

export const mixed = [1, 'two', true];
export const tupleish = [1, 'two'] as const;

export const nested = { a: { b: [1, 2] } };

export function quote(weight: number, express = false) {
  return express ? weight * 260 : weight * 120;
}

export const maybe = Math.random() > 0.5 ? 'yes' : null;
