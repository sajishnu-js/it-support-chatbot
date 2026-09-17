"use client";

import { useEffect, useState } from "react";

import { LogoMark } from "@/components/common/logo-mark";
import { categoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { CategoryKey } from "@/lib/types";

const SESSION_KEY = "techcore-intro-shown";

const NODE_CATEGORIES: CategoryKey[] = [
  "network",
  "security",
  "microsoft365",
  "accounts",
  "hardware",
  "infrastructure",
];

const RADIUS = 128;

type Phase = "idle" | "enter" | "hold" | "exit" | "done";

/** One-time-per-session 3D-style intro: an AI core with orbiting knowledge
 * nodes and a subtle particle field. Pure CSS/SVG (no WebGL) so it stays
 * cheap, and skipped entirely for prefers-reduced-motion. */
export function IntroOverlay() {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setPhase("done");
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setPhase("done");
      return;
    }

    setPhase("enter");
    const toHold = setTimeout(() => setPhase("hold"), 500);
    const toExit = setTimeout(() => setPhase("exit"), 2300);
    // Only the invocation that survives React Strict Mode's dev-only
    // mount→cleanup→remount cycle should ever reach this and mark the intro
    // as shown — writing the flag any earlier gets wiped out by the replay.
    const toDone = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setPhase("done");
    }, 2800);
    return () => {
      clearTimeout(toHold);
      clearTimeout(toExit);
      clearTimeout(toDone);
    };
  }, []);

  if (phase === "idle" || phase === "done") return null;

  const particles = Array.from({ length: 16 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    top: `${(i * 53) % 100}%`,
    delay: `${(i % 8) * 0.25}s`,
    duration: `${2.5 + (i % 5) * 0.4}s`,
  }));

  return (
    <div
      role="status"
      aria-label="Loading TechCore IT"
      className={cn(
        "bg-app-glow bg-grid fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background transition-opacity duration-500",
        phase === "exit" ? "pointer-events-none opacity-0" : "opacity-100"
      )}
    >
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        {particles.map((p, i) => (
          <span
            key={i}
            className="absolute size-1 rounded-full bg-primary/50"
            style={{
              left: p.left,
              top: p.top,
              animation: `intro-twinkle ${p.duration} ease-in-out ${p.delay} infinite`,
            }}
          />
        ))}
      </div>

      <div
        className={cn(
          "relative flex size-[320px] items-center justify-center transition-all duration-700",
          phase === "enter" && "scale-90 opacity-0",
          (phase === "hold" || phase === "exit") && "scale-100 opacity-100"
        )}
      >
        <svg className="absolute inset-0 size-full" viewBox="-160 -160 320 320" aria-hidden>
          {NODE_CATEGORIES.map((key, i) => {
            const angle = (i / NODE_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * RADIUS;
            const y = Math.sin(angle) * RADIUS;
            return (
              <line
                key={key}
                x1={0}
                y1={0}
                x2={x}
                y2={y}
                stroke="url(#intro-line)"
                strokeWidth={1.5}
                strokeDasharray={200}
                strokeDashoffset={phase === "enter" ? 200 : 0}
                style={{ transition: `stroke-dashoffset 900ms ease ${i * 80}ms` }}
              />
            );
          })}
          <defs>
            <linearGradient id="intro-line" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.78 0.15 220)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="oklch(0.72 0.14 190)" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>

        {NODE_CATEGORIES.map((key, i) => {
          const angle = (i / NODE_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * RADIUS;
          const y = Math.sin(angle) * RADIUS;
          const meta = categoryMeta(key);
          return (
            // Positioning (translate to x,y) lives on this outer element and
            // the wobble (animate-orb-drift, its own transform keyframes) on
            // the inner one — same element would fight itself over `transform`.
            <div
              key={key}
              className={cn(
                "absolute transition-all duration-700",
                phase === "enter" && "scale-50 opacity-0"
              )}
              style={{
                transform: `translate(${x}px, ${y}px)`,
                transitionDelay: `${120 + i * 70}ms`,
              }}
            >
              <div
                className="animate-orb-drift flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-card/90 text-primary shadow-lg shadow-primary/10 backdrop-blur-xl"
                style={{ animationDelay: `${i * 0.4}s` }}
              >
                <meta.icon className="size-5" />
              </div>
            </div>
          );
        })}

        <div className="relative flex size-20 items-center justify-center">
          <div className="animate-orb-spin-slow absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,oklch(0.75_0.15_220/0.5),oklch(0.75_0.14_190/0.35),oklch(0.68_0.16_290/0.4),oklch(0.75_0.15_220/0.5))] blur-md" />
          <div className="relative flex size-16 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-card/95 to-card/60 shadow-xl shadow-primary/20 backdrop-blur-xl">
            <LogoMark className="size-9" />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col items-center gap-1.5 text-center transition-all delay-300 duration-700",
          phase === "enter" ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        )}
      >
        <h1 className="text-lg font-semibold tracking-tight">TechCore IT</h1>
        <p className="text-xs text-muted-foreground">Connecting your knowledge base…</p>
      </div>
    </div>
  );
}
