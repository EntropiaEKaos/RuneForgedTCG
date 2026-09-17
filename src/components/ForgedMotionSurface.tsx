"use client";

import type { PropsWithChildren } from "react";
import { motion, useReducedMotion } from "motion/react";

export interface ForgedMotionSurfaceProps extends PropsWithChildren {
  className?: string;
  legendary?: boolean;
  cardDefId?: string;
  unitId?: string;
  rarity?: string;
}

/** Presentation-only card micro-interactions. Never owns gameplay state. */
export default function ForgedMotionSurface({
  children,
  className,
  legendary = false,
  cardDefId,
  unitId,
  rarity,
}: ForgedMotionSurfaceProps) {
  const reducedMotion = useReducedMotion();
  const enabled = !reducedMotion;

  return (
    <motion.span
      className={className}
      data-motion-surface="card"
      data-card-tip-def-id={cardDefId}
      data-unit-id={unitId}
      data-card-rarity={rarity}
      data-fx-premium={legendary ? "legendary" : undefined}
      initial={enabled ? { opacity: 0.92, scale: 0.985, y: 3 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={enabled ? { y: -4, scale: legendary ? 1.025 : 1.018 } : undefined}
      whileTap={enabled ? { scale: 0.985, y: -1 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }}
      style={{ transformOrigin: "50% 65%", willChange: enabled ? "transform" : "auto" }}
    >
      {children}
    </motion.span>
  );
}
