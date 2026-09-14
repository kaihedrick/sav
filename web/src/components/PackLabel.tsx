export function PackLabel({ value }: { value?: string }) {
  if (!value?.trim()) return null;
  return <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
    <i className="fa-solid fa-box shrink-0" aria-hidden />
    <span className="break-words">Pack: {value}</span>
  </span>;
}
