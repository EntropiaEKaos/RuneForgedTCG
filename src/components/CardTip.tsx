"use client";

import CardView, { type CardViewProps } from "./CardView";
import CardInfo from "./CardInfo";
import Tooltip from "./Tooltip";

export default function CardTip(props: CardViewProps) {
  const { defId, definition, unit, state, costOverride } = props;
  return (
    <Tooltip content={<CardInfo defId={defId} definition={definition} unit={unit} state={state} costOverride={costOverride} />} panelWidth={420}>
      <span data-unit-id={unit?.instanceId} className="inline-block">
        <CardView {...props} />
      </span>
    </Tooltip>
  );
}
