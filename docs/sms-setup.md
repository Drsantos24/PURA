# SMS Setup Guide for PURA Clinics

This guide explains how to connect your own Twilio account to PURA so that
daily check-in messages go out from your clinic's phone number instead of
a shared PURA number. Your own account means independent A2P registration,
no shared sender reputation, and no send-count cap.

---

## Why connect your own Twilio account?

By default PURA sends from a shared platform number, limited to 50 sends/day.
Connecting your own Twilio account:

- Removes the daily send cap (pay Twilio's standard per-message rate instead)
- Gives patients a recognisable local number to receive messages from
- Lets you complete A2P 10DLC registration under your own clinic identity
- Isolates your sending reputation from other clinics

---

## Step 1 — Create a Twilio account

1. Go to [twilio.com](https://www.twilio.com) and click **Sign up for free**.
2. Complete the sign-up. Twilio gives you a trial balance (~$15).
3. Verify your mobile number during onboarding.
4. To send to numbers other than your own verified number, upgrade to a paid
   account under **Billing → Upgrade account** (costs ~$1–2/month minimum).

---

## Step 2 — Buy a phone number

1. In the Twilio Console: **Phone Numbers → Manage → Buy a number**.
2. Search by your clinic's area code for local presence, or search
   `800` / `833` / `844` for a toll-free number (higher throughput before
   A2P approval).
3. Ensure **SMS** capability is checked. Click **Buy** and confirm.
4. Your number appears under **Active Numbers**. Copy it in E.164 format,
   e.g. `+18005551234` (+ sign, country code, then the number, no dashes).

---

## Step 3 — Find your Account SID and Auth Token

1. Go to the [Twilio Console dashboard](https://console.twilio.com) or
   click your account name → **Account → API keys & tokens**.
2. **Account SID** — starts with `AC`, 34 characters. Safe to share internally.
3. **Auth Token** — 32-character secret. Treat like a password; never commit
   it to code or share publicly.

---

## Step 4 — Connect to PURA

1. In PURA, go to **Settings → SMS**.
2. Click **Use my own Twilio account**.
3. Paste your Account SID, Auth Token, and E.164 from-number.
4. Optionally add a WhatsApp-enabled number (see below).
5. Click **Save & verify**.
6. Enter a phone number to receive the 6-digit test code (your own mobile is
   fine). Click **Send code**.
7. Enter the code PURA texts you and click **Confirm**.

Once confirmed, all future check-in messages for your clinic use your Twilio
account and your number.

---

## Step 5 — A2P 10DLC registration (recommended for US SMS)

Carriers require A2P registration to prevent filtering of application-to-person
messages. Without it some messages may be delayed or blocked.

1. In Twilio Console: **Messaging → Regulatory Compliance → US A2P**.
2. **Brand registration** — enter your clinic's legal name, EIN/tax ID, and
   address. Approval takes 1–3 business days.
3. After brand approval, create a **Campaign**: select **Healthcare** →
   **Appointment/Check-in reminders**.
4. Link your phone number to the campaign.
5. Campaign approval takes 3–5 business days.

**Toll-free alternative:** Toll-free numbers use a separate, faster registration
process (**Messaging → Regulatory Compliance → Toll-Free**) and often approve
same-day. Recommended for early-stage clinics.

---

## WhatsApp (optional)

Twilio's WhatsApp Business API uses the same Account SID and Auth Token.
You need a separate WhatsApp-enabled phone number.

### Sandbox testing

Before your WhatsApp number is approved, use the Twilio sandbox:

1. In Twilio Console: **Messaging → Try it out → Send a WhatsApp message**.
2. The sandbox number is `+1 415 523 8886`.
3. From your personal WhatsApp, send `join <your-keyword>` to that number.
   Your number is now opted in to receive sandbox messages.
4. In PURA's SMS settings, leave the **WhatsApp from number** field blank.
   PURA falls back to the Twilio sandbox number automatically.

### Production WhatsApp number

1. In Twilio Console: **Messaging → Senders → WhatsApp Senders**.
2. Click **Add a WhatsApp Sender** and follow Meta's Business verification.
   Approval typically takes 3–7 business days.
3. Once approved, add the number as your **WhatsApp from number** in PURA.

> Patients must message your WhatsApp number first, or you must use a
> Meta-approved template, before you can send them outbound messages.

---

## Per-patient delivery preferences

In the patient roster, open any patient's detail drawer. Owners see a
**Channel** dropdown in the footer:

| Value | Behaviour |
|---|---|
| SMS | Standard text message (default) |
| WhatsApp | WhatsApp message |
| Email | Email only (patient email must be on file) |
| SMS + Email | Both simultaneously |

Changes save immediately to the patient's record and take effect at the next
morning send.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Verification code never arrives | Wrong SID or Auth Token | Copy them fresh from Twilio console — no extra spaces |
| "21608 unverified number" error | Trial account limitation | Verify the recipient's number in **Twilio → Verified Caller IDs**, or upgrade to paid |
| Messages filtered by carrier | No A2P registration | Complete 10DLC or toll-free registration |
| WhatsApp messages not delivered | Patient hasn't opted in | Patient must first WhatsApp your number, or use a Meta-approved template |
| "30008 Unknown error" | Auth Token was rotated | Re-paste the new token in PURA SMS settings and re-verify |
| Verification SMS sent but PURA doesn't confirm it | Code entered with extra spaces | Trim spaces; code is exactly 6 digits |

---

## Need help?

Email **support@purasignal.com** — we can walk through Twilio setup on a call
for any beta clinic.
