-- ATD-109 pre-launch audit R-2 (owner-approved 2026-10-10): n8n webhook URLs
-- are admin-only.
--
-- arowana.webhooks holds the n8n workflow URLs. Its "public read webhooks"
-- policy (USING true) plus the anon grants on the table and on the
-- security-invoker view public.arowana_webhooks let anyone holding the public
-- anon key list them (docs/pre-launch-audit/FUNCTIONAL-AUDIT.md D-2).
--
-- Readers checked before this change: only the admin consoles (admin.html
-- here, lab/admin.html on the Wheel site) read the table, as signed-in admins,
-- through "admin write webhooks" (FOR ALL), which this keeps. Neither site's
-- js/app-config.js loads webhooks from the database any more; no API request
-- reached the table in the 24 hours before this was applied.
--
-- The same three statements are in the Wheel repo's
-- 20261009_ap_admin_hardening.sql; all are idempotent, so applying either file
-- after the other changes nothing. arowana.tools (labels and links) stays
-- readable.

drop policy if exists "public read webhooks" on arowana.webhooks;
revoke select on arowana.webhooks from anon;
revoke select on public.arowana_webhooks from anon;
