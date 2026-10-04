-- ATD-108 Q6: deployed definitions captured 2026-10-04; NOT a production upgrade.

-- No rows, secrets, cron jobs, or Salon/Rental schema definitions are included.

-- Requires the external dependencies documented in supabase/baselines/README.md.

-- Existing security behavior is evidence, not an endorsement. Do not apply to production.

BEGIN;

SET LOCAL search_path = public, extensions, pg_catalog;

SET LOCAL check_function_bodies = false;

DO $preflight$ BEGIN

  IF to_regclass('arowana.tools') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: arowana.tools';

  END IF;

  IF to_regclass('arowana.webhooks') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: arowana.webhooks';

  END IF;

  IF to_regclass('auth.users') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: auth.users';

  END IF;

  IF to_regclass('public.agent_memberships') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: public.agent_memberships';

  END IF;

  IF to_regclass('public.ap_admins') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: public.ap_admins';

  END IF;

  IF to_regclass('public.ap_provider_calls') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: public.ap_provider_calls';

  END IF;

  IF to_regclass('public.companies') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: public.companies';

  END IF;

  IF to_regclass('public.entity_memberships') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: public.entity_memberships';

  END IF;

  IF to_regclass('public.finance_categories') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: public.finance_categories';

  END IF;

  IF to_regclass('public.gs_user_preferences') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: public.gs_user_preferences';

  END IF;

  IF to_regclass('public.journal_trade_candidates') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: public.journal_trade_candidates';

  END IF;

  IF to_regclass('salon.employees') IS NULL THEN

    RAISE EXCEPTION 'Missing external baseline dependency: salon.employees';

  END IF;

  IF to_regclass('arowana.entities') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: arowana.entities';

  END IF;

  IF to_regclass('arowana.financial_accounts') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: arowana.financial_accounts';

  END IF;

  IF to_regclass('public.ai_briefs') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.ai_briefs';

  END IF;

  IF to_regclass('public.ap_founders_waitlist') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.ap_founders_waitlist';

  END IF;

  IF to_regclass('public.ap_risk_settings') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.ap_risk_settings';

  END IF;

  IF to_regclass('public.ap_roll_coach') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.ap_roll_coach';

  END IF;

  IF to_regclass('public.ap_usage') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.ap_usage';

  END IF;

  IF to_regclass('public.app_config') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.app_config';

  END IF;

  IF to_regclass('public.arowana_tools') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.arowana_tools';

  END IF;

  IF to_regclass('public.arowana_webhooks') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.arowana_webhooks';

  END IF;

  IF to_regclass('public.business_profiles') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.business_profiles';

  END IF;

  IF to_regclass('public.cc_candidates') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.cc_candidates';

  END IF;

  IF to_regclass('public.csp_candidates') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.csp_candidates';

  END IF;

  IF to_regclass('public.daily_setups') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.daily_setups';

  END IF;

  IF to_regclass('public.entities') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.entities';

  END IF;

  IF to_regclass('public.finance_transactions') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.finance_transactions';

  END IF;

  IF to_regclass('public.financial_accounts') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.financial_accounts';

  END IF;

  IF to_regclass('public.journal_trades') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.journal_trades';

  END IF;

  IF to_regclass('public.market_snapshots') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.market_snapshots';

  END IF;

  IF to_regclass('public.option_chains') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.option_chains';

  END IF;

  IF to_regclass('public.option_roll_chains') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.option_roll_chains';

  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.profiles';

  END IF;

  IF to_regclass('public.tj_options') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.tj_options';

  END IF;

  IF to_regclass('public.tj_stocks') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.tj_stocks';

  END IF;

  IF to_regclass('public.trading_journal') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.trading_journal';

  END IF;

  IF to_regclass('public.user_api_keys') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.user_api_keys';

  END IF;

  IF to_regclass('public.user_cash_balances') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.user_cash_balances';

  END IF;

  IF to_regclass('public.user_deployment_plans') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.user_deployment_plans';

  END IF;

  IF to_regclass('public.user_preferences') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.user_preferences';

  END IF;

  IF to_regclass('public.v_finance_month_summary_all') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.v_finance_month_summary_all';

  END IF;

  IF to_regclass('public.v_finance_top_categories_month_all') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.v_finance_top_categories_month_all';

  END IF;

  IF to_regclass('public.watchlist_items') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.watchlist_items';

  END IF;

  IF to_regclass('public.watchlists') IS NOT NULL THEN

    RAISE EXCEPTION 'Refusing to overwrite existing relation: public.watchlists';

  END IF;

  IF to_regprocedure('uuid_generate_v4()') IS NULL THEN

    RAISE EXCEPTION 'uuid-ossp / uuid_generate_v4() prerequisite missing';

  END IF;

END $preflight$;

CREATE SCHEMA IF NOT EXISTS arowana;

DO $enum$ BEGIN

  IF to_regtype('public.finance_direction') IS NULL THEN

    CREATE TYPE "public"."finance_direction" AS ENUM ('income', 'expense');

  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=to_regtype('public.finance_direction')) IS DISTINCT FROM ARRAY['income', 'expense']::text[] THEN

    RAISE EXCEPTION 'Enum differs from captured baseline: public.finance_direction';

  END IF;

END $enum$;

CREATE TABLE "arowana"."entities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "legal_name" text NOT NULL,
  "entity_type" text NOT NULL,
  "color" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "arowana"."entities" OWNER TO "postgres";

ALTER TABLE "arowana"."entities" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "arowana"."financial_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "entity_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "nickname" text NOT NULL,
  "broker" text,
  "account_kind" text DEFAULT 'brokerage'::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "arowana"."financial_accounts" OWNER TO "postgres";

ALTER TABLE "arowana"."financial_accounts" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."ai_briefs" (
  "user_id" uuid NOT NULL,
  "date" date NOT NULL,
  "payload" jsonb NOT NULL,
  "ai_summary" text,
  "ai_summary_html" text,
  "bias" text,
  "confidence" integer,
  "mode" text,
  "risk" text,
  "universe" text,
  "provider_used" text,
  "model_used" text,
  "tokens_in" integer,
  "tokens_out" integer,
  "cost_usd" numeric(10,6),
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."ai_briefs" OWNER TO "postgres";

ALTER TABLE "public"."ai_briefs" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."ap_founders_waitlist" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "experience" text,
  "source" text DEFAULT 'landing'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."ap_founders_waitlist" OWNER TO "postgres";

ALTER TABLE "public"."ap_founders_waitlist" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."ap_risk_settings" (
  "user_id" uuid NOT NULL,
  "wheel_capital" numeric,
  "max_ticker_pct" numeric DEFAULT 20 NOT NULL,
  "max_total_pct" numeric DEFAULT 60 NOT NULL,
  "max_puts_per_ticker" integer DEFAULT 2 NOT NULL,
  "warn_earnings" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rules" jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE "public"."ap_risk_settings" OWNER TO "postgres";

ALTER TABLE "public"."ap_risk_settings" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."ap_roll_coach" (
  "user_id" uuid NOT NULL,
  "position_id" text NOT NULL,
  "underlying" text NOT NULL,
  "opt_type" text NOT NULL,
  "strike" numeric,
  "expiry" date,
  "contracts" numeric,
  "premium_received" numeric,
  "current_mid" numeric,
  "current_bid" numeric,
  "current_ask" numeric,
  "delta" numeric,
  "dte" integer,
  "moneyness_pct" numeric,
  "stock_price" numeric,
  "status" text,
  "captured_pct" numeric,
  "choices" jsonb,
  "rules" jsonb,
  "next_earnings_date" date,
  "data_source" text,
  "quote_time" timestamp with time zone,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."ap_roll_coach" OWNER TO "postgres";

ALTER TABLE "public"."ap_roll_coach" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."ap_usage" (
  "user_id" uuid NOT NULL,
  "feature" text NOT NULL,
  "period" text NOT NULL,
  "used" integer DEFAULT 0 NOT NULL,
  "cost_usd" numeric DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."ap_usage" OWNER TO "postgres";

ALTER TABLE "public"."ap_usage" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."app_config" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scope" text NOT NULL,
  "key" text NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."app_config" OWNER TO "postgres";

ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."business_profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid,
  "business_name" text NOT NULL,
  "location" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "notes" text,
  "industry" text,
  "business_type" text,
  "employee_count" integer,
  "services" text,
  "hours" text,
  "phone" text,
  "email" text,
  "website" text,
  "logo_url" text,
  "owner_user_id" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "business_hours" jsonb,
  "business_google_email" text,
  "google_place_id" text,
  "is_listed" boolean DEFAULT false NOT NULL,
  "operating_type" text,
  "genie_product" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "tagline" text,
  "company_id" uuid
);

ALTER TABLE "public"."business_profiles" OWNER TO "postgres";

ALTER TABLE "public"."business_profiles" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."cc_candidates" (
  "user_id" uuid NOT NULL,
  "underlying" text NOT NULL,
  "shares_owned" integer,
  "cost_basis" numeric,
  "current_price" numeric,
  "suggested_strike" numeric,
  "suggested_expiration" date,
  "suggested_dte" integer,
  "delta" numeric,
  "premium" numeric,
  "premium_pct" numeric,
  "annualized_yield" numeric,
  "assignment_prob" numeric,
  "resistance_level" numeric,
  "iv_percentile" numeric,
  "earnings_in_dte" integer,
  "score" integer,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "option_symbol" text,
  "contracts_available" integer,
  "bid" numeric,
  "ask" numeric,
  "open_interest" integer,
  "reasons" jsonb,
  "data_source" text,
  "quote_time" timestamp with time zone
);

ALTER TABLE "public"."cc_candidates" OWNER TO "postgres";

ALTER TABLE "public"."cc_candidates" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."csp_candidates" (
  "user_id" uuid NOT NULL,
  "underlying" text NOT NULL,
  "target_buy_price" numeric,
  "suggested_strike" numeric,
  "suggested_expiration" date,
  "suggested_dte" integer,
  "delta" numeric,
  "premium" numeric,
  "breakeven" numeric,
  "cash_required" numeric,
  "roi_pct" numeric,
  "annualized_yield" numeric,
  "assignment_prob" numeric,
  "support_level" numeric,
  "iv_percentile" numeric,
  "earnings_in_dte" integer,
  "score" integer,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "current_price" numeric,
  "option_symbol" text,
  "bid" numeric,
  "ask" numeric,
  "open_interest" integer,
  "discount_pct" numeric,
  "open_puts" jsonb,
  "reasons" jsonb,
  "data_source" text,
  "quote_time" timestamp with time zone
);

ALTER TABLE "public"."csp_candidates" OWNER TO "postgres";

ALTER TABLE "public"."csp_candidates" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."daily_setups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL,
  "market_bias" text,
  "risk_today" text,
  "mode" text,
  "watch" jsonb DEFAULT '[]'::jsonb,
  "setups" jsonb DEFAULT '[]'::jsonb,
  "generated_at" timestamp with time zone DEFAULT now(),
  "source" text,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."daily_setups" OWNER TO "postgres";

ALTER TABLE "public"."daily_setups" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."entities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "legal_name" text NOT NULL,
  "dba_name" text,
  "entity_type" text NOT NULL,
  "tax_classification" text,
  "jurisdiction" text,
  "country" text DEFAULT 'US'::text,
  "ein_last4" text,
  "start_date" date,
  "status" text DEFAULT 'active'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."entities" OWNER TO "postgres";

ALTER TABLE "public"."entities" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."finance_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "agent_id" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text,
  "direction" finance_direction NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "occurred_on" date NOT NULL,
  "description" text,
  "category_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "vendor" text,
  "category" text,
  "source" text,
  "confidence" numeric(4,3) DEFAULT 1.0,
  "needs_review" boolean DEFAULT false,
  "raw_text" text,
  "business_id" uuid
);

ALTER TABLE "public"."finance_transactions" OWNER TO "postgres";

ALTER TABLE "public"."finance_transactions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."financial_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "entity_id" uuid NOT NULL,
  "account_kind" text NOT NULL,
  "provider_name" text,
  "nickname" text,
  "last4" text,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid
);

ALTER TABLE "public"."financial_accounts" OWNER TO "postgres";

ALTER TABLE "public"."financial_accounts" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."journal_trades" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "asset_type" text NOT NULL,
  "ticker" text NOT NULL,
  "strategy" text,
  "direction" text,
  "status" text DEFAULT 'open'::text NOT NULL,
  "opened_at" date,
  "closed_at" date,
  "qty" numeric,
  "entry_price" numeric,
  "exit_price" numeric,
  "fees" numeric DEFAULT 0,
  "pnl" numeric DEFAULT 0,
  "account" text,
  "notes" text,
  "source_id" text,
  "meta" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "broker" text,
  "external_trade_id" text,
  "source" text DEFAULT 'manual'::text,
  "raw_payload" jsonb,
  "synced_at" timestamp with time zone,
  "underlying" text,
  "option_type" text,
  "strike" numeric,
  "expiry" date,
  "multiplier" integer DEFAULT 100
);

ALTER TABLE "public"."journal_trades" OWNER TO "postgres";

ALTER TABLE "public"."journal_trades" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."market_snapshots" (
  "symbol" text NOT NULL,
  "tf" text NOT NULL,
  "ts" timestamp with time zone NOT NULL,
  "ohlcv" jsonb,
  "indicators" jsonb
);

ALTER TABLE "public"."market_snapshots" OWNER TO "postgres";

ALTER TABLE "public"."market_snapshots" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."option_chains" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "ticker" text NOT NULL,
  "strategy" text,
  "status" text DEFAULT 'open'::text NOT NULL,
  "start_date" date,
  "end_date" date,
  "expiry" date,
  "account" text,
  "fees" numeric DEFAULT 0,
  "close_today_cost" numeric DEFAULT 0,
  "totals" jsonb DEFAULT '{}'::jsonb,
  "chain_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."option_chains" OWNER TO "postgres";

ALTER TABLE "public"."option_chains" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."option_roll_chains" (
  "id" uuid NOT NULL,
  "user_id" uuid,
  "name" text,
  "state" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."option_roll_chains" OWNER TO "postgres";

ALTER TABLE "public"."option_roll_chains" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id" uuid NOT NULL,
  "email" text,
  "full_name" text,
  "avatar_url" text,
  "gs_role" text DEFAULT 'user'::text NOT NULL,
  "arowana_plan" text DEFAULT 'free'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "arowana_plan_status" text,
  "arowana_stripe_customer_id" text,
  "arowana_stripe_subscription_id" text,
  "arowana_plan_renews_at" timestamp with time zone,
  "arowana_plan_updated_at" timestamp with time zone
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tj_options" (
  "id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "underlying" text,
  "strategy" text,
  "status" text,
  "entry_date" date,
  "exit_date" date,
  "manage_by" date,
  "dte_entry" integer,
  "iv_at_entry" numeric,
  "delta_at_entry" numeric,
  "theta_at_entry" numeric,
  "assignment" boolean DEFAULT false,
  "mistakes" text[] DEFAULT '{}'::text[],
  "r_multiple" numeric,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."tj_options" OWNER TO "postgres";

ALTER TABLE "public"."tj_options" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tj_stocks" (
  "id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "symbol" text,
  "status" text,
  "entry_date" date,
  "exit_date" date,
  "setup_type" text,
  "mistakes" text[] DEFAULT '{}'::text[],
  "emotion_pre" integer,
  "emotion_post" integer,
  "r_multiple" numeric,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."tj_stocks" OWNER TO "postgres";

ALTER TABLE "public"."tj_stocks" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."trading_journal" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "ticker" text NOT NULL,
  "asset_type" text NOT NULL,
  "strategy" text,
  "option_strategy" text,
  "quantity" numeric,
  "open_date" date,
  "open_price" numeric,
  "current_price" numeric,
  "open_net_amt" numeric,
  "current_net_amt" numeric,
  "stop_price" numeric,
  "target_price" numeric,
  "close_date" date,
  "close_price" numeric,
  "close_net_amt" numeric,
  "strike" numeric,
  "expiry_date" date,
  "entry_debit" numeric,
  "exit_debit" numeric,
  "cost_exit" numeric,
  "fee" numeric DEFAULT 0,
  "pnl" numeric,
  "remain_shares" numeric,
  "brokerage_account" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "setup" text,
  "tags" text
);

ALTER TABLE "public"."trading_journal" OWNER TO "postgres";

ALTER TABLE "public"."trading_journal" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_api_keys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "service" text NOT NULL,
  "api_key" text NOT NULL,
  "label" text,
  "is_valid" boolean,
  "last_tested" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."user_api_keys" OWNER TO "postgres";

ALTER TABLE "public"."user_api_keys" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_cash_balances" (
  "user_id" uuid NOT NULL,
  "account" text NOT NULL,
  "amount" numeric DEFAULT 0 NOT NULL,
  "source" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."user_cash_balances" OWNER TO "postgres";

ALTER TABLE "public"."user_cash_balances" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_deployment_plans" (
  "user_id" uuid NOT NULL,
  "payload" jsonb DEFAULT '{"plans": {}, "version": 1, "activePlanId": null}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."user_deployment_plans" OWNER TO "postgres";

ALTER TABLE "public"."user_deployment_plans" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."watchlist_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "watchlist_id" uuid NOT NULL,
  "symbol" text NOT NULL,
  "note" text,
  "position" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" uuid,
  "signal" text,
  "status" text,
  "current_price" numeric,
  "entry_price" numeric,
  "screener_source" text,
  "date_added" timestamp with time zone,
  "notes" text,
  "inserted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "horizon" text DEFAULT 'trade_idea'::text NOT NULL,
  "sector" text,
  "target_allocation" numeric,
  "valuation_status" text,
  "category" text,
  "want_to_own" boolean DEFAULT false NOT NULL,
  "target_buy_price" numeric,
  "want_to_own_at" timestamp with time zone
);

ALTER TABLE "public"."watchlist_items" OWNER TO "postgres";

ALTER TABLE "public"."watchlist_items" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."watchlists" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text DEFAULT 'My Watchlist'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."watchlists" OWNER TO "postgres";

ALTER TABLE "public"."watchlists" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ai_briefs" ADD CONSTRAINT "ai_briefs_pkey" PRIMARY KEY (user_id, date);

ALTER TABLE "public"."ap_founders_waitlist" ADD CONSTRAINT "ap_founders_waitlist_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."ap_founders_waitlist" ADD CONSTRAINT "ap_fw_email_format" CHECK (char_length(email) >= 5 AND char_length(email) <= 254 AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text);

ALTER TABLE "public"."ap_founders_waitlist" ADD CONSTRAINT "ap_fw_experience_values" CHECK (experience IS NULL OR (experience = ANY (ARRAY['new_to_wheel'::text, 'running_wheel'::text, 'other_options'::text])));

ALTER TABLE "public"."app_config" ADD CONSTRAINT "app_config_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."app_config" ADD CONSTRAINT "app_config_scope_key_key" UNIQUE (scope, key);

ALTER TABLE "public"."ap_risk_settings" ADD CONSTRAINT "ap_risk_capital_check" CHECK (wheel_capital IS NULL OR wheel_capital > 0::numeric AND wheel_capital < 1000000000::numeric);

ALTER TABLE "public"."ap_risk_settings" ADD CONSTRAINT "ap_risk_puts_check" CHECK (max_puts_per_ticker >= 1 AND max_puts_per_ticker <= 20);

ALTER TABLE "public"."ap_risk_settings" ADD CONSTRAINT "ap_risk_settings_pkey" PRIMARY KEY (user_id);

ALTER TABLE "public"."ap_risk_settings" ADD CONSTRAINT "ap_risk_ticker_pct_check" CHECK (max_ticker_pct > 0::numeric AND max_ticker_pct <= 100::numeric);

ALTER TABLE "public"."ap_risk_settings" ADD CONSTRAINT "ap_risk_total_pct_check" CHECK (max_total_pct > 0::numeric AND max_total_pct <= 100::numeric);

ALTER TABLE "public"."ap_roll_coach" ADD CONSTRAINT "ap_roll_coach_pkey" PRIMARY KEY (user_id, position_id, computed_at);

ALTER TABLE "public"."ap_usage" ADD CONSTRAINT "ap_usage_feature_check" CHECK (feature = ANY (ARRAY['research'::text, 'coach'::text]));

ALTER TABLE "public"."ap_usage" ADD CONSTRAINT "ap_usage_pkey" PRIMARY KEY (user_id, feature, period);

ALTER TABLE "public"."ap_usage" ADD CONSTRAINT "ap_usage_used_check" CHECK (used >= 0);

ALTER TABLE "arowana"."entities" ADD CONSTRAINT "entities_entity_type_check" CHECK (entity_type = ANY (ARRAY['personal'::text, 'llc'::text]));

ALTER TABLE "arowana"."entities" ADD CONSTRAINT "entities_pkey" PRIMARY KEY (id);

ALTER TABLE "arowana"."entities" ADD CONSTRAINT "entities_status_check" CHECK (status = ANY (ARRAY['active'::text, 'archived'::text]));

ALTER TABLE "arowana"."entities" ADD CONSTRAINT "entities_user_id_legal_name_key" UNIQUE (user_id, legal_name);

ALTER TABLE "arowana"."financial_accounts" ADD CONSTRAINT "financial_accounts_account_kind_check" CHECK (account_kind = ANY (ARRAY['brokerage'::text, 'ira'::text, 'roth'::text, '401k'::text]));

ALTER TABLE "arowana"."financial_accounts" ADD CONSTRAINT "financial_accounts_pkey" PRIMARY KEY (id);

ALTER TABLE "arowana"."financial_accounts" ADD CONSTRAINT "financial_accounts_status_check" CHECK (status = ANY (ARRAY['active'::text, 'archived'::text]));

ALTER TABLE "arowana"."financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_nickname_key" UNIQUE (user_id, nickname);

ALTER TABLE "public"."business_profiles" ADD CONSTRAINT "business_profiles_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."cc_candidates" ADD CONSTRAINT "cc_candidates_pkey" PRIMARY KEY (user_id, underlying, computed_at);

ALTER TABLE "public"."csp_candidates" ADD CONSTRAINT "csp_candidates_pkey" PRIMARY KEY (user_id, underlying, computed_at);

ALTER TABLE "public"."daily_setups" ADD CONSTRAINT "daily_setups_date_key" UNIQUE (date);

ALTER TABLE "public"."daily_setups" ADD CONSTRAINT "daily_setups_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."entities" ADD CONSTRAINT "entities_entity_type_check" CHECK (entity_type = ANY (ARRAY['llc'::text, 'corporation'::text, 'sole_prop'::text, 'partnership'::text, 'trust'::text, 'nonprofit'::text, 'other'::text]));

ALTER TABLE "public"."entities" ADD CONSTRAINT "entities_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."entities" ADD CONSTRAINT "entities_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text]));

ALTER TABLE "public"."entities" ADD CONSTRAINT "entities_tax_classification_check" CHECK (tax_classification = ANY (ARRAY['disregarded'::text, 'partnership'::text, 's_corp'::text, 'c_corp'::text, 'nonprofit'::text, 'other'::text]));

ALTER TABLE "public"."finance_transactions" ADD CONSTRAINT "finance_transactions_amount_chk" CHECK (amount >= 0::numeric);

ALTER TABLE "public"."finance_transactions" ADD CONSTRAINT "finance_transactions_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."financial_accounts" ADD CONSTRAINT "financial_accounts_account_kind_check" CHECK (account_kind = ANY (ARRAY['bank'::text, 'credit'::text, 'brokerage'::text, 'other'::text]));

ALTER TABLE "public"."financial_accounts" ADD CONSTRAINT "financial_accounts_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."financial_accounts" ADD CONSTRAINT "financial_accounts_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'closed'::text]));

ALTER TABLE "public"."journal_trades" ADD CONSTRAINT "journal_trades_asset_type_check" CHECK (asset_type = ANY (ARRAY['stock'::text, 'option'::text]));

ALTER TABLE "public"."journal_trades" ADD CONSTRAINT "journal_trades_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."journal_trades" ADD CONSTRAINT "journal_trades_status_check" CHECK (status = ANY (ARRAY['open'::text, 'closed'::text]));

ALTER TABLE "public"."market_snapshots" ADD CONSTRAINT "market_snapshots_pkey" PRIMARY KEY (symbol, tf, ts);

ALTER TABLE "public"."option_chains" ADD CONSTRAINT "option_chains_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."option_chains" ADD CONSTRAINT "option_chains_status_check" CHECK (status = ANY (ARRAY['open'::text, 'closed'::text]));

ALTER TABLE "public"."option_roll_chains" ADD CONSTRAINT "option_roll_chains_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_arowana_plan_check" CHECK (arowana_plan IS NULL OR (arowana_plan = ANY (ARRAY['free'::text, 'pro'::text, 'elite'::text, 'founders'::text])));

ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_arowana_plan_status_check" CHECK (arowana_plan_status IS NULL OR (arowana_plan_status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text, 'canceled'::text, 'incomplete'::text])));

ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."tj_options" ADD CONSTRAINT "tj_options_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."tj_stocks" ADD CONSTRAINT "tj_stocks_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."trading_journal" ADD CONSTRAINT "trading_journal_asset_type_check" CHECK (asset_type = ANY (ARRAY['share'::text, 'option'::text]));

ALTER TABLE "public"."trading_journal" ADD CONSTRAINT "trading_journal_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."user_api_keys" ADD CONSTRAINT "user_api_keys_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_service_key" UNIQUE (user_id, service);

ALTER TABLE "public"."user_cash_balances" ADD CONSTRAINT "user_cash_balances_pkey" PRIMARY KEY (user_id, account);

ALTER TABLE "public"."user_deployment_plans" ADD CONSTRAINT "user_deployment_plans_pkey" PRIMARY KEY (user_id);

ALTER TABLE "public"."watchlist_items" ADD CONSTRAINT "watchlist_items_horizon_check" CHECK (horizon = ANY (ARRAY['trade_idea'::text, 'long_term_hold'::text]));

ALTER TABLE "public"."watchlist_items" ADD CONSTRAINT "watchlist_items_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."watchlist_items" ADD CONSTRAINT "watchlist_items_target_buy_price_check" CHECK (target_buy_price IS NULL OR target_buy_price > 0::numeric AND target_buy_price < 1000000::numeric);

ALTER TABLE "public"."watchlist_items" ADD CONSTRAINT "watchlist_items_valuation_status_check" CHECK (valuation_status IS NULL OR (valuation_status = ANY (ARRAY['buy'::text, 'hold'::text, 'sell'::text])));

ALTER TABLE "public"."watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_symbol_key" UNIQUE (watchlist_id, symbol);

ALTER TABLE "public"."watchlists" ADD CONSTRAINT "watchlists_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."ai_briefs" ADD CONSTRAINT "ai_briefs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."app_config" ADD CONSTRAINT "app_config_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id);

ALTER TABLE "public"."ap_risk_settings" ADD CONSTRAINT "ap_risk_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."ap_roll_coach" ADD CONSTRAINT "ap_roll_coach_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."ap_usage" ADD CONSTRAINT "ap_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "arowana"."entities" ADD CONSTRAINT "entities_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "arowana"."financial_accounts" ADD CONSTRAINT "financial_accounts_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES arowana.entities(id) ON DELETE CASCADE;

ALTER TABLE "arowana"."financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "public"."business_profiles" ADD CONSTRAINT "business_profiles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE "public"."business_profiles" ADD CONSTRAINT "business_profiles_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id);

ALTER TABLE "public"."cc_candidates" ADD CONSTRAINT "cc_candidates_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."csp_candidates" ADD CONSTRAINT "csp_candidates_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."entities" ADD CONSTRAINT "entities_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."finance_transactions" ADD CONSTRAINT "finance_transactions_category_id_fkey" FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE SET NULL;

ALTER TABLE "public"."financial_accounts" ADD CONSTRAINT "financial_accounts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."financial_accounts" ADD CONSTRAINT "financial_accounts_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE;

ALTER TABLE "public"."journal_trades" ADD CONSTRAINT "journal_trades_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."option_chains" ADD CONSTRAINT "option_chains_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."tj_options" ADD CONSTRAINT "tj_options_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."tj_stocks" ADD CONSTRAINT "tj_stocks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."trading_journal" ADD CONSTRAINT "trading_journal_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_cash_balances" ADD CONSTRAINT "user_cash_balances_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_deployment_plans" ADD CONSTRAINT "user_deployment_plans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_fkey" FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE;

ALTER TABLE "public"."watchlists" ADD CONSTRAINT "watchlists_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX ap_founders_waitlist_email_key ON public.ap_founders_waitlist USING btree (lower(email));

CREATE INDEX ap_roll_coach_latest ON public.ap_roll_coach USING btree (user_id, computed_at DESC);

CREATE INDEX idx_financial_accounts_entity ON arowana.financial_accounts USING btree (entity_id);

CREATE INDEX idx_financial_accounts_user ON arowana.financial_accounts USING btree (user_id);

CREATE INDEX business_profiles_company_idx ON public.business_profiles USING btree (company_id);

CREATE INDEX business_profiles_owner_operating_idx ON public.business_profiles USING btree (owner_id, operating_type, status);

CREATE INDEX cc_candidates_user_latest ON public.cc_candidates USING btree (user_id, computed_at DESC);

CREATE INDEX csp_candidates_user_latest ON public.csp_candidates USING btree (user_id, computed_at DESC);

CREATE INDEX idx_ai_briefs_user_recent ON public.ai_briefs USING btree (user_id, date DESC);

CREATE INDEX idx_cash_user_account ON public.user_cash_balances USING btree (user_id, account);

CREATE INDEX idx_cc_user_recent ON public.cc_candidates USING btree (user_id, computed_at DESC);

CREATE INDEX idx_cc_user_score ON public.cc_candidates USING btree (user_id, score DESC, computed_at DESC);

CREATE INDEX idx_csp_user_recent ON public.csp_candidates USING btree (user_id, computed_at DESC);

CREATE INDEX idx_csp_user_score ON public.csp_candidates USING btree (user_id, score DESC, computed_at DESC);

CREATE INDEX idx_daily_setups_date ON public.daily_setups USING btree (date DESC);

CREATE INDEX idx_entities_created_by ON public.entities USING btree (created_by);

CREATE INDEX idx_entities_status ON public.entities USING btree (status);

CREATE INDEX idx_financial_accounts_entity ON public.financial_accounts USING btree (entity_id);

CREATE INDEX idx_financial_accounts_kind ON public.financial_accounts USING btree (account_kind);

CREATE INDEX idx_fin_tx_category ON public.finance_transactions USING btree (category_id);

CREATE INDEX idx_fin_tx_workspace_agent_date ON public.finance_transactions USING btree (workspace_id, agent_id, occurred_on DESC);

CREATE INDEX idx_fin_tx_workspace_date ON public.finance_transactions USING btree (workspace_id, occurred_on DESC);

CREATE INDEX idx_journal_trades_broker ON public.journal_trades USING btree (broker);

CREATE UNIQUE INDEX idx_journal_trades_broker_external_trade_id ON public.journal_trades USING btree (broker, external_trade_id) WHERE ((broker IS NOT NULL) AND (external_trade_id IS NOT NULL));

CREATE INDEX idx_journal_trades_synced_at ON public.journal_trades USING btree (synced_at DESC);

CREATE INDEX idx_market_snap_symbol_tf ON public.market_snapshots USING btree (symbol, tf, ts DESC);

CREATE INDEX idx_tj_options_strategy ON public.tj_options USING btree (user_id, strategy);

CREATE INDEX idx_tj_options_updated ON public.tj_options USING btree (user_id, updated_at DESC);

CREATE INDEX idx_tj_options_user ON public.tj_options USING btree (user_id);

CREATE INDEX idx_tj_options_user_exit ON public.tj_options USING btree (user_id, exit_date DESC);

CREATE INDEX idx_tj_options_user_status ON public.tj_options USING btree (user_id, status);

CREATE INDEX idx_tj_options_user_updated ON public.tj_options USING btree (user_id, updated_at);

CREATE INDEX idx_tj_stocks_updated ON public.tj_stocks USING btree (user_id, updated_at DESC);

CREATE INDEX idx_tj_stocks_user ON public.tj_stocks USING btree (user_id);

CREATE INDEX idx_tj_stocks_user_exit ON public.tj_stocks USING btree (user_id, exit_date DESC);

CREATE INDEX idx_tj_stocks_user_status ON public.tj_stocks USING btree (user_id, status);

CREATE INDEX idx_tj_stocks_user_updated ON public.tj_stocks USING btree (user_id, updated_at);

CREATE INDEX idx_user_api_keys_user_id ON public.user_api_keys USING btree (user_id);

CREATE INDEX idx_user_api_keys_user_service ON public.user_api_keys USING btree (user_id, service);

CREATE INDEX journal_trades_opened_at_idx ON public.journal_trades USING btree (opened_at);

CREATE INDEX journal_trades_ticker_idx ON public.journal_trades USING btree (ticker);

CREATE INDEX journal_trades_user_id_idx ON public.journal_trades USING btree (user_id);

CREATE INDEX option_chains_ticker_idx ON public.option_chains USING btree (ticker);

CREATE INDEX option_chains_user_id_idx ON public.option_chains USING btree (user_id);

CREATE UNIQUE INDEX profiles_arowana_stripe_customer_idx ON public.profiles USING btree (arowana_stripe_customer_id) WHERE (arowana_stripe_customer_id IS NOT NULL);

CREATE UNIQUE INDEX ux_journal_trades_broker_extid ON public.journal_trades USING btree (broker, external_trade_id);

CREATE INDEX watchlist_items_list_idx ON public.watchlist_items USING btree (watchlist_id);

CREATE INDEX watchlist_items_symbol_idx ON public.watchlist_items USING btree (symbol);

CREATE INDEX watchlist_items_user_id_idx ON public.watchlist_items USING btree (user_id);

CREATE INDEX watchlist_items_user_symbol_idx ON public.watchlist_items USING btree (user_id, symbol);

CREATE INDEX watchlist_items_user_wl_idx ON public.watchlist_items USING btree (user_id, watchlist_id);

CREATE INDEX watchlist_items_want_to_own_idx ON public.watchlist_items USING btree (user_id) WHERE want_to_own;

CREATE INDEX watchlist_items_wl_idx ON public.watchlist_items USING btree (watchlist_id);

CREATE INDEX watchlists_user_id_idx ON public.watchlists USING btree (user_id);

CREATE UNIQUE INDEX watchlists_user_id_key ON public.watchlists USING btree (user_id);

CREATE OR REPLACE FUNCTION public.ap_add_usage_cost(p_user uuid, p_feature text, p_period text, p_cost numeric)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.ap_usage
     set cost_usd = cost_usd + coalesce(p_cost, 0), updated_at = now()
   where user_id = p_user and feature = p_feature and period = p_period;
$function$;

ALTER FUNCTION "public"."ap_add_usage_cost"(uuid,text,text,numeric) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.ap_claim_usage(p_user uuid, p_feature text, p_period text, p_limit integer, p_cost numeric DEFAULT 0)
 RETURNS TABLE(allowed boolean, used integer, remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_used integer;
begin
  insert into public.ap_usage (user_id, feature, period, used, cost_usd)
       values (p_user, p_feature, p_period, 0, 0)
  on conflict (user_id, feature, period) do nothing;

  -- Lock the row so two tabs can't both slip past the limit.
  select u.used into v_used from public.ap_usage u
   where u.user_id = p_user and u.feature = p_feature and u.period = p_period
   for update;

  if v_used >= p_limit then
    return query select false, v_used, 0;
    return;
  end if;

  update public.ap_usage u
     set used = u.used + 1,
         cost_usd = u.cost_usd + coalesce(p_cost, 0),
         updated_at = now()
   where u.user_id = p_user and u.feature = p_feature and u.period = p_period
   returning u.used into v_used;

  return query select true, v_used, greatest(0, p_limit - v_used);
end $function$;

ALTER FUNCTION "public"."ap_claim_usage"(uuid,text,text,integer,numeric) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.ap_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and gs_role in ('gs_admin', 'arowana_admin')
  );
$function$;

ALTER FUNCTION "public"."ap_is_admin"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.ap_protect_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  if public.ap_is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.arowana_plan is distinct from old.arowana_plan
     or new.arowana_plan_status is distinct from old.arowana_plan_status
     or new.arowana_plan_renews_at is distinct from old.arowana_plan_renews_at
     or new.arowana_plan_updated_at is distinct from old.arowana_plan_updated_at
     or new.arowana_stripe_customer_id is distinct from old.arowana_stripe_customer_id
     or new.arowana_stripe_subscription_id is distinct from old.arowana_stripe_subscription_id then
    raise exception 'Plan and billing fields are managed by the server'
      using errcode = '42501';
  end if;

  if new.gs_role is distinct from old.gs_role
     and (coalesce(new.gs_role, '') in ('gs_admin', 'arowana_admin')
          or coalesce(old.gs_role, '') in ('gs_admin', 'arowana_admin')) then
    raise exception 'Admin roles can only be changed by an admin'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

ALTER FUNCTION "public"."ap_protect_profile_columns"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.approve_journal_trade_candidate(p_candidate_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_candidate record;
  v_trade_id uuid;
begin
  select * into v_candidate
  from public.journal_trade_candidates
  where id = p_candidate_id;

  insert into public.journal_trades (
    id,
    broker,
    external_trade_id,
    ticker,
    strategy,
    qty,
    entry_price,
    exit_price,
    fees,
    pnl,
    account,
    notes,
    raw_payload,
    synced_at
  )
  values (
    gen_random_uuid(),
    v_candidate.broker,
    'candidate-' || v_candidate.id,
    v_candidate.ticker,
    v_candidate.strategy,
    v_candidate.qty,
    v_candidate.entry_price,
    v_candidate.exit_price,
    v_candidate.fees,
    v_candidate.pnl,
    v_candidate.account_label,
    v_candidate.notes,
    jsonb_build_object(
      'candidate_id', v_candidate.id,
      'summary', v_candidate.summary,
      'legs', v_candidate.legs
    ),
    now()
  )
  returning id into v_trade_id;

  update public.journal_trade_candidates
  set status = 'posted',
      approved_at = now(),
      posted_at = now()
  where id = p_candidate_id;

  return v_trade_id;
end;
$function$;

ALTER FUNCTION "public"."approve_journal_trade_candidate"(uuid) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.ap_record_provider_call(p_day date, p_provider text, p_path text, p_user uuid, p_error boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_today integer;
begin
  insert into public.ap_provider_calls (day, provider, path, user_id, calls, errors)
       values (p_day, p_provider, p_path, p_user, 1, case when p_error then 1 else 0 end)
  on conflict (day, provider, path, user_id) do update
    set calls = ap_provider_calls.calls + 1,
        errors = ap_provider_calls.errors + case when p_error then 1 else 0 end,
        updated_at = now();

  select coalesce(sum(c.calls), 0) into v_today
    from public.ap_provider_calls c
   where c.day = p_day and c.provider = p_provider;

  return v_today;
end $function$;

ALTER FUNCTION "public"."ap_record_provider_call"(date,text,text,uuid,boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.ap_usage_summary(p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_admin boolean;
  v_days integer := greatest(1, least(coalesce(p_days, 14), 90));
  v_today date := (now() at time zone 'utc')::date;
  v_result jsonb;
begin
  select exists(select 1 from public.ap_admins a where a.user_id = auth.uid()) into v_is_admin;
  if not v_is_admin then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select jsonb_build_object(
    'today', v_today,
    'today_calls', (select coalesce(sum(calls), 0) from public.ap_provider_calls where day = v_today),
    'today_errors', (select coalesce(sum(errors), 0) from public.ap_provider_calls where day = v_today),
    'by_day', (select coalesce(jsonb_agg(d order by d->>'day' desc), '[]'::jsonb) from (
        select jsonb_build_object('day', day, 'calls', sum(calls), 'errors', sum(errors),
                                  'users', count(distinct user_id)) d
          from public.ap_provider_calls
         where day > v_today - v_days
         group by day) x),
    'by_path', (select coalesce(jsonb_agg(p order by (p->>'calls')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('path', path, 'calls', sum(calls), 'errors', sum(errors)) p
          from public.ap_provider_calls
         where day > v_today - v_days
         group by path) y),
    'top_users', (select coalesce(jsonb_agg(u order by (u->>'calls')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('email', coalesce(pr.email, 'unknown'), 'calls', sum(c.calls)) u
          from public.ap_provider_calls c
          left join public.profiles pr on pr.id = c.user_id
         where c.day > v_today - v_days
         group by pr.email
         order by sum(c.calls) desc
         limit 10) z),
    'coach_month', (select jsonb_build_object(
        'messages', coalesce(sum(used), 0),
        'cost_usd', round(coalesce(sum(cost_usd), 0)::numeric, 4),
        'users', count(*))
      from public.ap_usage
      where feature = 'coach' and period = to_char(v_today, 'YYYY-MM')),
    'research_today', (select jsonb_build_object(
        'lookups', coalesce(sum(used), 0), 'users', count(*))
      from public.ap_usage
      where feature = 'research' and period = to_char(v_today, 'YYYY-MM-DD')),
    'plans', (select coalesce(jsonb_object_agg(plan, n), '{}'::jsonb) from (
        select coalesce(arowana_plan, 'free') plan, count(*) n
          from public.profiles group by 1) pl)
  ) into v_result;

  return v_result;
end $function$;

ALTER FUNCTION "public"."ap_usage_summary"(integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION arowana.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

ALTER FUNCTION "arowana"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.fin_business_role(p_business_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce((
    select am.role
    from public.agent_memberships am
    where am.business_id = p_business_id
      and am.user_id = auth.uid()
      and am.status = 'active'
    order by
      case am.role
        when 'owner' then 1
        when 'manager' then 2
        when 'staff' then 3
        else 9
      end
    limit 1
  ), '');
$function$;

ALTER FUNCTION "public"."fin_business_role"(uuid) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.fin_is_agent_member(p_business_id uuid, p_agent_slug text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.agent_memberships am
    where am.business_id = p_business_id
      and am.user_id = auth.uid()
      and am.agent_slug = p_agent_slug
      and am.status = 'active'
  );
$function$;

ALTER FUNCTION "public"."fin_is_agent_member"(uuid,text) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.fin_is_business_member(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.agent_memberships am
    where am.business_id = p_business_id
      and am.user_id = auth.uid()
      and am.status = 'active'
  );
$function$;

ALTER FUNCTION "public"."fin_is_business_member"(uuid) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.set_created_by()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end $function$;

ALTER FUNCTION "public"."set_created_by"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.user_can_access_entity(eid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.entity_memberships m
    where m.entity_id = eid
      and m.user_id = auth.uid()
      and m.is_active = true
  );
$function$;

ALTER FUNCTION "public"."user_can_access_entity"(uuid) OWNER TO "postgres";

CREATE TRIGGER trg_entities_updated_at BEFORE UPDATE ON arowana.entities FOR EACH ROW EXECUTE FUNCTION arowana.set_updated_at();

ALTER TABLE "arowana"."entities" ENABLE TRIGGER "trg_entities_updated_at";

CREATE TRIGGER trg_financial_accounts_updated_at BEFORE UPDATE ON arowana.financial_accounts FOR EACH ROW EXECUTE FUNCTION arowana.set_updated_at();

ALTER TABLE "arowana"."financial_accounts" ENABLE TRIGGER "trg_financial_accounts_updated_at";

CREATE TRIGGER trg_business_profiles_updated_at BEFORE UPDATE ON business_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "public"."business_profiles" ENABLE TRIGGER "trg_business_profiles_updated_at";

CREATE TRIGGER trg_entities_updated_at BEFORE UPDATE ON entities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "public"."entities" ENABLE TRIGGER "trg_entities_updated_at";

CREATE TRIGGER trg_finance_transactions_created_by BEFORE INSERT ON finance_transactions FOR EACH ROW EXECUTE FUNCTION set_created_by();

ALTER TABLE "public"."finance_transactions" ENABLE TRIGGER "trg_finance_transactions_created_by";

CREATE TRIGGER trg_finance_transactions_updated_at BEFORE UPDATE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "public"."finance_transactions" ENABLE TRIGGER "trg_finance_transactions_updated_at";

CREATE TRIGGER trg_journal_trades_updated_at BEFORE UPDATE ON journal_trades FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "public"."journal_trades" ENABLE TRIGGER "trg_journal_trades_updated_at";

CREATE TRIGGER trg_option_chains_updated_at BEFORE UPDATE ON option_chains FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "public"."option_chains" ENABLE TRIGGER "trg_option_chains_updated_at";

CREATE TRIGGER trg_option_roll_updated BEFORE UPDATE ON option_roll_chains FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "public"."option_roll_chains" ENABLE TRIGGER "trg_option_roll_updated";

CREATE TRIGGER ap_protect_profile_columns BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION ap_protect_profile_columns();

ALTER TABLE "public"."profiles" ENABLE TRIGGER "ap_protect_profile_columns";

CREATE TRIGGER tj_options_touch BEFORE UPDATE ON tj_options FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE "public"."tj_options" ENABLE TRIGGER "tj_options_touch";

CREATE TRIGGER tj_stocks_touch BEFORE UPDATE ON tj_stocks FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE "public"."tj_stocks" ENABLE TRIGGER "tj_stocks_touch";

CREATE TRIGGER user_api_keys_updated_at BEFORE UPDATE ON user_api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "public"."user_api_keys" ENABLE TRIGGER "user_api_keys_updated_at";

CREATE POLICY "entities_delete_own" ON "arowana"."entities" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "entities_insert_own" ON "arowana"."entities" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "entities_select_own" ON "arowana"."entities" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "entities_update_own" ON "arowana"."entities" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "financial_accounts_delete_own" ON "arowana"."financial_accounts" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "financial_accounts_insert_own" ON "arowana"."financial_accounts" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "financial_accounts_select_own" ON "arowana"."financial_accounts" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "financial_accounts_update_own" ON "arowana"."financial_accounts" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "ai_briefs_delete_own" ON "public"."ai_briefs" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "ai_briefs_insert_own" ON "public"."ai_briefs" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "ai_briefs_select_own" ON "public"."ai_briefs" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "ai_briefs_update_own" ON "public"."ai_briefs" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "ap_fw_insert_only" ON "public"."ap_founders_waitlist" AS PERMISSIVE FOR INSERT TO "anon", "authenticated" WITH CHECK ((source = 'landing'::text));

CREATE POLICY "ap_risk_settings_own" ON "public"."ap_risk_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "ap_roll_coach_delete_own" ON "public"."ap_roll_coach" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((auth.uid() = user_id));

CREATE POLICY "ap_roll_coach_select_own" ON "public"."ap_roll_coach" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));

CREATE POLICY "ap_usage_select_own" ON "public"."ap_usage" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = user_id));

CREATE POLICY "admin write app_config" ON "public"."app_config" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.gs_role = ANY (ARRAY['gs_admin'::text, 'arowana_admin'::text]))))));

CREATE POLICY "public read app_config" ON "public"."app_config" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Allow insert for owner" ON "public"."business_profiles" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((owner_id = auth.uid()));

CREATE POLICY "Allow update for owner" ON "public"."business_profiles" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((owner_id = auth.uid()));

CREATE POLICY "Owner can update own business profile" ON "public"."business_profiles" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));

CREATE POLICY "bp_anon_public_read" ON "public"."business_profiles" AS PERMISSIVE FOR SELECT TO "anon" USING (true);

CREATE POLICY "bp_owner_manage" ON "public"."business_profiles" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM agent_memberships m
  WHERE ((m.business_id = business_profiles.id) AND (m.user_id = auth.uid()) AND (m.agent_slug = 'salon_genie'::text) AND (m.status = 'active'::text) AND (m.role = 'owner'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM agent_memberships m
  WHERE ((m.business_id = business_profiles.id) AND (m.user_id = auth.uid()) AND (m.agent_slug = 'salon_genie'::text) AND (m.status = 'active'::text) AND (m.role = 'owner'::text)))));

CREATE POLICY "bp_select_member" ON "public"."business_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM salon.employees e
  WHERE ((e.business_id = business_profiles.id) AND (e.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM agent_memberships m
  WHERE ((m.business_id = business_profiles.id) AND (m.user_id = auth.uid()) AND (m.status = 'active'::text))))));

CREATE POLICY "cc_delete_own" ON "public"."cc_candidates" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "cc_insert_own" ON "public"."cc_candidates" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "cc_select_own" ON "public"."cc_candidates" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "cc_update_own" ON "public"."cc_candidates" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "csp_delete_own" ON "public"."csp_candidates" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "csp_insert_own" ON "public"."csp_candidates" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "csp_select_own" ON "public"."csp_candidates" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "csp_update_own" ON "public"."csp_candidates" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Anyone can read daily setups" ON "public"."daily_setups" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Service role can insert/update daily setups" ON "public"."daily_setups" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.role() = 'service_role'::text));

CREATE POLICY "entities: insert for authenticated" ON "public"."entities" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "entities: select if member" ON "public"."entities" AS PERMISSIVE FOR SELECT TO PUBLIC USING (user_can_access_entity(id));

CREATE POLICY "entities: update if owner/admin" ON "public"."entities" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM entity_memberships m
  WHERE ((m.entity_id = m.id) AND (m.user_id = auth.uid()) AND (m.is_active = true) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "ft_delete_owner_manager" ON "public"."finance_transactions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((fin_business_role(workspace_id) = ANY (ARRAY['owner'::text, 'manager'::text])));

CREATE POLICY "ft_insert_workspace_members" ON "public"."finance_transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((fin_is_business_member(workspace_id) AND ((agent_id = 'geniesphere'::text) OR fin_is_agent_member(workspace_id, agent_id))));

CREATE POLICY "ft_read_workspace_members" ON "public"."finance_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((fin_is_business_member(workspace_id) AND ((agent_id = 'geniesphere'::text) OR fin_is_agent_member(workspace_id, agent_id))));

CREATE POLICY "ft_update_owner_manager" ON "public"."finance_transactions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((fin_business_role(workspace_id) = ANY (ARRAY['owner'::text, 'manager'::text]))) WITH CHECK ((fin_business_role(workspace_id) = ANY (ARRAY['owner'::text, 'manager'::text])));

CREATE POLICY "accounts: insert if owner/admin" ON "public"."financial_accounts" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM entity_memberships m
  WHERE ((m.entity_id = m.entity_id) AND (m.user_id = auth.uid()) AND (m.is_active = true) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "accounts: select if entity member" ON "public"."financial_accounts" AS PERMISSIVE FOR SELECT TO PUBLIC USING (user_can_access_entity(entity_id));

CREATE POLICY "accounts: update if owner/admin" ON "public"."financial_accounts" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM entity_memberships m
  WHERE ((m.entity_id = m.entity_id) AND (m.user_id = auth.uid()) AND (m.is_active = true) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));

CREATE POLICY "jt_delete_own" ON "public"."journal_trades" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "jt_insert_own" ON "public"."journal_trades" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "jt_select_own" ON "public"."journal_trades" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "jt_update_own" ON "public"."journal_trades" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "market_snapshots_read_all" ON "public"."market_snapshots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "oc_delete_own" ON "public"."option_chains" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "oc_insert_own" ON "public"."option_chains" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "oc_select_own" ON "public"."option_chains" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "oc_update_own" ON "public"."option_chains" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "option_roll_chains_own_rows" ON "public"."option_roll_chains" AS PERMISSIVE FOR ALL TO "authenticated" USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "admins read any profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (ap_is_admin());

CREATE POLICY "admins update any profile" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (ap_is_admin()) WITH CHECK (ap_is_admin());

CREATE POLICY "users read own profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = id));

CREATE POLICY "users update own profile" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = id));

CREATE POLICY "own rows only - options" ON "public"."tj_options" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "tj_options_delete_own" ON "public"."tj_options" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "tj_options_insert_own" ON "public"."tj_options" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "tj_options_select_own" ON "public"."tj_options" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "tj_options_update_own" ON "public"."tj_options" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "own rows only - stocks" ON "public"."tj_stocks" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "tj_stocks_delete_own" ON "public"."tj_stocks" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "tj_stocks_insert_own" ON "public"."tj_stocks" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "tj_stocks_select_own" ON "public"."tj_stocks" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "tj_stocks_update_own" ON "public"."tj_stocks" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can delete their journal" ON "public"."trading_journal" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert into their journal" ON "public"."trading_journal" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their journal" ON "public"."trading_journal" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view their own journal" ON "public"."trading_journal" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Users can manage their own API keys" ON "public"."user_api_keys" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users delete own API keys" ON "public"."user_api_keys" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Users insert own API keys" ON "public"."user_api_keys" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users read own API keys" ON "public"."user_api_keys" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "Users update own API keys" ON "public"."user_api_keys" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "cash_balances_user_owns" ON "public"."user_cash_balances" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "deployment_plans_user_owns" ON "public"."user_deployment_plans" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "delete own items" ON "public"."watchlist_items" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = auth.uid()));

CREATE POLICY "items modify via own watchlist" ON "public"."watchlist_items" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM watchlists w
  WHERE ((w.id = watchlist_items.watchlist_id) AND (w.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM watchlists w
  WHERE ((w.id = watchlist_items.watchlist_id) AND (w.user_id = auth.uid())))));

CREATE POLICY "items select via own watchlist" ON "public"."watchlist_items" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM watchlists w
  WHERE ((w.id = watchlist_items.watchlist_id) AND (w.user_id = auth.uid())))));

CREATE POLICY "read own items" ON "public"."watchlist_items" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));

CREATE POLICY "update own items" ON "public"."watchlist_items" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "watchlist_items_own_rows" ON "public"."watchlist_items" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "write own items" ON "public"."watchlist_items" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users can read their watchlist" ON "public"."watchlists" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((user_id)::text = (auth.uid())::text));

CREATE POLICY "Users can update their watchlist" ON "public"."watchlists" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((user_id)::text = (auth.uid())::text)) WITH CHECK (((user_id)::text = (auth.uid())::text));

CREATE POLICY "Users can upsert their watchlist" ON "public"."watchlists" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((user_id)::text = (auth.uid())::text));

CREATE POLICY "delete own watchlists" ON "public"."watchlists" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = auth.uid()));

CREATE POLICY "read own watchlists" ON "public"."watchlists" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));

CREATE POLICY "update own watchlists" ON "public"."watchlists" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "watchlists modify own" ON "public"."watchlists" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "watchlists select own" ON "public"."watchlists" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

CREATE POLICY "write own watchlists" ON "public"."watchlists" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = auth.uid()));

CREATE VIEW "public"."arowana_tools" WITH (security_invoker=true) AS
 SELECT tools.slug,
    tools.label,
    tools.emoji,
    tools.href,
    tools.category,
    tools.is_live,
    tools.sort_order,
    tools.updated_at
   FROM arowana.tools;

ALTER VIEW "public"."arowana_tools" OWNER TO "postgres";

CREATE VIEW "public"."arowana_webhooks" WITH (security_invoker=true) AS
 SELECT webhooks.key,
    webhooks.url,
    webhooks.label,
    webhooks.group_name,
    webhooks.is_live,
    webhooks.notes,
    webhooks.updated_by,
    webhooks.updated_at
   FROM arowana.webhooks;

ALTER VIEW "public"."arowana_webhooks" OWNER TO "postgres";

CREATE VIEW "public"."user_preferences" WITH (security_invoker=true) AS
 SELECT gsup.user_id,
    gsup.full_name,
    gsup.role,
    gsup.active_business_id,
    gsup.active_business_id AS selected_business_id,
    gsup.default_agent AS primary_agent,
    gsup.default_agent,
    gsup.last_seen_reviews_at
   FROM gs_user_preferences gsup;

ALTER VIEW "public"."user_preferences" OWNER TO "postgres";

CREATE VIEW "public"."v_finance_month_summary_all" WITH (security_invoker=true) AS
 SELECT bp.owner_id AS user_id,
    date_trunc('month'::text, ft.occurred_on::timestamp with time zone)::date AS month_start,
    sum(
        CASE
            WHEN ft.direction::text = 'income'::text THEN ft.amount
            ELSE 0::numeric
        END) AS income_total,
    sum(
        CASE
            WHEN ft.direction::text = 'expense'::text THEN ft.amount
            ELSE 0::numeric
        END) AS expense_total
   FROM finance_transactions ft
     JOIN business_profiles bp ON bp.id = ft.workspace_id
  GROUP BY bp.owner_id, (date_trunc('month'::text, ft.occurred_on::timestamp with time zone)::date);

ALTER VIEW "public"."v_finance_month_summary_all" OWNER TO "postgres";

CREATE VIEW "public"."v_finance_top_categories_month_all" WITH (security_invoker=true) AS
 SELECT bp.owner_id AS user_id,
    date_trunc('month'::text, ft.occurred_on::timestamp with time zone)::date AS month_start,
    ft.direction::text AS kind,
    COALESCE(fc.name, 'Uncategorized'::text) AS category_name,
    sum(ft.amount) AS total_amount
   FROM finance_transactions ft
     JOIN business_profiles bp ON bp.id = ft.workspace_id
     LEFT JOIN finance_categories fc ON fc.id = ft.category_id AND (fc.workspace_id = ft.workspace_id OR fc.workspace_id IS NULL)
  GROUP BY bp.owner_id, (date_trunc('month'::text, ft.occurred_on::timestamp with time zone)::date), (ft.direction::text), (COALESCE(fc.name, 'Uncategorized'::text));

ALTER VIEW "public"."v_finance_top_categories_month_all" OWNER TO "postgres";

REVOKE ALL ON TABLE "arowana"."entities" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "arowana"."financial_accounts" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."ai_briefs" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."ap_founders_waitlist" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."ap_risk_settings" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."ap_roll_coach" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."ap_usage" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."app_config" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."arowana_tools" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."arowana_webhooks" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."business_profiles" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."cc_candidates" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."csp_candidates" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."daily_setups" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."entities" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."finance_transactions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."financial_accounts" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."journal_trades" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."market_snapshots" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."option_chains" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."option_roll_chains" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."profiles" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."tj_options" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."tj_stocks" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."trading_journal" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."user_api_keys" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."user_cash_balances" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."user_deployment_plans" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."user_preferences" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."v_finance_month_summary_all" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."v_finance_top_categories_month_all" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."watchlist_items" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."watchlists" FROM PUBLIC, anon, authenticated, service_role;

GRANT DELETE ON TABLE "arowana"."entities" TO "authenticated";

GRANT INSERT ON TABLE "arowana"."entities" TO "authenticated";

GRANT SELECT ON TABLE "arowana"."entities" TO "authenticated";

GRANT UPDATE ON TABLE "arowana"."entities" TO "authenticated";

GRANT DELETE ON TABLE "arowana"."financial_accounts" TO "authenticated";

GRANT INSERT ON TABLE "arowana"."financial_accounts" TO "authenticated";

GRANT SELECT ON TABLE "arowana"."financial_accounts" TO "authenticated";

GRANT UPDATE ON TABLE "arowana"."financial_accounts" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."ai_briefs" TO "anon";

GRANT SELECT ON TABLE "public"."ai_briefs" TO "anon";

GRANT TRIGGER ON TABLE "public"."ai_briefs" TO "anon";

GRANT DELETE ON TABLE "public"."ai_briefs" TO "authenticated";

GRANT INSERT ON TABLE "public"."ai_briefs" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."ai_briefs" TO "authenticated";

GRANT SELECT ON TABLE "public"."ai_briefs" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."ai_briefs" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."ai_briefs" TO "authenticated";

GRANT UPDATE ON TABLE "public"."ai_briefs" TO "authenticated";

GRANT DELETE ON TABLE "public"."ai_briefs" TO "service_role";

GRANT INSERT ON TABLE "public"."ai_briefs" TO "service_role";

GRANT REFERENCES ON TABLE "public"."ai_briefs" TO "service_role";

GRANT SELECT ON TABLE "public"."ai_briefs" TO "service_role";

GRANT TRIGGER ON TABLE "public"."ai_briefs" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."ai_briefs" TO "service_role";

GRANT UPDATE ON TABLE "public"."ai_briefs" TO "service_role";

GRANT DELETE ON TABLE "public"."ap_founders_waitlist" TO "service_role";

GRANT INSERT ON TABLE "public"."ap_founders_waitlist" TO "service_role";

GRANT REFERENCES ON TABLE "public"."ap_founders_waitlist" TO "service_role";

GRANT SELECT ON TABLE "public"."ap_founders_waitlist" TO "service_role";

GRANT TRIGGER ON TABLE "public"."ap_founders_waitlist" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."ap_founders_waitlist" TO "service_role";

GRANT UPDATE ON TABLE "public"."ap_founders_waitlist" TO "service_role";

GRANT REFERENCES ON TABLE "public"."ap_risk_settings" TO "anon";

GRANT SELECT ON TABLE "public"."ap_risk_settings" TO "anon";

GRANT TRIGGER ON TABLE "public"."ap_risk_settings" TO "anon";

GRANT DELETE ON TABLE "public"."ap_risk_settings" TO "authenticated";

GRANT INSERT ON TABLE "public"."ap_risk_settings" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."ap_risk_settings" TO "authenticated";

GRANT SELECT ON TABLE "public"."ap_risk_settings" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."ap_risk_settings" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."ap_risk_settings" TO "authenticated";

GRANT UPDATE ON TABLE "public"."ap_risk_settings" TO "authenticated";

GRANT DELETE ON TABLE "public"."ap_risk_settings" TO "service_role";

GRANT INSERT ON TABLE "public"."ap_risk_settings" TO "service_role";

GRANT REFERENCES ON TABLE "public"."ap_risk_settings" TO "service_role";

GRANT SELECT ON TABLE "public"."ap_risk_settings" TO "service_role";

GRANT TRIGGER ON TABLE "public"."ap_risk_settings" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."ap_risk_settings" TO "service_role";

GRANT UPDATE ON TABLE "public"."ap_risk_settings" TO "service_role";

GRANT REFERENCES ON TABLE "public"."ap_roll_coach" TO "anon";

GRANT SELECT ON TABLE "public"."ap_roll_coach" TO "anon";

GRANT TRIGGER ON TABLE "public"."ap_roll_coach" TO "anon";

GRANT DELETE ON TABLE "public"."ap_roll_coach" TO "authenticated";

GRANT INSERT ON TABLE "public"."ap_roll_coach" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."ap_roll_coach" TO "authenticated";

GRANT SELECT ON TABLE "public"."ap_roll_coach" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."ap_roll_coach" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."ap_roll_coach" TO "authenticated";

GRANT UPDATE ON TABLE "public"."ap_roll_coach" TO "authenticated";

GRANT DELETE ON TABLE "public"."ap_roll_coach" TO "service_role";

GRANT INSERT ON TABLE "public"."ap_roll_coach" TO "service_role";

GRANT REFERENCES ON TABLE "public"."ap_roll_coach" TO "service_role";

GRANT SELECT ON TABLE "public"."ap_roll_coach" TO "service_role";

GRANT TRIGGER ON TABLE "public"."ap_roll_coach" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."ap_roll_coach" TO "service_role";

GRANT UPDATE ON TABLE "public"."ap_roll_coach" TO "service_role";

GRANT REFERENCES ON TABLE "public"."ap_usage" TO "anon";

GRANT SELECT ON TABLE "public"."ap_usage" TO "anon";

GRANT TRIGGER ON TABLE "public"."ap_usage" TO "anon";

GRANT DELETE ON TABLE "public"."ap_usage" TO "authenticated";

GRANT INSERT ON TABLE "public"."ap_usage" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."ap_usage" TO "authenticated";

GRANT SELECT ON TABLE "public"."ap_usage" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."ap_usage" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."ap_usage" TO "authenticated";

GRANT UPDATE ON TABLE "public"."ap_usage" TO "authenticated";

GRANT DELETE ON TABLE "public"."ap_usage" TO "service_role";

GRANT INSERT ON TABLE "public"."ap_usage" TO "service_role";

GRANT REFERENCES ON TABLE "public"."ap_usage" TO "service_role";

GRANT SELECT ON TABLE "public"."ap_usage" TO "service_role";

GRANT TRIGGER ON TABLE "public"."ap_usage" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."ap_usage" TO "service_role";

GRANT UPDATE ON TABLE "public"."ap_usage" TO "service_role";

GRANT REFERENCES ON TABLE "public"."app_config" TO "anon";

GRANT SELECT ON TABLE "public"."app_config" TO "anon";

GRANT TRIGGER ON TABLE "public"."app_config" TO "anon";

GRANT DELETE ON TABLE "public"."app_config" TO "authenticated";

GRANT INSERT ON TABLE "public"."app_config" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."app_config" TO "authenticated";

GRANT SELECT ON TABLE "public"."app_config" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."app_config" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."app_config" TO "authenticated";

GRANT UPDATE ON TABLE "public"."app_config" TO "authenticated";

GRANT DELETE ON TABLE "public"."app_config" TO "service_role";

GRANT INSERT ON TABLE "public"."app_config" TO "service_role";

GRANT REFERENCES ON TABLE "public"."app_config" TO "service_role";

GRANT SELECT ON TABLE "public"."app_config" TO "service_role";

GRANT TRIGGER ON TABLE "public"."app_config" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."app_config" TO "service_role";

GRANT UPDATE ON TABLE "public"."app_config" TO "service_role";

GRANT REFERENCES ON TABLE "public"."arowana_tools" TO "anon";

GRANT SELECT ON TABLE "public"."arowana_tools" TO "anon";

GRANT TRIGGER ON TABLE "public"."arowana_tools" TO "anon";

GRANT DELETE ON TABLE "public"."arowana_tools" TO "authenticated";

GRANT INSERT ON TABLE "public"."arowana_tools" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."arowana_tools" TO "authenticated";

GRANT SELECT ON TABLE "public"."arowana_tools" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."arowana_tools" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."arowana_tools" TO "authenticated";

GRANT UPDATE ON TABLE "public"."arowana_tools" TO "authenticated";

GRANT DELETE ON TABLE "public"."arowana_tools" TO "service_role";

GRANT INSERT ON TABLE "public"."arowana_tools" TO "service_role";

GRANT REFERENCES ON TABLE "public"."arowana_tools" TO "service_role";

GRANT SELECT ON TABLE "public"."arowana_tools" TO "service_role";

GRANT TRIGGER ON TABLE "public"."arowana_tools" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."arowana_tools" TO "service_role";

GRANT UPDATE ON TABLE "public"."arowana_tools" TO "service_role";

GRANT REFERENCES ON TABLE "public"."arowana_webhooks" TO "anon";

GRANT SELECT ON TABLE "public"."arowana_webhooks" TO "anon";

GRANT TRIGGER ON TABLE "public"."arowana_webhooks" TO "anon";

GRANT DELETE ON TABLE "public"."arowana_webhooks" TO "authenticated";

GRANT INSERT ON TABLE "public"."arowana_webhooks" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."arowana_webhooks" TO "authenticated";

GRANT SELECT ON TABLE "public"."arowana_webhooks" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."arowana_webhooks" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."arowana_webhooks" TO "authenticated";

GRANT UPDATE ON TABLE "public"."arowana_webhooks" TO "authenticated";

GRANT DELETE ON TABLE "public"."arowana_webhooks" TO "service_role";

GRANT INSERT ON TABLE "public"."arowana_webhooks" TO "service_role";

GRANT REFERENCES ON TABLE "public"."arowana_webhooks" TO "service_role";

GRANT SELECT ON TABLE "public"."arowana_webhooks" TO "service_role";

GRANT TRIGGER ON TABLE "public"."arowana_webhooks" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."arowana_webhooks" TO "service_role";

GRANT UPDATE ON TABLE "public"."arowana_webhooks" TO "service_role";

GRANT DELETE ON TABLE "public"."business_profiles" TO "authenticated";

GRANT INSERT ON TABLE "public"."business_profiles" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."business_profiles" TO "authenticated";

GRANT SELECT ON TABLE "public"."business_profiles" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."business_profiles" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."business_profiles" TO "authenticated";

GRANT UPDATE ON TABLE "public"."business_profiles" TO "authenticated";

GRANT DELETE ON TABLE "public"."business_profiles" TO "service_role";

GRANT INSERT ON TABLE "public"."business_profiles" TO "service_role";

GRANT REFERENCES ON TABLE "public"."business_profiles" TO "service_role";

GRANT SELECT ON TABLE "public"."business_profiles" TO "service_role";

GRANT TRIGGER ON TABLE "public"."business_profiles" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."business_profiles" TO "service_role";

GRANT UPDATE ON TABLE "public"."business_profiles" TO "service_role";

GRANT REFERENCES ON TABLE "public"."cc_candidates" TO "anon";

GRANT SELECT ON TABLE "public"."cc_candidates" TO "anon";

GRANT TRIGGER ON TABLE "public"."cc_candidates" TO "anon";

GRANT DELETE ON TABLE "public"."cc_candidates" TO "authenticated";

GRANT INSERT ON TABLE "public"."cc_candidates" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."cc_candidates" TO "authenticated";

GRANT SELECT ON TABLE "public"."cc_candidates" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."cc_candidates" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."cc_candidates" TO "authenticated";

GRANT UPDATE ON TABLE "public"."cc_candidates" TO "authenticated";

GRANT DELETE ON TABLE "public"."cc_candidates" TO "service_role";

GRANT INSERT ON TABLE "public"."cc_candidates" TO "service_role";

GRANT REFERENCES ON TABLE "public"."cc_candidates" TO "service_role";

GRANT SELECT ON TABLE "public"."cc_candidates" TO "service_role";

GRANT TRIGGER ON TABLE "public"."cc_candidates" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."cc_candidates" TO "service_role";

GRANT UPDATE ON TABLE "public"."cc_candidates" TO "service_role";

GRANT REFERENCES ON TABLE "public"."csp_candidates" TO "anon";

GRANT SELECT ON TABLE "public"."csp_candidates" TO "anon";

GRANT TRIGGER ON TABLE "public"."csp_candidates" TO "anon";

GRANT DELETE ON TABLE "public"."csp_candidates" TO "authenticated";

GRANT INSERT ON TABLE "public"."csp_candidates" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."csp_candidates" TO "authenticated";

GRANT SELECT ON TABLE "public"."csp_candidates" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."csp_candidates" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."csp_candidates" TO "authenticated";

GRANT UPDATE ON TABLE "public"."csp_candidates" TO "authenticated";

GRANT DELETE ON TABLE "public"."csp_candidates" TO "service_role";

GRANT INSERT ON TABLE "public"."csp_candidates" TO "service_role";

GRANT REFERENCES ON TABLE "public"."csp_candidates" TO "service_role";

GRANT SELECT ON TABLE "public"."csp_candidates" TO "service_role";

GRANT TRIGGER ON TABLE "public"."csp_candidates" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."csp_candidates" TO "service_role";

GRANT UPDATE ON TABLE "public"."csp_candidates" TO "service_role";

GRANT REFERENCES ON TABLE "public"."daily_setups" TO "anon";

GRANT SELECT ON TABLE "public"."daily_setups" TO "anon";

GRANT TRIGGER ON TABLE "public"."daily_setups" TO "anon";

GRANT DELETE ON TABLE "public"."daily_setups" TO "authenticated";

GRANT INSERT ON TABLE "public"."daily_setups" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."daily_setups" TO "authenticated";

GRANT SELECT ON TABLE "public"."daily_setups" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."daily_setups" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."daily_setups" TO "authenticated";

GRANT UPDATE ON TABLE "public"."daily_setups" TO "authenticated";

GRANT DELETE ON TABLE "public"."daily_setups" TO "service_role";

GRANT INSERT ON TABLE "public"."daily_setups" TO "service_role";

GRANT REFERENCES ON TABLE "public"."daily_setups" TO "service_role";

GRANT SELECT ON TABLE "public"."daily_setups" TO "service_role";

GRANT TRIGGER ON TABLE "public"."daily_setups" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."daily_setups" TO "service_role";

GRANT UPDATE ON TABLE "public"."daily_setups" TO "service_role";

GRANT REFERENCES ON TABLE "public"."entities" TO "anon";

GRANT SELECT ON TABLE "public"."entities" TO "anon";

GRANT TRIGGER ON TABLE "public"."entities" TO "anon";

GRANT DELETE ON TABLE "public"."entities" TO "authenticated";

GRANT INSERT ON TABLE "public"."entities" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."entities" TO "authenticated";

GRANT SELECT ON TABLE "public"."entities" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."entities" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."entities" TO "authenticated";

GRANT UPDATE ON TABLE "public"."entities" TO "authenticated";

GRANT DELETE ON TABLE "public"."entities" TO "service_role";

GRANT INSERT ON TABLE "public"."entities" TO "service_role";

GRANT REFERENCES ON TABLE "public"."entities" TO "service_role";

GRANT SELECT ON TABLE "public"."entities" TO "service_role";

GRANT TRIGGER ON TABLE "public"."entities" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."entities" TO "service_role";

GRANT UPDATE ON TABLE "public"."entities" TO "service_role";

GRANT REFERENCES ON TABLE "public"."finance_transactions" TO "anon";

GRANT SELECT ON TABLE "public"."finance_transactions" TO "anon";

GRANT TRIGGER ON TABLE "public"."finance_transactions" TO "anon";

GRANT DELETE ON TABLE "public"."finance_transactions" TO "authenticated";

GRANT INSERT ON TABLE "public"."finance_transactions" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."finance_transactions" TO "authenticated";

GRANT SELECT ON TABLE "public"."finance_transactions" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."finance_transactions" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."finance_transactions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."finance_transactions" TO "authenticated";

GRANT DELETE ON TABLE "public"."finance_transactions" TO "service_role";

GRANT INSERT ON TABLE "public"."finance_transactions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."finance_transactions" TO "service_role";

GRANT SELECT ON TABLE "public"."finance_transactions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."finance_transactions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."finance_transactions" TO "service_role";

GRANT UPDATE ON TABLE "public"."finance_transactions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."financial_accounts" TO "anon";

GRANT SELECT ON TABLE "public"."financial_accounts" TO "anon";

GRANT TRIGGER ON TABLE "public"."financial_accounts" TO "anon";

GRANT DELETE ON TABLE "public"."financial_accounts" TO "authenticated";

GRANT INSERT ON TABLE "public"."financial_accounts" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."financial_accounts" TO "authenticated";

GRANT SELECT ON TABLE "public"."financial_accounts" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."financial_accounts" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."financial_accounts" TO "authenticated";

GRANT UPDATE ON TABLE "public"."financial_accounts" TO "authenticated";

GRANT DELETE ON TABLE "public"."financial_accounts" TO "service_role";

GRANT INSERT ON TABLE "public"."financial_accounts" TO "service_role";

GRANT REFERENCES ON TABLE "public"."financial_accounts" TO "service_role";

GRANT SELECT ON TABLE "public"."financial_accounts" TO "service_role";

GRANT TRIGGER ON TABLE "public"."financial_accounts" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."financial_accounts" TO "service_role";

GRANT UPDATE ON TABLE "public"."financial_accounts" TO "service_role";

GRANT REFERENCES ON TABLE "public"."journal_trades" TO "anon";

GRANT SELECT ON TABLE "public"."journal_trades" TO "anon";

GRANT TRIGGER ON TABLE "public"."journal_trades" TO "anon";

GRANT DELETE ON TABLE "public"."journal_trades" TO "authenticated";

GRANT INSERT ON TABLE "public"."journal_trades" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."journal_trades" TO "authenticated";

GRANT SELECT ON TABLE "public"."journal_trades" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."journal_trades" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."journal_trades" TO "authenticated";

GRANT UPDATE ON TABLE "public"."journal_trades" TO "authenticated";

GRANT DELETE ON TABLE "public"."journal_trades" TO "service_role";

GRANT INSERT ON TABLE "public"."journal_trades" TO "service_role";

GRANT REFERENCES ON TABLE "public"."journal_trades" TO "service_role";

GRANT SELECT ON TABLE "public"."journal_trades" TO "service_role";

GRANT TRIGGER ON TABLE "public"."journal_trades" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."journal_trades" TO "service_role";

GRANT UPDATE ON TABLE "public"."journal_trades" TO "service_role";

GRANT REFERENCES ON TABLE "public"."market_snapshots" TO "anon";

GRANT SELECT ON TABLE "public"."market_snapshots" TO "anon";

GRANT TRIGGER ON TABLE "public"."market_snapshots" TO "anon";

GRANT DELETE ON TABLE "public"."market_snapshots" TO "authenticated";

GRANT INSERT ON TABLE "public"."market_snapshots" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."market_snapshots" TO "authenticated";

GRANT SELECT ON TABLE "public"."market_snapshots" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."market_snapshots" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."market_snapshots" TO "authenticated";

GRANT UPDATE ON TABLE "public"."market_snapshots" TO "authenticated";

GRANT DELETE ON TABLE "public"."market_snapshots" TO "service_role";

GRANT INSERT ON TABLE "public"."market_snapshots" TO "service_role";

GRANT REFERENCES ON TABLE "public"."market_snapshots" TO "service_role";

GRANT SELECT ON TABLE "public"."market_snapshots" TO "service_role";

GRANT TRIGGER ON TABLE "public"."market_snapshots" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."market_snapshots" TO "service_role";

GRANT UPDATE ON TABLE "public"."market_snapshots" TO "service_role";

GRANT REFERENCES ON TABLE "public"."option_chains" TO "anon";

GRANT SELECT ON TABLE "public"."option_chains" TO "anon";

GRANT TRIGGER ON TABLE "public"."option_chains" TO "anon";

GRANT DELETE ON TABLE "public"."option_chains" TO "authenticated";

GRANT INSERT ON TABLE "public"."option_chains" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."option_chains" TO "authenticated";

GRANT SELECT ON TABLE "public"."option_chains" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."option_chains" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."option_chains" TO "authenticated";

GRANT UPDATE ON TABLE "public"."option_chains" TO "authenticated";

GRANT DELETE ON TABLE "public"."option_chains" TO "service_role";

GRANT INSERT ON TABLE "public"."option_chains" TO "service_role";

GRANT REFERENCES ON TABLE "public"."option_chains" TO "service_role";

GRANT SELECT ON TABLE "public"."option_chains" TO "service_role";

GRANT TRIGGER ON TABLE "public"."option_chains" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."option_chains" TO "service_role";

GRANT UPDATE ON TABLE "public"."option_chains" TO "service_role";

GRANT REFERENCES ON TABLE "public"."option_roll_chains" TO "anon";

GRANT SELECT ON TABLE "public"."option_roll_chains" TO "anon";

GRANT TRIGGER ON TABLE "public"."option_roll_chains" TO "anon";

GRANT DELETE ON TABLE "public"."option_roll_chains" TO "authenticated";

GRANT INSERT ON TABLE "public"."option_roll_chains" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."option_roll_chains" TO "authenticated";

GRANT SELECT ON TABLE "public"."option_roll_chains" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."option_roll_chains" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."option_roll_chains" TO "authenticated";

GRANT UPDATE ON TABLE "public"."option_roll_chains" TO "authenticated";

GRANT DELETE ON TABLE "public"."option_roll_chains" TO "service_role";

GRANT INSERT ON TABLE "public"."option_roll_chains" TO "service_role";

GRANT REFERENCES ON TABLE "public"."option_roll_chains" TO "service_role";

GRANT SELECT ON TABLE "public"."option_roll_chains" TO "service_role";

GRANT TRIGGER ON TABLE "public"."option_roll_chains" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."option_roll_chains" TO "service_role";

GRANT UPDATE ON TABLE "public"."option_roll_chains" TO "service_role";

GRANT REFERENCES ON TABLE "public"."profiles" TO "anon";

GRANT SELECT ON TABLE "public"."profiles" TO "anon";

GRANT TRIGGER ON TABLE "public"."profiles" TO "anon";

GRANT DELETE ON TABLE "public"."profiles" TO "authenticated";

GRANT INSERT ON TABLE "public"."profiles" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."profiles" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE ON TABLE "public"."profiles" TO "authenticated";

GRANT DELETE ON TABLE "public"."profiles" TO "service_role";

GRANT INSERT ON TABLE "public"."profiles" TO "service_role";

GRANT REFERENCES ON TABLE "public"."profiles" TO "service_role";

GRANT SELECT ON TABLE "public"."profiles" TO "service_role";

GRANT TRIGGER ON TABLE "public"."profiles" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."profiles" TO "service_role";

GRANT UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT REFERENCES ON TABLE "public"."tj_options" TO "anon";

GRANT SELECT ON TABLE "public"."tj_options" TO "anon";

GRANT TRIGGER ON TABLE "public"."tj_options" TO "anon";

GRANT DELETE ON TABLE "public"."tj_options" TO "authenticated";

GRANT INSERT ON TABLE "public"."tj_options" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."tj_options" TO "authenticated";

GRANT SELECT ON TABLE "public"."tj_options" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."tj_options" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."tj_options" TO "authenticated";

GRANT UPDATE ON TABLE "public"."tj_options" TO "authenticated";

GRANT DELETE ON TABLE "public"."tj_options" TO "service_role";

GRANT INSERT ON TABLE "public"."tj_options" TO "service_role";

GRANT REFERENCES ON TABLE "public"."tj_options" TO "service_role";

GRANT SELECT ON TABLE "public"."tj_options" TO "service_role";

GRANT TRIGGER ON TABLE "public"."tj_options" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."tj_options" TO "service_role";

GRANT UPDATE ON TABLE "public"."tj_options" TO "service_role";

GRANT REFERENCES ON TABLE "public"."tj_stocks" TO "anon";

GRANT SELECT ON TABLE "public"."tj_stocks" TO "anon";

GRANT TRIGGER ON TABLE "public"."tj_stocks" TO "anon";

GRANT DELETE ON TABLE "public"."tj_stocks" TO "authenticated";

GRANT INSERT ON TABLE "public"."tj_stocks" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."tj_stocks" TO "authenticated";

GRANT SELECT ON TABLE "public"."tj_stocks" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."tj_stocks" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."tj_stocks" TO "authenticated";

GRANT UPDATE ON TABLE "public"."tj_stocks" TO "authenticated";

GRANT DELETE ON TABLE "public"."tj_stocks" TO "service_role";

GRANT INSERT ON TABLE "public"."tj_stocks" TO "service_role";

GRANT REFERENCES ON TABLE "public"."tj_stocks" TO "service_role";

GRANT SELECT ON TABLE "public"."tj_stocks" TO "service_role";

GRANT TRIGGER ON TABLE "public"."tj_stocks" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."tj_stocks" TO "service_role";

GRANT UPDATE ON TABLE "public"."tj_stocks" TO "service_role";

GRANT REFERENCES ON TABLE "public"."trading_journal" TO "anon";

GRANT SELECT ON TABLE "public"."trading_journal" TO "anon";

GRANT TRIGGER ON TABLE "public"."trading_journal" TO "anon";

GRANT DELETE ON TABLE "public"."trading_journal" TO "authenticated";

GRANT INSERT ON TABLE "public"."trading_journal" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."trading_journal" TO "authenticated";

GRANT SELECT ON TABLE "public"."trading_journal" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."trading_journal" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."trading_journal" TO "authenticated";

GRANT UPDATE ON TABLE "public"."trading_journal" TO "authenticated";

GRANT DELETE ON TABLE "public"."trading_journal" TO "service_role";

GRANT INSERT ON TABLE "public"."trading_journal" TO "service_role";

GRANT REFERENCES ON TABLE "public"."trading_journal" TO "service_role";

GRANT SELECT ON TABLE "public"."trading_journal" TO "service_role";

GRANT TRIGGER ON TABLE "public"."trading_journal" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."trading_journal" TO "service_role";

GRANT UPDATE ON TABLE "public"."trading_journal" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_api_keys" TO "anon";

GRANT SELECT ON TABLE "public"."user_api_keys" TO "anon";

GRANT TRIGGER ON TABLE "public"."user_api_keys" TO "anon";

GRANT DELETE ON TABLE "public"."user_api_keys" TO "authenticated";

GRANT INSERT ON TABLE "public"."user_api_keys" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."user_api_keys" TO "authenticated";

GRANT SELECT ON TABLE "public"."user_api_keys" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."user_api_keys" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."user_api_keys" TO "authenticated";

GRANT UPDATE ON TABLE "public"."user_api_keys" TO "authenticated";

GRANT DELETE ON TABLE "public"."user_api_keys" TO "service_role";

GRANT INSERT ON TABLE "public"."user_api_keys" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_api_keys" TO "service_role";

GRANT SELECT ON TABLE "public"."user_api_keys" TO "service_role";

GRANT TRIGGER ON TABLE "public"."user_api_keys" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."user_api_keys" TO "service_role";

GRANT UPDATE ON TABLE "public"."user_api_keys" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_cash_balances" TO "anon";

GRANT SELECT ON TABLE "public"."user_cash_balances" TO "anon";

GRANT TRIGGER ON TABLE "public"."user_cash_balances" TO "anon";

GRANT DELETE ON TABLE "public"."user_cash_balances" TO "authenticated";

GRANT INSERT ON TABLE "public"."user_cash_balances" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."user_cash_balances" TO "authenticated";

GRANT SELECT ON TABLE "public"."user_cash_balances" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."user_cash_balances" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."user_cash_balances" TO "authenticated";

GRANT UPDATE ON TABLE "public"."user_cash_balances" TO "authenticated";

GRANT DELETE ON TABLE "public"."user_cash_balances" TO "service_role";

GRANT INSERT ON TABLE "public"."user_cash_balances" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_cash_balances" TO "service_role";

GRANT SELECT ON TABLE "public"."user_cash_balances" TO "service_role";

GRANT TRIGGER ON TABLE "public"."user_cash_balances" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."user_cash_balances" TO "service_role";

GRANT UPDATE ON TABLE "public"."user_cash_balances" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_deployment_plans" TO "anon";

GRANT SELECT ON TABLE "public"."user_deployment_plans" TO "anon";

GRANT TRIGGER ON TABLE "public"."user_deployment_plans" TO "anon";

GRANT DELETE ON TABLE "public"."user_deployment_plans" TO "authenticated";

GRANT INSERT ON TABLE "public"."user_deployment_plans" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."user_deployment_plans" TO "authenticated";

GRANT SELECT ON TABLE "public"."user_deployment_plans" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."user_deployment_plans" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."user_deployment_plans" TO "authenticated";

GRANT UPDATE ON TABLE "public"."user_deployment_plans" TO "authenticated";

GRANT DELETE ON TABLE "public"."user_deployment_plans" TO "service_role";

GRANT INSERT ON TABLE "public"."user_deployment_plans" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_deployment_plans" TO "service_role";

GRANT SELECT ON TABLE "public"."user_deployment_plans" TO "service_role";

GRANT TRIGGER ON TABLE "public"."user_deployment_plans" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."user_deployment_plans" TO "service_role";

GRANT UPDATE ON TABLE "public"."user_deployment_plans" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_preferences" TO "anon";

GRANT TRIGGER ON TABLE "public"."user_preferences" TO "anon";

GRANT DELETE ON TABLE "public"."user_preferences" TO "authenticated";

GRANT INSERT ON TABLE "public"."user_preferences" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."user_preferences" TO "authenticated";

GRANT SELECT ON TABLE "public"."user_preferences" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."user_preferences" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."user_preferences" TO "authenticated";

GRANT UPDATE ON TABLE "public"."user_preferences" TO "authenticated";

GRANT DELETE ON TABLE "public"."user_preferences" TO "service_role";

GRANT INSERT ON TABLE "public"."user_preferences" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_preferences" TO "service_role";

GRANT SELECT ON TABLE "public"."user_preferences" TO "service_role";

GRANT TRIGGER ON TABLE "public"."user_preferences" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."user_preferences" TO "service_role";

GRANT UPDATE ON TABLE "public"."user_preferences" TO "service_role";

GRANT DELETE ON TABLE "public"."v_finance_month_summary_all" TO "authenticated";

GRANT INSERT ON TABLE "public"."v_finance_month_summary_all" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."v_finance_month_summary_all" TO "authenticated";

GRANT SELECT ON TABLE "public"."v_finance_month_summary_all" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."v_finance_month_summary_all" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."v_finance_month_summary_all" TO "authenticated";

GRANT UPDATE ON TABLE "public"."v_finance_month_summary_all" TO "authenticated";

GRANT DELETE ON TABLE "public"."v_finance_month_summary_all" TO "service_role";

GRANT INSERT ON TABLE "public"."v_finance_month_summary_all" TO "service_role";

GRANT REFERENCES ON TABLE "public"."v_finance_month_summary_all" TO "service_role";

GRANT SELECT ON TABLE "public"."v_finance_month_summary_all" TO "service_role";

GRANT TRIGGER ON TABLE "public"."v_finance_month_summary_all" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."v_finance_month_summary_all" TO "service_role";

GRANT UPDATE ON TABLE "public"."v_finance_month_summary_all" TO "service_role";

GRANT DELETE ON TABLE "public"."v_finance_top_categories_month_all" TO "authenticated";

GRANT INSERT ON TABLE "public"."v_finance_top_categories_month_all" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."v_finance_top_categories_month_all" TO "authenticated";

GRANT SELECT ON TABLE "public"."v_finance_top_categories_month_all" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."v_finance_top_categories_month_all" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."v_finance_top_categories_month_all" TO "authenticated";

GRANT UPDATE ON TABLE "public"."v_finance_top_categories_month_all" TO "authenticated";

GRANT DELETE ON TABLE "public"."v_finance_top_categories_month_all" TO "service_role";

GRANT INSERT ON TABLE "public"."v_finance_top_categories_month_all" TO "service_role";

GRANT REFERENCES ON TABLE "public"."v_finance_top_categories_month_all" TO "service_role";

GRANT SELECT ON TABLE "public"."v_finance_top_categories_month_all" TO "service_role";

GRANT TRIGGER ON TABLE "public"."v_finance_top_categories_month_all" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."v_finance_top_categories_month_all" TO "service_role";

GRANT UPDATE ON TABLE "public"."v_finance_top_categories_month_all" TO "service_role";

GRANT REFERENCES ON TABLE "public"."watchlist_items" TO "anon";

GRANT SELECT ON TABLE "public"."watchlist_items" TO "anon";

GRANT TRIGGER ON TABLE "public"."watchlist_items" TO "anon";

GRANT DELETE ON TABLE "public"."watchlist_items" TO "authenticated";

GRANT INSERT ON TABLE "public"."watchlist_items" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."watchlist_items" TO "authenticated";

GRANT SELECT ON TABLE "public"."watchlist_items" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."watchlist_items" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."watchlist_items" TO "authenticated";

GRANT UPDATE ON TABLE "public"."watchlist_items" TO "authenticated";

GRANT DELETE ON TABLE "public"."watchlist_items" TO "service_role";

GRANT INSERT ON TABLE "public"."watchlist_items" TO "service_role";

GRANT REFERENCES ON TABLE "public"."watchlist_items" TO "service_role";

GRANT SELECT ON TABLE "public"."watchlist_items" TO "service_role";

GRANT TRIGGER ON TABLE "public"."watchlist_items" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."watchlist_items" TO "service_role";

GRANT UPDATE ON TABLE "public"."watchlist_items" TO "service_role";

GRANT REFERENCES ON TABLE "public"."watchlists" TO "anon";

GRANT SELECT ON TABLE "public"."watchlists" TO "anon";

GRANT TRIGGER ON TABLE "public"."watchlists" TO "anon";

GRANT DELETE ON TABLE "public"."watchlists" TO "authenticated";

GRANT INSERT ON TABLE "public"."watchlists" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."watchlists" TO "authenticated";

GRANT SELECT ON TABLE "public"."watchlists" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."watchlists" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."watchlists" TO "authenticated";

GRANT UPDATE ON TABLE "public"."watchlists" TO "authenticated";

GRANT DELETE ON TABLE "public"."watchlists" TO "service_role";

GRANT INSERT ON TABLE "public"."watchlists" TO "service_role";

GRANT REFERENCES ON TABLE "public"."watchlists" TO "service_role";

GRANT SELECT ON TABLE "public"."watchlists" TO "service_role";

GRANT TRIGGER ON TABLE "public"."watchlists" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."watchlists" TO "service_role";

GRANT UPDATE ON TABLE "public"."watchlists" TO "service_role";

GRANT SELECT ("id") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("business_name") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("location") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("industry") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("business_type") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("hours") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("phone") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("website") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("logo_url") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("business_hours") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("google_place_id") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("is_listed") ON TABLE "public"."business_profiles" TO "anon";

GRANT SELECT ("tagline") ON TABLE "public"."business_profiles" TO "anon";

GRANT INSERT ("email") ON TABLE "public"."ap_founders_waitlist" TO "authenticated";

GRANT INSERT ("experience") ON TABLE "public"."ap_founders_waitlist" TO "authenticated";

GRANT INSERT ("source") ON TABLE "public"."ap_founders_waitlist" TO "authenticated";

REVOKE ALL ON FUNCTION "public"."ap_add_usage_cost"(uuid,text,text,numeric) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."ap_claim_usage"(uuid,text,text,integer,numeric) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."ap_is_admin"() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."ap_protect_profile_columns"() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."approve_journal_trade_candidate"(uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."ap_record_provider_call"(date,text,text,uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."ap_usage_summary"(integer) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "arowana"."set_updated_at"() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fin_business_role"(uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fin_is_agent_member"(uuid,text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fin_is_business_member"(uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."set_created_by"() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."touch_updated_at"() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."update_updated_at_column"() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."user_can_access_entity"(uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."touch_updated_at"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."touch_updated_at"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."touch_updated_at"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."touch_updated_at"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."user_can_access_entity"(uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."user_can_access_entity"(uuid) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."user_can_access_entity"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."user_can_access_entity"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_created_by"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."set_created_by"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."set_created_by"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_created_by"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."fin_is_business_member"(uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."fin_is_business_member"(uuid) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."fin_is_business_member"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fin_is_business_member"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."fin_is_agent_member"(uuid,text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."fin_is_agent_member"(uuid,text) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."fin_is_agent_member"(uuid,text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fin_is_agent_member"(uuid,text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."fin_business_role"(uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."fin_business_role"(uuid) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."fin_business_role"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."fin_business_role"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."approve_journal_trade_candidate"(uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."approve_journal_trade_candidate"(uuid) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."approve_journal_trade_candidate"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."approve_journal_trade_candidate"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_updated_at_column"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."update_updated_at_column"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."update_updated_at_column"() TO "service_role";

GRANT EXECUTE ON FUNCTION "arowana"."set_updated_at"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."ap_claim_usage"(uuid,text,text,integer,numeric) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."ap_add_usage_cost"(uuid,text,text,numeric) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."ap_record_provider_call"(date,text,text,uuid,boolean) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."ap_usage_summary"(integer) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."ap_usage_summary"(integer) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."ap_is_admin"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."ap_is_admin"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."ap_is_admin"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."ap_protect_profile_columns"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."ap_protect_profile_columns"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."ap_protect_profile_columns"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."ap_protect_profile_columns"() TO "service_role";

COMMENT ON COLUMN "public"."csp_candidates"."discount_pct" IS 'How far below the last close the breakeven (strike minus premium) sits, in percent.';

COMMENT ON COLUMN "public"."csp_candidates"."open_puts" IS 'Short puts the user already has open on this ticker, from the journal.';

COMMENT ON COLUMN "public"."csp_candidates"."reasons" IS 'Rule-by-rule explanation of how the candidate was picked and scored (shown to the user).';

COMMENT ON COLUMN "public"."cc_candidates"."cost_basis" IS 'Average journal entry price; premium-adjusted basis arrives with W2.2.';

COMMENT ON COLUMN "public"."cc_candidates"."reasons" IS 'Rule-by-rule explanation of how the candidate was picked and scored (shown to the user).';

COMMENT ON COLUMN "public"."business_profiles"."operating_type" IS 'Operational business category used by GenieSphere routing, e.g. salon, rental, contractor.';

COMMENT ON COLUMN "public"."business_profiles"."genie_product" IS 'Workspace product slug, e.g. salon_genie, rental_genie, service_genie, business_workspace.';

COMMENT ON COLUMN "public"."business_profiles"."company_id" IS 'Optional shared GenieSphere company identity used by product workspaces.';

COMMENT ON COLUMN "public"."profiles"."arowana_plan" IS 'Arowana plan: free | pro | elite | founders. Written only by the Stripe webhook (service role).';

COMMENT ON COLUMN "public"."profiles"."arowana_plan_status" IS 'Stripe subscription status mapped to: active | trialing | past_due | canceled | incomplete.';

COMMENT ON TABLE "public"."ap_founders_waitlist" IS 'Arowana Wheel Strategy Desk: Founders waitlist signups from index.html. Insert-only for the public; read with the service role.';

COMMENT ON TABLE "public"."ap_usage" IS 'Usage counters for metered features. Written only by edge functions (service role); users can read their own rows to see the meter on the account page.';

COMMENT ON TABLE "public"."ap_roll_coach" IS 'Arowana roll coach: for each open short option, the choices (hold, close, roll, take assignment) with the numbers and the rule behind each. Written by the nightly n8n job.';

COMMENT ON TABLE "public"."ap_risk_settings" IS 'Arowana wheel guardrails: the limits a user sets in advance, checked before they sell another option.';

COMMENT ON COLUMN "public"."watchlist_items"."horizon" IS 'trade_idea = short-term trade setup (uses signal/status/screener_source); long_term_hold = portfolio allocation target (uses target_allocation/valuation_status/category)';

COMMENT ON COLUMN "public"."watchlist_items"."sector" IS 'Industry sector (Technology, Healthcare, etc.) — applies to rows of either horizon, used for filtering.';

COMMENT ON COLUMN "public"."watchlist_items"."target_allocation" IS 'long_term_hold only: target % of portfolio.';

COMMENT ON COLUMN "public"."watchlist_items"."valuation_status" IS 'long_term_hold only: buy (undervalued) / hold (fair value) / sell (overvalued).';

COMMENT ON COLUMN "public"."watchlist_items"."category" IS 'long_term_hold only: Core ETF, Dividend Growth, Value, Growth, Other.';

COMMENT ON COLUMN "public"."watchlist_items"."want_to_own" IS 'Arowana Wheel Desk: user would be happy to own this stock; the cash-secured put scanner only scans these.';

COMMENT ON COLUMN "public"."watchlist_items"."target_buy_price" IS 'Optional price the user would be glad to buy at; put strikes must be at or below it when set.';

COMMIT;
