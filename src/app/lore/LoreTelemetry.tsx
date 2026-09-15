"use client";

import { useEffect } from "react";
import { trackClientEvent } from "@/lib/client-telemetry";

export default function LoreTelemetry({ slug, category }: { slug?: string; category?: string }) {
  useEffect(() => {
    trackClientEvent(slug ? "lore.entry_viewed" : "lore.hub_viewed", {
      ...(slug ? { slug } : {}),
      ...(category ? { category } : {}),
    });
  }, [category, slug]);
  return null;
}
