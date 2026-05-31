type SpinnerProps = {
  label?: string;
};

export function Spinner({ label }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        className="h-8 w-8 animate-spin text-sand-900"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="2.5"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {label ? (
        <span className="text-xs font-medium text-sand-600">{label}…</span>
      ) : null}
      <span className="sr-only">{label ?? "Loading"}</span>
    </div>
  );
}
