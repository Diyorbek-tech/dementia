"use client";

import { SessionProvider } from "next-auth/react";
import { SessionRefresher } from "@/components/SessionRefresher";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionRefresher />
      {children}
    </SessionProvider>
  );
}
