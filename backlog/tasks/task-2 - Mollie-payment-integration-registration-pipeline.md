---
id: TASK-2
title: Mollie payment integration + registration pipeline
status: Done
assignee: []
created_date: '2026-02-24 05:22'
labels:
  - payments
  - mollie
  - registration
  - email
  - google-sheets
dependencies: []
references:
  - api/mollie.js
  - api/application.js
  - api/google-sheets.js
  - server.js
  - payment-return.html
  - docker-compose.yml
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Full Mollie fintech payment integration into the VotC registration pipeline. Includes payment creation, webhook handling, payment status page, confirmation emails with booking details, Google Sheets sync to "Registrations" tab, and SMTP via mail.rmail.online.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Application form submits to DB and returns Mollie checkout URL
- [ ] #2 Mollie webhook updates payment_status in DB
- [ ] #3 Confirmation email sent with booking summary (ticket, weeks, price)
- [ ] #4 Google Sheets syncs to Registrations tab
- [ ] #5 payment-return.html polls and shows payment status
- [ ] #6 Email logging works (resend_id→message_id migration)
- [ ] #7 SMTP working via mail.rmail.online
- [ ] #8 Domain routing via valleyofthecommons.com
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented end-to-end: api/mollie.js (payment creation, webhook, status endpoint), updated api/application.js (Mollie integration, booking summary email, WEEK_LABELS), payment-return.html, db migrations (auto-run on startup), Google Sheets sync to Registrations tab, SMTP switched to mail.rmail.online, domain switched to valleyofthecommons.com. All components tested and verified working in production.
<!-- SECTION:FINAL_SUMMARY:END -->
