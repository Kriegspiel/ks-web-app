export const RULESET_LABELS = Object.freeze({
  berkeley: "Berkeley",
  berkeley_any: "Berkeley + Any",
  cincinnati: "Cincinnati",
  wild16: "Wild 16",
  rand: "RAND",
  english: "English",
  crazykrieg: "CrazyKrieg",
})

export const RULESET_OPTIONS = [
  { value: "berkeley", label: RULESET_LABELS.berkeley },
  { value: "berkeley_any", label: RULESET_LABELS.berkeley_any },
  { value: "cincinnati", label: RULESET_LABELS.cincinnati },
  { value: "wild16", label: RULESET_LABELS.wild16 },
  { value: "rand", label: RULESET_LABELS.rand },
  { value: "english", label: RULESET_LABELS.english },
  { value: "crazykrieg", label: RULESET_LABELS.crazykrieg },
]

export const DEFAULT_BOT_RULE_VARIANTS = ["berkeley", "berkeley_any", "cincinnati", "wild16", "rand", "english", "crazykrieg"]

export function formatRuleVariant(value) {
  if (typeof value !== "string") {
    return "—"
  }

  const normalized = value.trim()
  if (!normalized) {
    return "—"
  }

  return RULESET_LABELS[normalized] ?? "—"
}
