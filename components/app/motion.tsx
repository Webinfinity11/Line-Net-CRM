"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One place to ask whether motion is welcome, so every effect here obeys the same answer. */
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Everything here starts *visible* and is only hidden once we know JavaScript is
 * running and the element is still below the fold. Without that, a failed or slow
 * script would leave half the dashboard blank — a reveal must never be the reason
 * content cannot be read.
 */
function useRevealed<T extends Element>(threshold = 0.05, rootMargin = "0px") {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;
    const box = el.getBoundingClientRect();
    // on screen already: leave it alone, so nothing flashes on load
    if (box.top < window.innerHeight * 0.95) return;
    setShown(false);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);

  return { ref, shown };
}

/**
 * Reveals its children when they scroll into view, and renders them plainly when
 * they are already on screen.
 */
export function Reveal({ children, delay = 0, className, ariaLabel, view, as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; ariaLabel?: string; view?: string; as?: "div" | "section" | "li" }) {
  const { ref, shown } = useRevealed();

  return (
    <Tag
      ref={ref as never}
      aria-label={ariaLabel}
      data-view={view}
      data-shown={shown ? "true" : "false"}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined }}
      className={cn(
        "translate-y-[14px] opacity-0 transition-[opacity,transform] duration-[520ms] ease-[cubic-bezier(0.16,0.84,0.44,1)] data-[shown=true]:translate-y-0 data-[shown=true]:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts from zero to `value` once the element is on screen. */
export function useCountUp(value: number, duration = 1100) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || value === 0) {
      setN(value);
      return;
    }
    setN(value);
    let frame = 0;
    const run = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        setN(value * easeOut(p));
        if (p < 1) frame = requestAnimationFrame(tick);
        else setN(value);
      };
      setN(0);
      frame = requestAnimationFrame(tick);
    };
    if (el.getBoundingClientRect().top < window.innerHeight) {
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return { ref, n };
}

/** A number that counts up. `format` keeps the deterministic Georgian formatting. */
export function CountUp({ value, format, className, duration }: { value: number; format: (n: number) => string; className?: string; duration?: number }) {
  const { ref, n } = useCountUp(value, duration);
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(n)}
    </span>
  );
}

/**
 * An area chart that draws itself: the line is uncovered left to right, then the
 * fill fades in under it. Pure SVG, no chart library.
 *
 * The draw is a growing clip, not a stroke-dash trick: with `non-scaling-stroke` and a
 * stretched viewBox, browsers measure dashes in screen pixels while `pathLength`
 * counts in user units, so a dashed line came out broken into pieces.
 */
export function DrawnArea({
  points,
  height = 96,
  stroke = "#397b83",
  fill = "#397b83",
  className,
  labels,
}: {
  points: number[];
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
  labels?: string[];
}) {
  const { ref, shown } = useRevealed<SVGSVGElement>(0.2);
  const w = 100;
  const max = Math.max(1, ...points);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const y = (v: number) => height - (v / max) * (height - 10) - 2;
  const coords = points.map((v, i) => [i * step, y(v)] as const);

  // a soft curve reads better than straight segments for a trend
  const line = coords
    .map(([x, yy], i) => {
      if (i === 0) return `M ${x} ${yy}`;
      const [px, py] = coords[i - 1];
      const cx = (px + x) / 2;
      return `C ${cx} ${py} ${cx} ${yy} ${x} ${yy}`;
    })
    .join(" ");
  const area = `${line} L ${w} ${height} L 0 ${height} Z`;
  const id = `g-${stroke.replace("#", "")}`;
  // useId can contain characters that do not survive inside url(#…)
  const clip = `c${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className={cn("relative", className)}>
      <svg ref={ref} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.22" />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </linearGradient>
          <clipPath id={clip}>
            <rect
              x={-2}
              y={-2}
              width={w + 4}
              height={height + 4}
              style={{ transform: shown ? "scaleX(1)" : "scaleX(0)", transformOrigin: "0 0" }}
              className="transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none"
            />
          </clipPath>
        </defs>
        <path
          d={area}
          fill={`url(#${id})`}
          className="opacity-0 transition-opacity duration-700 delay-[420ms] motion-reduce:opacity-100 motion-reduce:transition-none"
          style={shown ? { opacity: 1 } : undefined}
        />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          clipPath={`url(#${clip})`}
        />
      </svg>
      {labels && (
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          {labels.map((l, i) => (
            <span key={`${l}-${i}`}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** A bar that grows to `pct` when it comes into view. */
export function GrowBar({ pct, color, delay = 0, className }: { pct: number; color: string; delay?: number; className?: string }) {
  const { ref, shown } = useRevealed<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={cn("h-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-[900ms] ease-[cubic-bezier(0.16,0.84,0.44,1)] motion-reduce:transition-none"
        style={{ width: shown ? `${Math.max(0, Math.min(100, pct))}%` : "0%", background: color, transitionDelay: `${delay}ms` }}
      />
    </div>
  );
}

/** Fixed circular geometry: no stretched viewBox or non-scaling stroke. */
export function Ring({ segments, children, label }: { segments: { value: number; color: string }[]; children: ReactNode; label: string }) {
  const { ref, shown } = useRevealed<SVGSVGElement>(0.2);
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const circumference = 2 * Math.PI * 66;
  let offset = 0;
  return (
    <div className="relative mx-auto size-[172px] shrink-0">
      <svg ref={ref} viewBox="0 0 172 172" className="size-[172px]" role="img" aria-label={label}>
        <circle cx="86" cy="86" r="66" fill="none" stroke="var(--ln-ring-track, #eef1f5)" strokeWidth="16" />
        <g transform="rotate(-90 86 86)">
          {segments.map((segment, index) => {
            const length = total > 0 ? Math.max(0, segment.value) / total * circumference : 0;
            const start = offset;
            offset += length;
            return <circle key={index} cx="86" cy="86" r="66" fill="none" stroke={segment.color} strokeWidth="16"
              strokeDasharray={`${shown ? length : 0} ${circumference}`} strokeDashoffset={-start}
              className="transition-[stroke-dasharray] duration-[1100ms] ease-out motion-reduce:transition-none" />;
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
