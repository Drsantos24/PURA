export default function TermsPage() {
  const lastUpdated = '2026-06-09'

  return (
    <main className="min-h-screen bg-background px-8 py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="rounded-md border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <p className="font-sans text-xs text-amber-400 font-medium uppercase tracking-widest">Draft</p>
          <p className="font-sans text-sm text-amber-400/80 mt-1">
            DRAFT PENDING LEGAL REVIEW -- DO NOT CONSIDER BINDING. This document is a pre-publication draft and has not been reviewed by counsel.
          </p>
        </div>

        <div className="space-y-2">
          <h1 className="font-serif text-4xl text-text-primary">Terms of Service</h1>
          <p className="font-sans text-xs text-text-muted">Last updated: {lastUpdated} | PURA Health</p>
        </div>

        <div className="space-y-6 font-sans text-sm text-text-primary leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">1. About PURA</h2>
            <p className="text-text-muted">
              PURA Health ("PURA," "we," "us") provides clinical intelligence software for chiropractic clinics.
              PURA enables clinics to collect daily patient check-in data, generate AI-assisted morning briefings,
              and coordinate team-based patient outreach. PURA is a tool for licensed healthcare providers --
              it does not provide medical advice, diagnose conditions, or constitute a clinical decision support
              system under FDA jurisdiction.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">2. Clinic Data Sovereignty</h2>
            <p className="text-text-muted">
              Each clinic's patient data is stored in a dedicated, isolated environment. PURA enforces
              row-level security at the database layer ensuring that no clinic can access another clinic's
              data under any circumstances. Your patients are yours. PURA does not sell, rent, or transfer
              individual clinic data to third parties. You retain ownership of all patient data you enter
              into PURA.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">3. Aggregate Learning Posture</h2>
            <p className="text-text-muted">
              PURA may analyze anonymized, de-identified, aggregate patterns across clinics to improve its
              AI models, briefing quality, and product features. This learning occurs at the statistical
              level only -- no individual patient data, no individually identifiable clinic information,
              and no PHI is used in aggregate analysis. All AI calls receive de-identified data; real
              patient names are re-inserted server-side after AI processing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">4. DC Clinical Authority</h2>
            <p className="text-text-muted">
              The Doctor of Chiropractic (DC) who owns a PURA clinic account is the clinical authority for
              all patient-facing actions. PURA's multi-user approval workflow requires that outbound patient
              communications, care plan changes, and patient invitations initiated by non-owner team members
              receive explicit DC approval before firing. PURA's AI generates suggestions only -- the DC
              reviews, edits, approves, or rejects every patient-facing output.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">5. HIPAA and BAAs</h2>
            <p className="text-text-muted">
              PURA operates as a Business Associate under HIPAA. Before using PURA with real patient data,
              you must execute a Business Associate Agreement (BAA) with PURA Health. BAAs are available
              upon request. PURA also maintains BAAs with its subprocessors (Anthropic, OpenAI, Supabase,
              Vercel, Twilio) to the extent they process PHI.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">6. Acceptable Use</h2>
            <p className="text-text-muted">
              PURA is licensed for use by licensed chiropractic clinics and their staff. You agree not to:
              use PURA to store data for patients who have not consented to digital health monitoring;
              attempt to access another clinic's data; reverse-engineer the AI models; or use PURA for
              any purpose that violates applicable law including HIPAA, state privacy law, or professional
              licensing requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">7. Limitation of Liability</h2>
            <p className="text-text-muted">
              PURA is provided as-is. PURA's AI-generated briefings and message drafts are suggestions only
              and do not constitute medical advice. The DC is solely responsible for all clinical decisions.
              PURA's liability is limited to the fees paid in the 3 months preceding any claim.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">8. Contact</h2>
            <p className="text-text-muted">
              Questions about these terms: legal@purahealth.app
            </p>
          </section>
        </div>

        <div className="border-t border-border pt-4 flex gap-4 text-xs font-sans text-text-muted">
          <a href="/legal/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</a>
          <a href="/" className="hover:text-text-primary transition-colors">Back to PURA</a>
        </div>
      </div>
    </main>
  )
}
