const ROOT_CYCLE_SECTION_OVERRIDES: Record<string, string> = {
  "TC-C1426": "LP Features",
  "TC-C1427": "LP Features",
  "TC-C1570": "Desktop or Tablet",
  "TC-C1569": "Mobile",
}

type QaCycleSectionInput = {
  key?: string | null
  name?: string | null
  section?: string | null
}

export function normalizeQaCycleSection(cycle: QaCycleSectionInput) {
  const section = cycle.section || "Other"
  if (section !== "Root") return section

  const key = cycle.key || ""
  if (ROOT_CYCLE_SECTION_OVERRIDES[key]) return ROOT_CYCLE_SECTION_OVERRIDES[key]

  const name = (cycle.name || "").toLowerCase()
  if (name.includes("bloomreach")) return "LP Features"
  if (name.includes("desktop") || name.includes("tablet")) return "Desktop or Tablet"
  if (name.includes("mobile")) return "Mobile"
  return section
}
