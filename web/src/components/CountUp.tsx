"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up from 0 to `value` in `duration` ms using requestAnimationFrame.
 * Easing: ease-out-cubic so the number "lands" rather than ramps linearly.
 */
export function CountUp({
  value,
  duration = 1100,
  className,
  style,
}: {
  value: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [n, setN] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setN(Math.round(value * ease(t)));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className} style={style}>
      {n.toLocaleString()}
    </span>
  );
}
