# PURA Health — Key Setup Guide

## All three keys go in ONE file: pura-config.js

### 1. Supabase Anon Key (database)
1. Go to: https://supabase.com/dashboard/project/oljhhgodblludybhndgj
2. Click Settings → API
3. Copy the "anon public" key (long string starting with eyJ...)
4. In pura-config.js, replace: YOUR_SUPABASE_ANON_KEY

### 2. Anthropic API Key (AI responses)
1. Go to: https://console.anthropic.com
2. Click API Keys → Create Key → copy it
3. In pura-config.js, replace: YOUR_ANTHROPIC_API_KEY
Note: Uses claude-haiku-4-5-20251001 — fastest, most cost-efficient model.

### 3. Web3Forms Key (email notifications)
1. Go to: https://web3forms.com
2. Enter viveapr@gmail.com → click Get Free Key
3. Copy the access key
4. In pura-config.js, replace: YOUR_WEB3FORMS_KEY

## After adding all 3 keys:
```
cd ~/PURA
git add pura-config.js
git commit -m "Add API keys"
git push origin main
```

## Your links after setup:

### Admin Dashboard (Joshua only)
https://pura-delta.vercel.app/admin.html
Password: pura2026santos

### Each DC gets exactly 2 links:
- Portal (DC only): pura-delta.vercel.app/portal.html?dc=[slug]
- Check-in (share with patients): pura-delta.vercel.app/checkin.html?dc=[slug]

### Public beta interest form:
https://pura-delta.vercel.app/beta.html

## Future upgrade (when scaling beyond beta):
Move ANTHROPIC_API_KEY to a Cloudflare Worker proxy to keep it server-side.
