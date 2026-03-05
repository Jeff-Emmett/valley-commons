---
id: TASK-4
title: Set up wiki.valleyofthecommons.com subdomain
status: Done
assignee: []
created_date: '2026-03-01 18:43'
labels:
  - dns
  - infrastructure
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Point wiki.valleyofthecommons.com to the Docusaurus wiki hosted on Netlify at wikivotc2026.netlify.app.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
- Created Cloudflare CNAME record: wiki.valleyofthecommons.com → wikivotc2026.netlify.app (DNS-only, no proxy)
- DNS verified resolving via Cloudflare (1.1.1.1)
- User still needs to add wiki.valleyofthecommons.com as a custom domain in Netlify dashboard for SSL provisioning
- Commit: f1a4da7
<!-- SECTION:FINAL_SUMMARY:END -->
