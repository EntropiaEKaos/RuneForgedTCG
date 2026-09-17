export type CommandCenterJourney = {
  accountCreated: number;
  packOpened: number;
  deckCreated: number;
  matchPlayed: number;
  matchWon: number;
  rankedStarted: number;
};

export type CommandCenterPulseInput = {
  journey: CommandCenterJourney;
  dau: number;
  wau: number;
  mau: number;
  pvpCreated24h: number;
  pvpFinished24h: number;
  orders24h: number;
  approved24h: number;
};

export type IntelligenceSignal = {
  id: string;
  label: string;
  value: number;
  unit: "percent" | "count";
  status: "healthy" | "watch" | "critical" | "neutral";
  detail: string;
};

function safeRate(value: number, base: number) {
  if (!Number.isFinite(value) || !Number.isFinite(base) || base <= 0) return 0;
  return Math.max(0, Math.min(100, value / base * 100));
}

function statusForRate(value: number, healthy: number, watch: number): IntelligenceSignal["status"] {
  if (value >= healthy) return "healthy";
  if (value >= watch) return "watch";
  return "critical";
}

export function commandCenterIntelligence(input: CommandCenterPulseInput) {
  const stages = [
    { id: "account", label: "Conta", value: input.journey.accountCreated },
    { id: "pack", label: "Primeiro pack", value: input.journey.packOpened },
    { id: "deck", label: "Primeiro deck", value: input.journey.deckCreated },
    { id: "match", label: "Primeira partida", value: input.journey.matchPlayed },
    { id: "win", label: "Primeira vitória", value: input.journey.matchWon },
    { id: "ranked", label: "Ranked", value: input.journey.rankedStarted },
  ];

  const funnel = stages.map((stage, index) => {
    const previous = index === 0 ? stage.value : stages[index - 1].value;
    const stepConversion = index === 0 ? 100 : safeRate(stage.value, previous);
    const overallConversion = safeRate(stage.value, stages[0].value);
    const dropOff = index === 0 ? 0 : Math.max(0, previous - stage.value);
    return { ...stage, stepConversion, overallConversion, dropOff };
  });

  const largestDrop = funnel.slice(1).reduce<(typeof funnel)[number] | null>((largest, stage) => {
    if (!largest || stage.dropOff > largest.dropOff) return stage;
    return largest;
  }, null);

  const stickiness = safeRate(input.dau, input.mau);
  const weeklyReturn = safeRate(input.dau, input.wau);
  const matchCompletion = safeRate(input.pvpFinished24h, input.pvpCreated24h);
  const paymentApproval = safeRate(input.approved24h, input.orders24h);

  const signals: IntelligenceSignal[] = [
    {
      id: "dau-mau",
      label: "DAU / MAU",
      value: stickiness,
      unit: "percent",
      status: input.mau > 0 ? statusForRate(stickiness, 20, 10) : "neutral",
      detail: "Frequência diária dentro da base mensal ativa.",
    },
    {
      id: "dau-wau",
      label: "DAU / WAU",
      value: weeklyReturn,
      unit: "percent",
      status: input.wau > 0 ? statusForRate(weeklyReturn, 35, 18) : "neutral",
      detail: "Frequência diária dentro da base semanal ativa.",
    },
    {
      id: "match-completion",
      label: "Conclusão PvP 24h",
      value: matchCompletion,
      unit: "percent",
      status: input.pvpCreated24h > 0 ? statusForRate(matchCompletion, 85, 65) : "neutral",
      detail: "Salas PvP finalizadas sobre salas criadas nas últimas 24h.",
    },
    {
      id: "payment-approval",
      label: "Aprovação pagamentos 24h",
      value: paymentApproval,
      unit: "percent",
      status: input.orders24h > 0 ? statusForRate(paymentApproval, 80, 60) : "neutral",
      detail: "Pedidos aprovados/fulfilled sobre pedidos criados nas últimas 24h.",
    },
  ];

  return {
    funnel,
    largestDrop: largestDrop ? {
      stageId: largestDrop.id,
      stageLabel: largestDrop.label,
      players: largestDrop.dropOff,
      conversion: largestDrop.stepConversion,
    } : null,
    signals,
  };
}
