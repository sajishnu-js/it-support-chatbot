import { LogoMark } from "@/components/common/logo-mark";
import { categoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { CategoryKey, KnowledgeSource } from "@/lib/types";

const AMBIENT_CATEGORIES: CategoryKey[] = ["network", "security", "microsoft365", "hardware"];

interface AiCoreProps {
  /** "lg" for the chat empty-state hero, "sm" for the inline processing indicator. */
  size?: "lg" | "sm";
  /** Actively retrieving — shows a radar-sweep ring instead of settled nodes. */
  searching?: boolean;
  /** Real retrieved sources to render as nodes. Falls back to ambient category icons when omitted. */
  sources?: KnowledgeSource[];
  className?: string;
}

/**
 * Shared 3D-style AI core visual: glowing orb, rotating rings, floating
 * nodes, ambient particles. Pure CSS/SVG (no WebGL) so it stays cheap.
 * Reused by the chat empty-state hero and the live retrieval indicator —
 * in the latter, `sources` swaps the ambient nodes for the real filenames
 * that were actually just retrieved.
 */
export function AiCore({ size = "lg", searching = false, sources, className }: AiCoreProps) {
  const isLarge = size === "lg";
  const box = isLarge ? 208 : 116;
  const half = box / 2;
  const coreSize = isLarge ? 64 : 34;
  const nodeSize = isLarge ? 40 : 24;
  const radius = isLarge ? 92 : 44;

  const nodes =
    sources && sources.length > 0
      ? sources.slice(0, 6).map((s) => ({
          key: s.filename,
          icon: categoryMeta(s.category).icon,
          label: s.filename,
        }))
      : AMBIENT_CATEGORIES.map((c) => ({ key: c, icon: categoryMeta(c).icon, label: categoryMeta(c).label }));

  const particles = isLarge
    ? Array.from({ length: 10 }, (_, i) => ({
        left: `${(i * 41 + 7) % 100}%`,
        top: `${(i * 29 + 13) % 100}%`,
        delay: `${(i % 6) * 0.3}s`,
        duration: `${2.6 + (i % 4) * 0.4}s`,
      }))
    : [];

  return (
    <div
      aria-hidden
      className={cn("relative flex shrink-0 items-center justify-center", className)}
      style={{ width: box, height: box }}
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute size-1 rounded-full bg-primary/60"
          style={{
            left: p.left,
            top: p.top,
            animation: `intro-twinkle ${p.duration} ease-in-out ${p.delay} infinite`,
          }}
        />
      ))}

      {/* ambient glow */}
      <div className="animate-orb-drift absolute inset-0 rounded-full bg-gradient-to-br from-primary/35 via-[oklch(0.7_0.15_190)]/25 to-transparent blur-2xl" />

      {/* rotating "3D" rings (perspective tilt via scaleY) */}
      <div
        className="animate-ring-a absolute rounded-full border border-primary/25"
        style={{ width: box * 0.82, height: box * 0.82 * 0.4, transform: "scaleY(1) rotate(0deg)" }}
      />
      <div
        className="animate-ring-b absolute rounded-full border border-[oklch(0.72_0.14_190)]/25"
        style={{ width: box * 0.68, height: box * 0.68 * 0.55 }}
      />
      {searching && (
        <div
          className="animate-radar-sweep absolute rounded-full opacity-70"
          style={{
            width: box * 0.82,
            height: box * 0.82 * 0.4,
            background:
              "conic-gradient(from 0deg, oklch(0.78 0.15 220 / 0.55), transparent 35%, transparent 100%)",
          }}
        />
      )}

      {/* connecting lines + nodes */}
      <svg className="absolute inset-0" width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
        {nodes.map((node, i) => {
          const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          const x = half + Math.cos(angle) * radius;
          const y = half + Math.sin(angle) * radius;
          return (
            <line
              key={node.key}
              x1={half}
              y1={half}
              x2={x}
              y2={y}
              stroke="oklch(0.75 0.14 210 / 0.35)"
              strokeWidth={1}
            />
          );
        })}
      </svg>

      {nodes.map((node, i) => {
        const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <div
            key={node.key}
            className="animate-fade-in-up absolute"
            style={{ transform: `translate(${x}px, ${y}px)` }}
            title={node.label}
          >
            <div
              className="animate-orb-drift flex items-center justify-center rounded-xl border border-white/10 bg-card/90 text-primary shadow-md shadow-primary/10 backdrop-blur-xl"
              style={{ width: nodeSize, height: nodeSize, animationDelay: `${i * 0.35}s` }}
            >
              <node.icon style={{ width: nodeSize * 0.45, height: nodeSize * 0.45 }} />
            </div>
          </div>
        );
      })}

      {/* core */}
      <div
        className="animate-core-pulse relative flex items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-card/95 to-card/60 shadow-xl shadow-primary/20 backdrop-blur-xl"
        style={{ width: coreSize, height: coreSize }}
      >
        <LogoMark glow={false} style={{ width: coreSize * 0.56, height: coreSize * 0.56 }} />
      </div>
    </div>
  );
}
