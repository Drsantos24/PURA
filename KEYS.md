# PURA Health -- Key Setup

## 3 keys to add in pura-config.js

### 1. Supabase (database)
Go to: supabase.com/dashboard/project/oljhhgodblludybhndgj
Settings -> API -> copy "anon public" key
Replace: YOUR_SUPABASE_ANON_KEY

### 2. Anthropic API (AI responses)
Go to: console.anthropic.com -> API Keys -> Create Key
Replace: YOUR_ANTHROPIC_API_KEY
Model: claude-haiku-4-5-20251001 (fastest, most efficient)

### 3. Web3Forms (free email notifications)
Go to: web3forms.com -> enter viveapr@gmail.com -> Get Free Key
Replace: YOUR_WEB3FORMS_KEY

## After adding keys:
git add pura-config.js && git commit -m "Add keys" && git push

## DC Login System
Default PIN: 1234 (all DCs forced to change on first login)
Admin can reset any PIN: admin.html -> Manage DCs -> Reset PIN

## To change a DC name or clinic name:
admin.html (password: pura2026santos) -> Manage DCs -> Edit -> Save
Changes appear in DC portal on next page load.

## To add a new DC:
admin.html -> Add New DC -> fill form -> Save
DC receives welcome email automatically with all 3 links.

## Permanent DC URLs (slugs never change):
Login:    pura-delta.vercel.app/login.html?dc=[slug]
Portal:   pura-delta.vercel.app/portal.html?dc=[slug]
Checkin:  pura-delta.vercel.app/checkin.html?dc=[slug]

Slugs: harrison-coleman | yina-cuevas | david-miranda | bryant-ramirez | ian-brewer | denis-chang

## Admin: pura-delta.vercel.app/admin.html (password: pura2026santos)
## Beta form: pura-delta.vercel.app/beta.html

## What fires automatically on every patient check-in:
1. PURA Signal calculated and stored in Supabase
2. pura_index_history row saved (permanent research record)
3. Alert engine checks signal/pain/stress thresholds
4. If threshold breached: instant email to DC + admin copy + saved to alerts
5. Thriving alert fires if signal >= 85
6. AI generates personalized 3-paragraph patient response
7. Check-in notification email sent to DC
8. Admin copy logged
