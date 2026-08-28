export function CombatFeedback({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div className="combat-feedback" role="status" aria-live="polite">
      <i aria-hidden="true" />
      <strong>{label}</strong>
      <i aria-hidden="true" />
    </div>
  );
}
