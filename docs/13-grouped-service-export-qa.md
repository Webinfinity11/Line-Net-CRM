# №2 — სერვისების Excel ექსპორტი ჯგუფებით

2026-09-28. Scope: request №2, awaiting local review before request №3.

## Behavior

- `/settings/services` has **Excel ჯგუფებით**. The download includes the currently applied search/category filter, inactive services, units, numeric prices and descriptions.
- The workbook opens with **სარჩევი** (category counts and links), followed by one filterable worksheet per populated category, in catalogue order. Uncategorized/legacy records remain in **კატეგორიის გარეშე**.
- Worksheet names are sanitized, shortened to Excel's 31-character limit and deduplicated. Full category labels remain in worksheet titles/data. Formula-like service names remain literal strings.
- Existing order exports now use the same category separation and retain their original columns and date/all-time scope. The previous silent 5,000-order export cap was removed.
- Export authorization remains admin/manager only. Responses use `private, no-store`.
- Uses the application's existing `xlsx` runtime dependency. No schema change or new runtime package.

## Checks

- `npm run typecheck`: passed.
- 31 targeted tests passed: grouped workbook, export authorization/content, service catalogue and reporting period. Includes 14 new tests for this change.
- Visible Chrome: downloaded eight demo services across four groups, confirmed decimal/zero prices, units and inactive status; searched HDMI and downloaded only the matching item; verified client/executor downloads return 403; verified mobile export button and no horizontal overflow; no browser runtime errors.
- Read the saved `.xlsx` back and rendered/inspected all five sheets with Artifact Tool.

## Review

The local server uses the isolated `linenet_sync_qa` database. Eight clearly marked demo catalogue entries were added there; production data was not changed.

An authenticated admin Chrome window is open at `http://localhost:3000/settings/services`. Click **Excel ჯგუფებით**. The full demo export was also opened in Microsoft Excel from `/tmp/linenet-export-qa/services-by-category.xlsx`.

Try searching **HDMI**, then export again to confirm the result follows the selected filter. Other requested changes, including the group/subgroup hierarchy in №8, remain separate tasks.
