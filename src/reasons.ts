export const UNSUBSCRIBE_REASONS = [
  { id: "too_many", label: "I receive too many emails" },
  { id: "not_relevant", label: "The content isn't relevant to me" },
  { id: "not_signed_up", label: "I never signed up for these emails" },
  { id: "not_interested", label: "I'm not interested right now" },
  { id: "changed_role", label: "I've changed roles or company" },
  { id: "other", label: "Other" },
] as const;

export const REASON_IDS = new Set<string>(UNSUBSCRIBE_REASONS.map((r) => r.id));
export const MAX_REMARKS = 500;
