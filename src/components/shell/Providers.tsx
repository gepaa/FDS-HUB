"use client";

import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/kit/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}
