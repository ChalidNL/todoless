# Invite and family baseline tests

These tests are mandatory release evidence for every `red -> beta` promotion. Run them against a disposable, freshly reset beta database. Do not run destructive setup steps against production.

| ID | Required scenario | Pass condition |
|---|---|---|
| BT-P0-001 | Fresh setup | A clean database reports setup incomplete; the first real onboarding flow creates exactly one admin and one family. |
| BT-P0-002 | Admin login | The first admin can log out and log back in through the UI. |
| BT-P0-003 | Generate invite | The admin generates an unexpired, unused member invite and receives a working URL/code. |
| BT-P0-004 | Open invite | The invite URL opens registration in a separate browser context without carrying the admin session. |
| BT-P0-005 | Accept invite | The invited person registers once and is assigned to the inviter's existing family, never a new family. |
| BT-P0-006 | Member visibility | The accepted member is visible in the admin's family/member view with active member status. |
| BT-P0-007 | Member login | The accepted member can log out and log back in with their own account. |
| BT-P0-008 | Shared visibility | Shared family data is visible to both users. |
| BT-P0-009 | Private boundary | Private data remains visible only to its owner. |
| BT-P0-010 | Invalid invite | An invalid invite fails without creating a user. |
| BT-P0-011 | Expired invite | An expired invite fails without creating a user. |
| BT-P0-012 | Reused invite | A reused invite fails without creating a second user. |
| BT-P0-013 | Logout | Admin and member logout clear their sessions and protected content. |
| BT-P0-014 | Desktop | The core flow works at 1440×900. |
| BT-P0-015 | Tablet | The core flow works at 768×1024. |
| BT-P0-016 | Mobile | The core flow works at 360×800 with reachable touch controls. |

## Evidence required

- Exact deployed commit from `/version.json` and healthy `/api/health`.
- Request status and UI outcome for each test ID.
- User and family counts before and after the flow.
- Confirmation that the accepted member is visible and belongs to the same family ID as the admin.
- Confirmation that invalid, expired, and reused invite states fail closed.
- Explicit desktop, tablet, and mobile results.
- Cleanup confirmation for all temporary records, except explicitly retained beta test accounts.
- No passwords, tokens, invite codes, or other credentials in committed evidence.
