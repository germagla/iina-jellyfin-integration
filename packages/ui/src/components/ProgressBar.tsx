interface ProgressBarProps {
  className: string;
  label: string;
  max?: number;
  value: number;
}

export function ProgressBar({ className, label, max = 1, value }: ProgressBarProps) {
  const normalizedMax = Number.isFinite(max) && max > 0 ? max : 1;
  const normalizedValue = Number.isFinite(value) ? Math.min(normalizedMax, Math.max(0, value)) : 0;

  return (
    <progress
      aria-label={label}
      className={className}
      max={normalizedMax}
      value={normalizedValue}
    />
  );
}
