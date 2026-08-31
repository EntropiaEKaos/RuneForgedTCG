import type { ActivatedAbility } from "./activated-ability-types";
import {
  activatedAbilitiesForInstance,
  activatedAbilityChoices,
  canBeginActivateAbility,
  resolveActivatedAbilityChoice,
  validateActivatedAbilityActivation,
} from "./engine";
import type { GameState, PlayerId, TargetKind } from "./types";

export interface ActivatedAbilityUiState {
  canUse: boolean;
  status: "ready" | "blocked";
  reason: string | null;
}

export function activatedAbilityCostLabel(ability: ActivatedAbility): string {
  const parts: string[] = [];
  const cost = ability.cost;
  if (cost?.mana) parts.push(`💧${cost.mana}`);
  if (cost?.spellMana) parts.push(`✦${cost.spellMana}`);
  if (cost?.nexusHealth) parts.push(`♥${cost.nexusHealth}`);
  if (cost?.discardFromHand) parts.push(`🎴${cost.discardFromHand}`);
  if (cost?.exhaustSelf) parts.push("↷");
  if (cost?.consumeBarrier) parts.push("◈");
  if (cost?.sacrificeSelf) parts.push("✕");
  if (cost?.loyaltyDelta !== undefined) parts.push(`${cost.loyaltyDelta > 0 ? "+" : ""}${cost.loyaltyDelta}◆`);
  return parts.length ? parts.join(" ") : "ATIVAR";
}

export function activatedAbilityCostDescription(ability: ActivatedAbility): string {
  const parts: string[] = [];
  const cost = ability.cost;
  if (cost?.mana) parts.push(`${cost.mana} de mana regular`);
  if (cost?.spellMana) parts.push(`${cost.spellMana} de mana de feitiço`);
  if (cost?.nexusHealth) parts.push(`${cost.nexusHealth} de vida do Nexus`);
  if (cost?.discardFromHand) parts.push(`descartar ${cost.discardFromHand} carta${cost.discardFromHand === 1 ? "" : "s"} escolhida${cost.discardFromHand === 1 ? "" : "s"} da mão`);
  if (cost?.exhaustSelf) parts.push("exaurir esta carta");
  if (cost?.consumeBarrier) parts.push("consumir a Barrier ativa desta unidade");
  if (cost?.sacrificeSelf) parts.push("sacrificar esta carta");
  if (cost?.loyaltyDelta !== undefined) {
    parts.push(`${cost.loyaltyDelta > 0 ? "+" : ""}${cost.loyaltyDelta} de lealdade`);
  }
  return parts.length ? `Custo: ${parts.join(" + ")}.` : "Sem custo adicional.";
}

function requiresBoardTarget(target: TargetKind): boolean {
  return !["none", "self", "spellOnStack"].includes(target);
}

export function activatedAbilityUnavailableLabel(reason?: string | null): string {
  switch (reason) {
    case "activated abilities require the owner's main phase":
      return "Disponível apenas na fase principal do controlador.";
    case "not enough regular mana for activated ability":
      return "Mana insuficiente (mana regular).";
    case "not enough spell mana for activated ability":
      return "Mana de feitiço insuficiente.";
    case "Nexus health cost cannot be paid lethally":
      return "Vida do Nexus insuficiente para pagar sem ser letal.";
    case "not enough cards in hand for activated ability discard cost":
      return "Cartas insuficientes na mão para pagar o descarte.";
    case "activated ability discard cost requires explicit hand selection":
      return "Escolha as cartas da mão que serão descartadas como custo.";
    case "activated ability discard cost requires exactly the configured number of cards":
    case "activated ability discard cost selection contains duplicate cards":
    case "activated ability discard cost selection references a card outside actor hand":
    case "activated ability does not accept a discard cost selection":
      return "Seleção de descarte inválida.";
    case "Sentinela already activated this round":
    case "activated ability reached its per-round use limit":
      return "Já usada nesta rodada.";
    case "not enough Sentinela loyalty":
      return "Lealdade insuficiente.";
    case "unit is already exhausted this round":
    case "source is already exhausted this round":
      return "Fonte já exaurida nesta rodada.";
    case "stunned unit cannot pay an exhaust cost":
      return "Uma unidade atordoada não pode pagar o custo de exaustão.";
    case "summoning-sick unit cannot pay an exhaust cost":
      return "Unidade recém-invocada precisa de Haste para pagar exaustão.";
    case "source has no active Barrier to consume":
      return "Esta unidade precisa de uma Barrier ativa para pagar o custo.";
    case "Barrier cost requires a Unit source":
    case "consumeBarrier cost must be boolean":
      return "Configuração de custo de Barrier inválida.";
    case "activated ability requires a target":
    case "invalid activated ability target":
      return "Sem alvos válidos.";
    case "stack-targeted activated abilities require a reaction-context action":
      return "Só pode ser usada em uma janela de resposta.";
    case "activated ability source is not controlled by actor":
      return "Apenas o controlador pode ativar esta habilidade.";
    case "modal activated ability requires a mode":
      return "Escolha um modo para ativar.";
    case "unknown activated ability mode":
    case "non-modal activated ability does not accept a mode":
    case "invalid activated ability definition":
      return "Configuração de habilidade inválida.";
    case "activated ability index does not exist":
    case "invalid activated ability index":
      return "Habilidade indisponível.";
    default:
      return reason ? "Indisponível pelas regras atuais." : "Indisponível agora.";
  }
}

export function activatedAbilityUiState(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  abilityIndex: number,
  modeId?: string,
): ActivatedAbilityUiState {
  const ability = activatedAbilitiesForInstance(state, playerId, instanceId)[abilityIndex];
  if (!ability) {
    return { canUse: false, status: "blocked", reason: "Habilidade indisponível." };
  }

  if (canBeginActivateAbility(state, playerId, instanceId, abilityIndex, modeId)) {
    return { canUse: true, status: "ready", reason: null };
  }

  // Overview state for a modal ability: no mode is selected yet, so aggregate
  // individual choices without pretending an authoritative activation exists.
  if (ability.modes !== undefined && modeId === undefined) {
    const choices = activatedAbilityChoices(ability);
    if (choices.length === 0) {
      return { canUse: false, status: "blocked", reason: "Configuração de habilidade inválida." };
    }
    const firstReason = choices
      .map((choice) => activatedAbilityUiState(state, playerId, instanceId, abilityIndex, choice.modeId).reason)
      .find(Boolean);
    return {
      canUse: false,
      status: "blocked",
      reason: firstReason ?? "Nenhum modo pode ser usado agora.",
    };
  }

  const validation = validateActivatedAbilityActivation(state, playerId, instanceId, abilityIndex, undefined, modeId);
  let reason = validation.reason ?? null;
  const resolved = resolveActivatedAbilityChoice(ability, modeId);
  if (resolved.ok && validation.ok && requiresBoardTarget(resolved.choice.effect.target)) {
    reason = "activated ability requires a target";
  }

  return {
    canUse: false,
    status: "blocked",
    reason: activatedAbilityUnavailableLabel(reason),
  };
}
