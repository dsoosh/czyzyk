/** The simple bird-on-stripes mark: reads well at small sizes (header badge). */
export function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return <img src="/mark.svg" alt="" aria-hidden="true" className={`object-contain ${className}`} />;
}
