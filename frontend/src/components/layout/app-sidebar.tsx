"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  ChevronDown,
  Compass,
  Database,
  MessageSquarePlus,
  MessagesSquare,
  Moon,
  Settings,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";

import { LogoMark } from "@/components/common/logo-mark";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CATEGORY_ORDER, categoryMeta, QUICK_ACTION_CATEGORIES } from "@/lib/categories";
import { useHealth } from "@/lib/hooks/use-health";
import { useChatStore } from "@/lib/store/chat-store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/agent", label: "AI Agent", icon: Bot },
  { href: "/knowledge-base", label: "Knowledge Base", icon: Database },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { online } = useHealth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const conversations = useChatStore((s) => s.conversations);
  const order = useChatStore((s) => s.order);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const newConversation = useChatStore((s) => s.newConversation);
  const switchConversation = useChatStore((s) => s.switchConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const setPendingPrompt = useChatStore((s) => s.setPendingPrompt);

  const history = useMemo(
    () =>
      order
        .map((id) => conversations[id])
        .filter((conv) => conv && conv.messages.length > 0)
        .slice(0, 30),
    [order, conversations]
  );

  const handleNewChat = () => {
    newConversation();
    router.push("/");
  };

  const handleSelectConversation = (id: string) => {
    switchConversation(id);
    router.push("/");
  };

  const handleQuickAction = (prompt: string) => {
    setPendingPrompt(prompt);
    router.push("/");
  };

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <LogoMark className="shrink-0" />
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-sm font-semibold tracking-tight text-transparent">
              TechCore IT
            </span>
            <span className="text-[11px] text-muted-foreground">Support Intelligence</span>
          </div>
          <SidebarTrigger
            className="ml-auto group-data-[collapsible=icon]:hidden"
            aria-label="Collapse sidebar"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleNewChat}
                  tooltip="New chat"
                  className="bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary"
                >
                  <MessageSquarePlus />
                  <span>New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            <Zap className="mr-1.5 size-3.5" />
            Quick actions
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {QUICK_ACTION_CATEGORIES.map((key) => {
                const meta = categoryMeta(key);
                return (
                  <SidebarMenuItem key={key}>
                    <SidebarMenuButton
                      onClick={() => handleQuickAction(meta.prompt)}
                      tooltip={meta.shortLabel}
                    >
                      <meta.icon />
                      <span>{meta.shortLabel}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
            <CollapsibleTrigger className="group/collapsible flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-sidebar-foreground/70 outline-none hover:text-sidebar-foreground">
              <Compass className="size-3.5" />
              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                Browse by category
              </span>
              <ChevronDown className="size-3.5 shrink-0 transition-transform group-data-panel-open/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className="mt-1">
                <SidebarMenu>
                  {CATEGORY_ORDER.map((key) => {
                    const meta = categoryMeta(key);
                    return (
                      <SidebarMenuItem key={key}>
                        <SidebarMenuButton
                          render={<Link href={`/knowledge-base?category=${key}`} />}
                          tooltip={meta.label}
                        >
                          <meta.icon />
                          <span>{meta.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-1">
          <SidebarGroupLabel>
            <MessagesSquare className="mr-1.5 size-3.5" />
            Chat history
          </SidebarGroupLabel>
          <SidebarGroupContent className="overflow-y-auto">
            <SidebarMenu>
              {history.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  No conversations yet.
                </p>
              )}
              {history.map((conv) => (
                <SidebarMenuItem key={conv.id}>
                  <SidebarMenuButton
                    onClick={() => handleSelectConversation(conv.id)}
                    isActive={conv.id === activeConversationId && pathname === "/"}
                    tooltip={conv.title}
                  >
                    <MessagesSquare />
                    <span className="truncate">{conv.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    aria-label={`Delete conversation "${conv.title}"`}
                  >
                    <Trash2 />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="relative flex size-2">
                    {online && (
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    )}
                    <span
                      className={cn(
                        "relative inline-flex size-2 rounded-full",
                        online ? "bg-emerald-400" : "bg-destructive"
                      )}
                    />
                  </span>
                  <span className="group-data-[collapsible=icon]:hidden">
                    {online ? "Backend online" : "Backend offline"}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {online ? "Connected to the RAG API" : "Cannot reach the RAG API"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
                >
                  {mounted && theme === "dark" ? (
                    <Sun className="size-3.5" />
                  ) : (
                    <Moon className={cn("size-3.5", !mounted && "opacity-0")} />
                  )}
                </TooltipTrigger>
                <TooltipContent side="right">Toggle theme</TooltipContent>
              </Tooltip>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
