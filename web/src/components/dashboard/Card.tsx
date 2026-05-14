/** Shared card chrome for the dashboard grid. */
export function Card({
  children,
  className = "",
  label,
  accent = "var(--accent)",
  action,
  id,
  noPad = false,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
  accent?: string;
  action?: React.ReactNode;
  id?: string;
  noPad?: boolean;
}) {
  return (
    <section
      id={id}
      // lg:h-full so the card fills its fixed-height grid wrapper on desktop
      // (the wrappers are lg:h-[300px] / lg:h-[460px] etc). Without this the
      // card sizes to content and overflows, with rows below rendering on
      // top of it. On mobile the wrapper has no fixed height so the card
      // is natural-height and the page scrolls.
      className={`flex min-h-0 flex-col rounded-xl overflow-hidden lg:h-full ${className}`}
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      {label && (
        <header
          className="flex shrink-0 items-center justify-between px-4 md:px-5 py-3"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <span className="t-micro-label" style={{ color: accent }}>
            {label}
          </span>
          {action}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${noPad ? "" : "p-4 md:p-5"} ${label ? "" : ""}`}>
        {children}
      </div>
    </section>
  );
}
