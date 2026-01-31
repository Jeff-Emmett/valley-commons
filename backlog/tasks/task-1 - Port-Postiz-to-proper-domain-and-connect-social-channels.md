---
id: task-1
title: Port Postiz to proper domain and connect social channels
status: To Do
assignee: []
created_date: '2026-01-31 18:27'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The VOTC social media scheduler (Postiz) is currently deployed at votc-socials.jeffemmett.com. When the team confirms the proper domain and social media credentials:

1. Update the domain/URL configuration:
   - Update docker-compose.yml environment variables (MAIN_URL, FRONTEND_URL, NEXT_PUBLIC_BACKEND_URL)
   - Update Traefik router labels
   - Add new hostname to Cloudflare tunnel config
   - Add DNS CNAME record in Cloudflare

2. Connect social media channels by adding API keys:
   - X (Twitter): X_API_KEY, X_API_SECRET
   - LinkedIn: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET  
   - Discord: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN_ID
   - Mastodon: MASTODON_CLIENT_ID, MASTODON_CLIENT_SECRET
   - Other platforms as needed

Current deployment location: /opt/apps/postiz-votc/ on Netcup RS 8000
Temporary URL: https://votc-socials.jeffemmett.com

Waiting on: Team to provide proper domain and social media API credentials
<!-- SECTION:DESCRIPTION:END -->
