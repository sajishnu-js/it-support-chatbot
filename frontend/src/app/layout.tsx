import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/layout/app-shell";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { IntroOverlay } from "@/components/intro/intro-overlay";
import { StoreHydrator } from "@/components/store-hydrator";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TechCore IT — Knowledge Assistant",
  description:
    "AI-powered IT knowledge base assistant. Ask questions and get grounded, cited answers from your organization's documentation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full min-h-full flex-col bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delay={200}>
            <SidebarProvider defaultOpen className="min-h-full">
              <AppSidebar />
              <AppShell>{children}</AppShell>
            </SidebarProvider>
          </TooltipProvider>
          <Toaster position="bottom-right" />
          <StoreHydrator />
          <IntroOverlay />
        </ThemeProvider>
      </body>
    </html>
  );
}
