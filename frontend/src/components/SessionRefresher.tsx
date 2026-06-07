"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { registerSessionRefresh } from "@/lib/session-refresh";

export function SessionRefresher() {
  const { update } = useSession();

  useEffect(() => {
    registerSessionRefresh(() => update());
    return () => registerSessionRefresh(null);
  }, [update]);

  return null;
}
