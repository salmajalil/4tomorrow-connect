export function ProgressBar({ step, total }: { step: number; total: number }) {
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
        <span>
          {pad(step)}/{pad(total)}
        </span>
        <span>{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-neutral-900 transition-all duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
