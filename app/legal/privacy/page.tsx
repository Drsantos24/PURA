export default function PrivacyPage() {
  const lastUpdated = '2026-06-09'

  return (
    <main className="min-h-screen bg-background px-8 py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="rounded-md border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <p className="font-sans text-xs text-amber-400 font-medium uppercase tracking-widest">Draft</p>
          <p className="font-sans text-sm text-amber-400/80 mt-1">
            DRAFT PENDING LEGAL REVIEW -- DO NOT CONSIDER BINDING.
          </p>
        </div>

        <div className="space-y-2">
          <h1 className="font-serif text-4xl text-text-primary">Privacy Policy</h1>
          <p className="font-sans text-xs text-text-muted">Last updated: {lastUpdated} | PURA Health</p>
        </div>

        <div className="space-y-6 font-sans text-sm text-text-primary leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">Data We Collect</h2>
            <ul className="text-text-muted space-y-1 list-disc list-inside">
              <li>Clinic owner and staff account information (name, email, role)</li>
              <li>Patient names, phone numbers, and contact information entered by clinic staff</li>
              <li>Daily patient check-in data (pain, sleep, energy, stress, functional scores)</li>
              <li>Wearable data synced via patient consent through Junction Health</li>
              <li>AI-generated briefings, message drafts, and approval workflow records</li>
              <li>Clinic practice profile and intake interview responses</li>
              <li>Uploaded documents (care plan templates, philosophy docs, patient letters)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">How We Use Data</h2>
            <ul className="text-text-muted space-y-1 list-disc list-inside">
              <li>Generate daily morning briefings for clinic staff</li>
              <li>Draft personalized outreach messages for DC review and approval</li>
              <li>Compute patient recovery signals (PURA Index)</li>
              <li>Enable RAG-based AI context retrieval from clinic documents</li>
              <li>Provide aggregate analytics to the founder (no PHI, clinic-level summaries only)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">Data Isolation</h2>
            <p className="text-text-muted">
              Each clinic's data is isolated via row-level security at the database layer. No clinic can
              access another clinic's data. PURA staff access is limited to aggregate metrics only.
              Individual patient records are never accessible to PURA employees.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">AI Processing</h2>
            <p className="text-text-muted">
              When generating briefings and message drafts, PURA sends de-identified patient data to
              Anthropic (Claude Haiku) and Groq (Llama). Patient names, phone numbers, and contact
              details are never included in AI prompts. Real names are re-inserted server-side after
              AI processing is complete. OpenAI's embedding API receives anonymized clinic document
              text for RAG retrieval purposes only.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">Subprocessors</h2>
            <ul className="text-text-muted space-y-1 list-disc list-inside">
              <li>Supabase — database hosting (US-East-2)</li>
              <li>Vercel — application hosting</li>
              <li>Anthropic — briefing generation AI</li>
              <li>OpenAI — document embeddings</li>
              <li>Groq — message draft generation</li>
              <li>Twilio — SMS delivery to patients</li>
              <li>Junction Health — wearable data integration</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">Patient Rights</h2>
            <p className="text-text-muted">
              Patients may request access to, correction of, or deletion of their data by contacting
              their clinic directly. Clinics are responsible for honoring patient data requests in
              compliance with applicable law. PURA will assist clinics in fulfilling data subject
              requests upon written request.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans text-base font-medium text-text-primary">Contact</h2>
            <p className="text-text-muted">Privacy inquiries: privacy@purahealth.app</p>
          </section>
        </div>

        <div className="border-t border-border pt-4 flex gap-4 text-xs font-sans text-text-muted">
          <a href="/legal/terms" className="hover:text-text-primary transition-colors">Terms of Service</a>
          <a href="/" className="hover:text-text-primary transition-colors">Back to PURA</a>
        </div>
      </div>
    </main>
  )
}
