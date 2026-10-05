-- ATD-109: let ap_usage record the 'explain' feature.
--
-- arowana-explain meters every request with
--   ap_claim_usage(user, 'explain', 'YYYY-MM', limit, 0)
-- which inserts a (user, 'explain', month) row first. The deployed check only
-- allowed 'research' and 'coach', so that insert failed and every Explain in
-- plain English, Argue both sides and Retirement Planner write-up returned
-- "Explanations are unavailable right now." (confirmed read-only on
-- production 2026-10-05: the check is research/coach only, no explain rows).
--
-- Widens the allowed set by one value. Existing rows all satisfy it; no row,
-- function, grant or policy changes. Re-running is harmless (same constraint).
-- Owner/Codex apply this; it is not applied from the frontend task.

BEGIN;

ALTER TABLE public.ap_usage DROP CONSTRAINT IF EXISTS ap_usage_feature_check;

ALTER TABLE public.ap_usage ADD CONSTRAINT ap_usage_feature_check
  CHECK (feature = ANY (ARRAY['research'::text, 'coach'::text, 'explain'::text]));

COMMIT;
