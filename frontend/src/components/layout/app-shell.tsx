"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const PAGE_TITLES: Record<string, string> = {
  "/": "Chat",
  "/knowledge-base": "Knowledge Base",
  "/analytics": "Analytics",
  "/settings": "Settings",
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "TechCore IT";

  return (
    <SidebarInset className="relative overflow-hidden">
      <div
        aria-hidden
        className="bg-app-glow bg-grid bg-noise pointer-events-none fixed inset-0 -z-10"
      />

      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/70 px-3 backdrop-blur-lg md:hidden">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm font-medium">{title}</span>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </SidebarInset>
  );
}
