const SHELF_CARD_WIDTH = 170;
const SHELF_GAP = 18;
const SHELF_FALLBACK_CAPACITY = 6;

/** Calculates how many 170px cards fit in one shelf row with 18px gaps. */
export function calculateShelfCapacity(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return SHELF_FALLBACK_CAPACITY;
  }

  return Math.max(1, Math.floor((containerWidth + SHELF_GAP) / (SHELF_CARD_WIDTH + SHELF_GAP)));
}
