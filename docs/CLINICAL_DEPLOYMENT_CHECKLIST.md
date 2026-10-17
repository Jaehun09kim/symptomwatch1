# Future Clinical Deployment Checklist

SymptomWatch v0.1 is a **research and demonstration prototype** that runs on **synthetic data only**. It is **not** clinically validated, **not** HIPAA-compliant, and **not** approved for real patient records. Implementing the security controls in this repository does **not** by itself establish HIPAA compliance.

Before any real protected health information (PHI) touches the system, *every* item below needs an accountable owner, documented evidence, and sign-off. This list is a starting point, not legal advice. Engage qualified healthcare privacy counsel, a security assessor, and clinical leadership.

## 1. Legal & regulatory
- [ ] Determine the regulatory role of the operating entity (business associate to clinics vs. covered entity) and of each clinic.
- [ ] HIPAA Privacy Rule analysis: permitted uses/disclosures, minimum-necessary standard per role, Notice of Privacy Practices impact for clinics.
- [ ] HIPAA Security Rule risk analysis (45 CFR 164.308(a)(1)) and a documented risk-management plan.
- [ ] HIPAA Breach Notification procedures and an incident-response runbook.
- [ ] California law review: CMIA (Confidentiality of Medical Information Act), CCPA/CPRA applicability, California data-breach statute, and any medical-board guidance relevant to software that supports clinical workflows.
- [ ] FDA software-as-a-medical-device (SaMD) / clinical decision support analysis. Confirm the product stays outside device definitions (21st Century Cures Act §3060 CDS criteria): no diagnosis, no urgency ranking, transparent basis a clinician can independently review. Re-evaluate whenever detection logic changes, and especially before any ML/LLM component.
- [ ] Terms of service, clinic agreements, acceptable-use policy, data-retention and deletion commitments.
- [ ] Information-blocking (21st Century Cures Act) considerations if integrating with EHRs.

## 2. Vendor & contracts
- [ ] **Business Associate Agreements (BAAs)** with every vendor that stores, processes, or transmits PHI: database/hosting (e.g. Supabase on a HIPAA-eligible plan), application hosting (Vercel does not sign BAAs on all plans — verify or choose a HIPAA-eligible host), email provider, logging/monitoring, backups, error tracking.
- [ ] Confirm each vendor's HIPAA-eligible service configuration (region, encryption, logging, support access).
- [ ] Sub-processor inventory and change-notification process.
- [ ] Any AI/LLM vendor: BAA, zero-retention terms, no training on customer data, documented data flows. **Separate privacy, legal, security, and clinical approval is required before any real-data AI integration** (prototype default: external AI hard-disabled).

## 3. Security engineering
- [ ] Formal threat model (STRIDE or similar) covering tenancy, auth, admin impersonation, data export, and integrations.
- [ ] Independent penetration test and remediation; recurring schedule.
- [ ] MFA for all staff accounts (TOTP/WebAuthn); enforced for admins.
- [ ] SSO/SAML option for clinics; session policies configurable per clinic.
- [ ] Distributed rate limiting and abuse protection (replace the in-memory limiter).
- [ ] Strict nonce- or hash-based CSP; dependency and container scanning; SBOM.
- [ ] Encryption at rest (provider-managed plus field-level encryption for high-sensitivity fields), TLS 1.2+ everywhere, key management and rotation.
- [ ] Secrets management (vault/provider secrets; no long-lived shared credentials); rotation runbooks.
- [ ] Backups with tested restore, point-in-time recovery, disaster-recovery plan with RPO/RTO targets.
- [ ] Centralized, tamper-evident audit logging with retention ≥ 6 years, and access-log review procedures.
- [ ] Production access controls: least privilege, break-glass procedure, access reviews, audited support access.
- [ ] Remove all demo features: shared demo accounts, “view as” impersonation, demo reset, dev outbox, synthetic-only constraints replaced by real-data validation.
- [ ] Replace the self-signup sandbox flow with verified clinic onboarding (identity verification, signed agreements).
- [ ] Re-verify RLS policies against the production Postgres roles and pooling mode; add automated policy regression tests to CI against real Postgres.
- [ ] Data export, patient right-of-access, amendment, and accounting-of-disclosures workflows.

## 4. Privacy operations
- [ ] Data-flow inventory and data classification.
- [ ] Minimum-necessary review of every role's view (front-desk column-level redaction currently lives in the service layer).
- [ ] Retention schedule and secure deletion; tenant offboarding.
- [ ] Workforce training, sanctions policy, privacy officer and security officer designated.
- [ ] De-identification standard (Safe Harbor or Expert Determination) for any analytics or research datasets.

## 5. Clinical safety & validation
- [ ] Clinical governance group (physicians, nursing, front-desk leads) owns the rule definitions and their changes.
- [ ] Hazard analysis (e.g. ISO 14971-style) for false negatives (missed gaps) and false positives (alert fatigue), and for automation bias.
- [ ] **Retrospective validation on real, de-identified data** under IRB or equivalent review, with labels produced by independent clinician reviewers (at least two, with adjudication) who are blind to engine output. Report precision, recall, F1, false-positive rate, inter-rater agreement, and subgroup performance.
- [ ] Prospective silent-mode pilot before any clinician-facing use, with workload and alert-burden measurement.
- [ ] Usability testing with real clinic staff (IEC 62366-style), including accessibility.
- [ ] Clear labeling that the product is a documentation aid, not a diagnostic or triage tool; labeling reviewed by counsel.
- [ ] Monitoring of rule performance after go-live; change-control and re-validation process for every rule change.
- [ ] Equity review: check that rules (e.g. missed-appointment patterns) do not systematically disadvantage groups.

## 6. Integrations
- [ ] EHR integration strategy (FHIR R4 / SMART on FHIR, HL7v2 feeds, or vendor APIs), with mapping validation and reconciliation.
- [ ] Patient-identity matching and merge handling.
- [ ] Any patient communication channel (SMS/email/portal): TCPA and consent management, opt-out handling, content review, and BAA-covered vendors. **The prototype sends no patient messages.**

## 7. Operations
- [ ] Uptime SLOs, on-call, status page, support processes.
- [ ] Incident response tabletop exercises.
- [ ] Change management and release approval for production.
- [ ] Business continuity plan and documented downtime procedures for clinics.
