export function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return <img src="/icon.svg" alt="" aria-hidden="true" className={className} />;
}
