import { describe, expect, it } from 'vitest';

import {
  anchorStartIndex,
  calculateLibraryLayout,
  calculateShelfCapacity,
  clampStartIndex,
} from '../src/catalog/catalog-layout';

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

describe('calculateLibraryLayout', () => {
  it('falls back to the historical 12-item layout for zero-size measurements', () => {
    expect(
      calculateLibraryLayout({
        containerWidth: 0,
        viewportWidth: 0,
        viewportHeight: 0,
        gridTop: 0,
      }),
    ).toEqual({
      columns: 6,
      rows: 2,
      spaceDrivenRows: 2,
      pageSize: 12,
      cardWidth: 145,
      isFallback: true,
    });
  });

  it('uses two narrow columns while preserving the 12-item minimum', () => {
    expect(
      calculateLibraryLayout({
        containerWidth: 500,
        viewportWidth: 500,
        viewportHeight: 800,
        gridTop: 250,
      }),
    ).toMatchObject({
      columns: 2,
      rows: 6,
      spaceDrivenRows: 2,
      pageSize: 12,
      isFallback: false,
    });
  });

  it('keeps the default layout at two complete rows and 12 items', () => {
    expect(
      calculateLibraryLayout({
        containerWidth: 1_020,
        viewportWidth: 1_200,
        viewportHeight: 900,
        gridTop: 220,
      }),
    ).toMatchObject({
      columns: 6,
      rows: 2,
      spaceDrivenRows: 2,
      pageSize: 12,
    });
  });

  it('fills two complete rows in a wide fullscreen layout', () => {
    expect(
      calculateLibraryLayout({
        containerWidth: 1_400,
        viewportWidth: 1_512,
        viewportHeight: 982,
        gridTop: 220,
      }),
    ).toMatchObject({
      columns: 8,
      rows: 2,
      spaceDrivenRows: 2,
      pageSize: 16,
    });
  });

  it('uses at most four space-driven rows in a tall window', () => {
    expect(
      calculateLibraryLayout({
        containerWidth: 1_400,
        viewportWidth: 1_512,
        viewportHeight: 1_700,
        gridTop: 220,
      }),
    ).toMatchObject({
      columns: 8,
      rows: 4,
      spaceDrivenRows: 4,
      pageSize: 32,
    });
  });

  it('caps artificial ultra-wide layouts at 60 items', () => {
    const layout = calculateLibraryLayout({
      containerWidth: 5_000,
      viewportWidth: 5_200,
      viewportHeight: 5_000,
      gridTop: 100,
    });

    expect(layout).toMatchObject({
      columns: 30,
      rows: 2,
      spaceDrivenRows: 4,
      pageSize: 60,
    });
  });
});

describe('pagination anchoring', () => {
  it('anchors the previous first item to the new page size', () => {
    expect(anchorStartIndex(25, 16)).toBe(16);
    expect(anchorStartIndex(47, 12)).toBe(36);
    expect(anchorStartIndex(-4, 12)).toBe(0);
  });

  it('clamps to the final page when the result total shrinks', () => {
    expect(clampStartIndex(96, 24, 95)).toBe(72);
    expect(clampStartIndex(24, 12, 10)).toBe(0);
    expect(clampStartIndex(24, 12, 0)).toBe(0);
  });
});
