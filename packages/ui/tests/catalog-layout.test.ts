import { describe, expect, it } from 'vitest';

import { calculateShelfCapacity } from '../src/catalog/catalog-layout';

describe('calculateShelfCapacity', () => {
  it('uses six cards before the shelf can be measured', () => {
    expect(calculateShelfCapacity(0)).toBe(6);
    expect(calculateShelfCapacity(Number.NaN)).toBe(6);
  });

  it('counts only complete 170px cards and their 18px gaps', () => {
    expect(calculateShelfCapacity(169)).toBe(1);
    expect(calculateShelfCapacity(357)).toBe(1);
    expect(calculateShelfCapacity(358)).toBe(2);
    expect(calculateShelfCapacity(1_200)).toBe(6);
  });
});
