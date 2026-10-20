import { RULES, type Rule } from "./rules";
import {
  DEFAULT_RULE_CONFIG,
  RULES_VERSION,
  type DetectionContext,
  type DetectionProvider,
  type Finding,
  type PatientSnapshot,
  type RuleId,
} from "./types";

/** Runs every enabled v1 rule. Patients whose care was transferred out produce no findings (§6 global suppression). */
export function runRules(patients: PatientSnapshot[], ctx: DetectionContext): Finding[] {
  const findings: Finding[] = [];
  for (const patient of patients) {
    if (patient.careStatus === "transferred_out") continue;
    for (const [ruleId, rule] of Object.entries(RULES) as Array<[RuleId, Rule]>) {
      if (!ctx.disabledRules?.includes(ruleId)) findings.push(...rule(patient, ctx));
    }
  }
  return findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export const rulesProvider: DetectionProvider = {
  id: "rules",
  description: `Transparent rule-based detection v${RULES_VERSION}`,
  sendsDataExternally: false,
  async detect(patients, ctx) {
    return runRules(patients, ctx);
  },
};

export class ExternalAiDisabledError extends Error {
  constructor() {
    super("External AI providers are disabled in this prototype. Real-data AI requires separate privacy, legal, security, and clinical approval.");
    this.name = "ExternalAiDisabledError";
  }
}

/**
 * Placeholder for future language-model evaluation. It refuses to run: no
 * patient information may be sent to third-party AI services.
 */
export const disabledLlmProvider: DetectionProvider = {
  id: "llm",
  description: "Language-model provider (disabled)",
  sendsDataExternally: true,
  async detect() {
    throw new ExternalAiDisabledError();
  },
};

export function getDetectionProvider(id: "rules" | "llm", externalAiEnabled: boolean): DetectionProvider {
  if (id === "llm" || externalAiEnabled) throw new ExternalAiDisabledError();
  return rulesProvider;
}

export function detectionContext(asOf: string | Date, config = DEFAULT_RULE_CONFIG): DetectionContext {
  return { asOf: typeof asOf === "string" ? asOf : asOf.toISOString(), config };
}
