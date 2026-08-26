"use client";

import CardView, { type CardViewProps } from "./CardView";
import CardInfo from "./CardInfo";
import Tooltip from "./Tooltip";

export default function CardTip(props: CardViewProps) {
  const { defId, unit, state } = props;
  return (
    <Tooltip content={<CardInfo defId={defId} unit={unit} state={state} />}>
      <span data-unit-id={unit?.instanceId} className="inline-block">
        <CardView {...props} />
      </span>
    </Tooltip>
  );
}
