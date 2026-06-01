# PURA Incident Response Plan
**Version:** 1.0 | **Owner:** Dr. Santos (viveapr@gmail.com) | **Last updated:** 2026-06-01

---

## Contacts

| Role | Name | Contact | When to call |
|---|---|---|---|
| Founder / Incident Commander | Dr. Santos | viveapr@gmail.com | All incidents |
| Supabase Support | — | support@supabase.io / supabase.com/dashboard → Help | Database / auth incidents |
| Vercel Support | — | vercel.com/help | Deployment / availability incidents |
| Twilio Support | — | support.twilio.com | SMS delivery failures |

---

## Severity Levels

| Level | Definition | Response time |
|---|---|---|
| P1 | PHI exposed or production down | Immediate — within 1 hour |
| P2 | Auth broken, patients can't check in | Within 4 hours |
| P3 | Feature degraded, no data exposure | Within 24 hours |

---

## Scenario 1 — Supabase Reports a Breach

**Indicators:** Email from Supabase security team, unexpected data in access_log, unusual API traffic.

**Steps:**
1. **Immediately rotate all secrets** (within 15 min):
   - Supabase: Dashboard → Settings → API → Roll service role key + anon key
   - Update both in Vercel: `npx vercel env rm / vercel env add` for `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Redeploy: `npx vercel --prod`
2. **Invalidate all active sessions**: Supabase Dashboard → Authentication → Users → sign out all users
3. **Query access_log** for anomalous `actor_email` or actions in the breach window:
   ```sql
   SELECT * FROM access_log WHERE created_at > '<breach_start>' ORDER BY created_at;
   ```
4. **Identify affected clinics and patients** from the log
5. **Notify affected clinic owners** within 72 hours (HIPAA breach notification requirement)
6. **File Supabase support ticket** with incident timeline
7. **Document everything** — timestamps, what data was accessible, who was notified

---

## Scenario 2 — Clinic Owner Reports Unauthorized Access

**Indicators:** "I see patients that aren't mine" or "Someone else logged into my account."

**Steps:**
1. **Verify the claim**: query `access_log` for that clinic's `clinic_id`, look for unexpected `actor_email` values
2. **Invalidate the affected user's sessions**: Supabase Dashboard → Authentication → find user → Invalidate sessions
3. **Force password reset**: Supabase Auth → send password reset email to affected owner
4. **Audit RLS**: run the pen-test queries in `scripts/security-rls-test.sql` to confirm isolation is intact
5. **If cross-clinic data leak confirmed**: treat as P1 — rotate keys, notify all owners, pause cron
6. **Document** the incident timeline and resolution

---

## Scenario 3 — Vercel Goes Down (Production Unreachable)

**Indicators:** purasignal.com returns 5xx or is unreachable. Vercel status page shows incident.

**Steps:**
1. **Check status**: vercel.com/status — if confirmed Vercel incident, wait; nothing to do on our side
2. **The cron will miss its run** if Vercel is down at 10:00 UTC — manually trigger when restored:
   ```bash
   curl -X POST https://purasignal.com/api/cron/morning-send \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
3. **Supabase is unaffected** — patient data is safe; this is an availability issue only
4. **Notify active clinic owners** if downtime exceeds 2 hours: "PURA is temporarily unavailable due to infrastructure maintenance. Patient data is safe."
5. **If persistent (>4h)**: contact Vercel support, consider emergency redeploy to alternate region

---

## Scenario 4 — Twilio SMS Delivery Failure

**Indicators:** Patients not receiving check-in links; `sendSMS()` returning `false` in logs.

**Steps:**
1. **Check Twilio console**: console.twilio.com → Monitor → Logs → Messages — look for error codes
2. **Common causes**:
   - A2P 10DLC not approved → SMS blocked to US numbers (expected in early beta)
   - Twilio account balance depleted
   - Phone number flagged as spam
3. **Workaround**: use "Send check-in link now" button in dashboard — copies URL to clipboard for manual send
4. **Check Twilio credentials** haven't rotated: verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in Vercel match console.twilio.com

---

## Post-Incident Checklist

- [ ] Timeline documented (what happened, when, what was affected)
- [ ] Root cause identified
- [ ] Affected users/clinics notified if PHI was involved
- [ ] Secrets rotated if compromised
- [ ] Access log reviewed and archived
- [ ] Fix deployed and verified
- [ ] Postmortem written and lessons applied
