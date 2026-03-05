---
id: TASK-3
title: Migrate Docker secrets to Infisical
status: Done
assignee: []
created_date: '2026-03-01 18:43'
labels:
  - security
  - infrastructure
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace hardcoded secrets in docker-compose.yml with Infisical runtime secret injection. Add entrypoint.sh wrapper that authenticates with Infisical and exports secrets before starting Node.js server.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
- Replaced all hardcoded env vars in docker-compose.yml with Infisical injection (only INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, and INFISICAL_PROJECT_SLUG remain in compose)
- Created entrypoint.sh that authenticates with Infisical API and exports secrets at container startup
- Updated Dockerfile with ENTRYPOINT wrapper
- Externalized POSTGRES_PASSWORD to .env
- Commit: f1a4da7
<!-- SECTION:FINAL_SUMMARY:END -->
