const SHELF_CARD_WIDTH = 170;
const SHELF_GAP = 18;
const SHELF_FALLBACK_CAPACITY = 6;

const POSTER_MIN_WIDTH = 145;
const COLUMN_GAP = 20;
const ROW_GAP = 28;
const NARROW_VIEWPORT_WIDTH = 540;
const NARROW_COLUMN_COUNT = 2;
const METADATA_HEIGHT = 47;
const PAGINATION_RESERVE = 80;
const MINIMUM_PAGE_SIZE = 12;
const MAXIMUM_PAGE_SIZE = 60;
const MINIMUM_SPACE_DRIVEN_ROWS = 2;
const MAXIMUM_SPACE_DRIVEN_ROWS = 4;

export interface LibraryLayoutMetrics {
  readonly containerWidth: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly gridTop: number;
}

export interface LibraryLayout {
  readonly columns: number;
  /** Rows represented by the request after minimum-size and cap adjustments. */
  readonly rows: number;
  /** Rows that fit in the viewport, constrained to the intended two-to-four range. */
  readonly spaceDrivenRows: number;
  readonly pageSize: number;
  readonly cardWidth: number;
  readonly isFallback: boolean;
}

const FALLBACK_LAYOUT: LibraryLayout = {
  columns: 6,
  rows: 2,
  spaceDrivenRows: 2,
  pageSize: MINIMUM_PAGE_SIZE,
  cardWidth: POSTER_MIN_WIDTH,
  isFallback: true,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Calculates how many 170px cards fit in one shelf row with 18px gaps. */
export function calculateShelfCapacity(containerWidth: number): number {
  if (!isPositiveFinite(containerWidth)) {
    return SHELF_FALLBACK_CAPACITY;
  }

  return Math.max(1, Math.floor((containerWidth + SHELF_GAP) / (SHELF_CARD_WIDTH + SHELF_GAP)));
}

/**
 * Calculates a complete-row library request size from the rendered grid and viewport geometry.
 * Invalid or not-yet-measurable geometry uses the historical 12-item request size.
 */
export function calculateLibraryLayout(metrics: LibraryLayoutMetrics): LibraryLayout {
  const { containerWidth, viewportWidth, viewportHeight, gridTop } = metrics;
  if (
    !isPositiveFinite(containerWidth) ||
    !isPositiveFinite(viewportWidth) ||
    !isPositiveFinite(viewportHeight) ||
    !Number.isFinite(gridTop) ||
    gridTop < 0
  ) {
    return FALLBACK_LAYOUT;
  }

  const measuredColumns =
    viewportWidth <= NARROW_VIEWPORT_WIDTH
      ? NARROW_COLUMN_COUNT
      : Math.max(1, Math.floor((containerWidth + COLUMN_GAP) / (POSTER_MIN_WIDTH + COLUMN_GAP)));
  // No realistic IINA window reaches this limit, but bounding columns keeps every result <= 60.
  const columns = Math.min(measuredColumns, MAXIMUM_PAGE_SIZE);
  const cardWidth = Math.max(0, (containerWidth - COLUMN_GAP * Math.max(0, columns - 1)) / columns);
  const cardHeight = cardWidth * 1.5 + METADATA_HEIGHT;
  const usableHeight = Math.max(0, viewportHeight - gridTop - PAGINATION_RESERVE);
  const fittingRows = Math.floor((usableHeight + ROW_GAP) / (cardHeight + ROW_GAP));
  const spaceDrivenRows = clamp(fittingRows, MINIMUM_SPACE_DRIVEN_ROWS, MAXIMUM_SPACE_DRIVEN_ROWS);

  const minimumRows = Math.ceil(MINIMUM_PAGE_SIZE / columns);
  const maximumRows = Math.max(1, Math.floor(MAXIMUM_PAGE_SIZE / columns));
  const rows = Math.min(Math.max(spaceDrivenRows, minimumRows), maximumRows);

  return {
    columns,
    rows,
    spaceDrivenRows,
    pageSize: columns * rows,
    cardWidth,
    isFallback: false,
  };
}

/** Keeps the first item in the old range visible when the request size changes. */
export function anchorStartIndex(startIndex: number, pageSize: number): number {
  if (!isPositiveFinite(pageSize)) {
    return 0;
  }

  const normalizedStart = Number.isFinite(startIndex) ? Math.max(0, Math.floor(startIndex)) : 0;
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  return Math.floor(normalizedStart / normalizedPageSize) * normalizedPageSize;
}

/** Anchors a start index and clamps it to the final page after a result total shrinks. */
export function clampStartIndex(startIndex: number, pageSize: number, totalItems: number): number {
  if (!isPositiveFinite(pageSize) || !isPositiveFinite(totalItems)) {
    return 0;
  }

  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const lastPageStart =
    Math.floor((Math.max(1, Math.floor(totalItems)) - 1) / normalizedPageSize) * normalizedPageSize;
  return Math.min(anchorStartIndex(startIndex, normalizedPageSize), lastPageStart);
}
