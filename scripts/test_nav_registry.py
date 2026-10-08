"""Checks for js/arowana-nav-registry.js (ATD-008).

The registry keeps its data in a strict-JSON block between
REGISTRY-JSON markers so it can be validated here without a JavaScript
toolchain. These tests pin the owner-approved structure (ATD-003 / ATD-008)
and check that every route points at an existing same-origin page.
"""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_FILE = ROOT / "js" / "arowana-nav-registry.js"
SAFE_PATH = re.compile(r"^[a-z0-9][a-z0-9_\-]*\.html$")
SAFE_VALUE = re.compile(r"^[a-z0-9_\-]+$", re.IGNORECASE)

APPROVED_PRIMARIES = [
    "Trading Command",
    "Research",
    "Strategy Desks",
    "Portfolio & Risk",
    "Watchlists",
    "Journal & Review",
]
APPROVED_DESKS = ["Swing", "Wheel", "Options", "Growth", "Long-Term"]
APPROVED_MOBILE = ["command", "watchlists", "portfolio", "journal", "more"]
APPROVED_SHORT = {"command": "Command", "watchlists": "Watchlists", "portfolio": "Portfolio", "journal": "Journal"}
# Pages that must never be signed-in navigation destinations.
FORBIDDEN = {
    "settings.html", "admin.html", "admin-usage.html", "login.html", "signup.html",
    "reset-password.html", "schwab-callback.html", "market-intelligence.html",
    "tradingcommand.html",
}


def load_registry():
    text = REGISTRY_FILE.read_text(encoding="utf-8")
    match = re.search(
        r"/\* REGISTRY-JSON-START \*/\s*var REGISTRY = (\{.*?\});\s*/\* REGISTRY-JSON-END \*/",
        text,
        re.DOTALL,
    )
    if not match:
        raise AssertionError("REGISTRY-JSON block not found in js/arowana-nav-registry.js")
    return json.loads(match.group(1))


class NavRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reg = load_registry()
        cls.entries = cls.reg["entries"]
        cls.by_id = {e["id"]: e for e in cls.entries}

    def children(self, parent_id):
        return [e for e in self.entries if e.get("parent") == parent_id]

    def test_ids_unique_and_parents_exist(self):
        ids = [e["id"] for e in self.entries]
        self.assertEqual(len(ids), len(set(ids)), "duplicate entry ids")
        for e in self.entries:
            if "parent" in e:
                self.assertIn(e["parent"], self.by_id, e["id"])

    def test_primary_destinations_match_approval(self):
        primaries = [e["label"] for e in self.entries if "parent" not in e]
        self.assertEqual(primaries, APPROVED_PRIMARIES)

    def test_strategy_desks_match_approval(self):
        desks = self.by_id_label("Strategy Desks")
        self.assertNotIn("route", desks, "Strategy Desks is a group without a landing route")
        self.assertEqual([e["label"] for e in self.children(desks["id"])], APPROVED_DESKS)
        growth = [e for e in self.children(desks["id"]) if e["label"] == "Growth"][0]
        self.assertEqual(growth["status"], "planned", "no verified Growth route exists")

    def by_id_label(self, label):
        return [e for e in self.entries if e["label"] == label and "parent" not in e][0]

    def test_mobile_shortcuts_match_approval(self):
        self.assertEqual(self.reg["mobileOrder"], APPROVED_MOBILE)
        primaries = [e for e in self.entries if "parent" not in e]
        for slot, short in APPROVED_SHORT.items():
            matches = [p for p in primaries if p.get("mobile") == slot]
            self.assertEqual(len(matches), 1, slot)
            self.assertEqual(matches[0].get("shortLabel", matches[0]["label"]), short)
            self.assertIn("route", matches[0], slot)
        more = sorted(p["label"] for p in primaries if p.get("mobile") == "more")
        self.assertEqual(more, ["Research", "Strategy Desks"])

    def test_routes_are_safe_and_exist(self):
        routes = [(e["id"], e["route"]) for e in self.entries if "route" in e]
        routes += [(u["id"], u["route"]) for u in self.reg["utilities"]]
        for key in ("support", "pricing"):
            routes.append((key, self.reg[key]))
        routes.append(("brand.signedIn", {"path": self.reg["brand"]["signedIn"]}))
        routes.append(("brand.signedOut", {"path": self.reg["brand"]["signedOut"]}))
        for entry_id, route in routes:
            path = route["path"]
            self.assertRegex(path, SAFE_PATH, entry_id)
            self.assertTrue((ROOT / path).is_file(), "%s -> missing %s" % (entry_id, path))
            self.assertNotIn(path, FORBIDDEN, entry_id)
            for key, value in route.get("query", {}).items():
                self.assertRegex(key, SAFE_VALUE, entry_id)
                self.assertRegex(value, SAFE_VALUE, entry_id)

    def test_status_and_route_consistency(self):
        for e in self.entries:
            if e["id"] == "desks":
                continue
            status = e.get("status")
            self.assertIn(status, ("available", "legacy", "planned"), e["id"])
            if status == "planned":
                self.assertNotIn("route", e, "%s is planned but has a route" % e["id"])
                self.assertTrue(e.get("note"), "%s needs a note" % e["id"])
            else:
                self.assertIn("route", e, e["id"])
            if status == "legacy":
                self.assertTrue(e.get("note"), "%s needs a note" % e["id"])

    def test_active_rules_are_well_formed(self):
        for e in self.entries:
            for rule in e.get("activeWhen", []):
                self.assertRegex(rule["path"], SAFE_PATH, e["id"])
                for key, values in rule.get("query", {}).items():
                    self.assertIsInstance(values, list, e["id"])
                for value in rule.get("hash", []) or []:
                    self.assertTrue(value is None or SAFE_VALUE.match(value), e["id"])

    def test_loader_order_and_opt_out(self):
        js = (ROOT / "js" / "nav-loader.js").read_text(encoding="utf-8")
        self.assertIn("./js/nav-rail.js", js, "opt-out must still reach the old rail")
        self.assertIn("pref !== '0'", js, "ap_nav_v2 = 0 must opt out")
        self.assertLess(js.index("./js/arowana-nav-registry.js"), js.index("./js/arowana-nav.js"),
                        "registry must load before the renderer")

    def test_migrated_pages_use_only_the_loader(self):
        migrated = sorted(p.name for p in ROOT.glob("*.html")
                          if 'src="./js/nav-loader.js' in p.read_text(encoding="utf-8", errors="replace"))
        for required in ("tools.html", "trading-command.html", "portfolio-command.html", "options-hub.html",
                         "analysis-central.html", "intrinsic-value.html", "portfolio-advisor.html",
                         "arowana-trader.html", "watchlist.html", "scanner.html", "position-sizer.html",
                         "trade-plan-builder.html", "wheel-strategy.html", "ai-morning-brief.html",
                         "trade-journal-pro.html"):
            self.assertIn(required, migrated)
        self.assertEqual(len(migrated), 57, migrated)
        # arowana-trader.html's sidebar is the coach panel: the nav renders only
        # the mobile bar and More sheet there, by design.
        no_rail_mount = {"arowana-trader.html"}
        # ATD-009 phase 1: pages with no sidebar of their own ask the renderer
        # to build one (<body data-nav-shell>) instead of adding a #railMount.
        shell_pages = {"swing-trader.html", "long-term-dashboard.html", "my-rules.html",
                       "data-hygiene-audit.html"}
        # ATD-109: account pages and the Long-Term tools show the shell to
        # signed-in members only (data-nav-shell="member").
        member_pages = {"account.html", "billing.html", "broker-connections.html", "retirement-planner.html",
                        "retirement-calculator.html", "withdrawal-planner.html", "tax-advantaged-guide.html",
                        "asset-allocation-builder.html", "etf-core-screener.html", "fee-analyzer.html",
                        "ips-builder.html", "dca-planner.html", "factor-tilt-planner.html", "pick-my-mix.html",
                        "risk-quiz.html", "buy-a-home.html", "college-savings.html", "education-529-planner.html",
                        "real-estate-analyzer.html", "thesis-builder.html"}
        shell_pages |= member_pages
        direct = re.compile(r'<script[^>]+src="[^"]*(nav-rail|arowana-nav[a-z-]*)\.js')
        for name in migrated:
            html = (ROOT / name).read_text(encoding="utf-8", errors="replace")
            self.assertEqual(html.count('src="./js/nav-loader.js'), 1, name)
            self.assertIsNone(direct.search(html), "%s loads a nav script directly" % name)
            if name in shell_pages:
                self.assertRegex(html, r"<body[^>]*\bdata-nav-shell\b", name)
                if name in member_pages:
                    self.assertRegex(html, r'<body[^>]*\bdata-nav-shell="member"', name)
                self.assertNotIn('id="railMount"', html, name)
            elif name not in no_rail_mount:
                self.assertIn('id="railMount"', html, name)
            # No inline rail copy or post-render correction patch may remain.
            self.assertNotIn("The rail is inlined rather than loaded", html, name)
            self.assertNotIn("Rail correction, inline and last", html, name)
    def test_homes_cover_unregistered_migrated_pages(self):
        registered = set()
        for e in self.entries:
            if "route" in e:
                registered.add(e["route"]["path"])
            for rule in e.get("activeWhen", []):
                registered.add(rule["path"])
        # Utilities (account menu) are menu items too.
        registered |= {u["route"]["path"] for u in self.reg["utilities"]}
        migrated = {p.name for p in ROOT.glob("*.html")
                    if 'src="./js/nav-loader.js' in p.read_text(encoding="utf-8", errors="replace")}
        homes = self.reg["homes"]
        paths = [h["path"] for h in homes]
        self.assertEqual(len(paths), len(set(paths)), "duplicate home path")
        for h in homes:
            self.assertIn(h["entry"], self.by_id, h["path"])
            self.assertTrue((ROOT / h["path"]).is_file(), h["path"])
            self.assertIn(h["path"], migrated, "%s is not on the registry navigation" % h["path"])
            self.assertNotIn(h["path"], registered, "%s is already a menu item" % h["path"])
        # Every migrated page is either a menu item or has a home.
        self.assertEqual(sorted(migrated - registered - set(paths)), [])

    def test_retired_catalogues_redirect(self):
        # ATD-009 phase 1, group L: the old URLs stay valid as redirect stubs
        # that carry the query string and hash over.
        targets = {"advanced-trading-tools.html": "tools.html", "feature_body.html": "features.html",
                   "feature_new.html": "features.html", "features-tools-directory.html": "tools.html"}
        for name, target in targets.items():
            html = (ROOT / name).read_text(encoding="utf-8")
            self.assertIn('content="0; url=%s"' % target, html, name)
            self.assertIn("window.location.replace('%s' + window.location.search + window.location.hash)" % target,
                          html, name)
            self.assertLess(len(html), 4000, "%s still carries the old catalogue" % name)
        live = [p for p in ROOT.glob("*.html") if p.name not in targets]
        for page in live:
            html = page.read_text(encoding="utf-8", errors="replace")
            for name in targets:
                self.assertNotIn('href="%s' % name, html, "%s links to retired %s" % (page.name, name))

    def test_retired_scanners_redirect_to_registered_scans(self):
        # ATD-009 phase 2, group F: each standalone scanner page redirects to
        # scanner.html?scan=<id>, and <id> must be a registered scan.
        defs = (ROOT / "js" / "scanner-defs.js").read_text(encoding="utf-8")
        registered = set(re.findall(r"id: '([a-z_]+)',\s*label:", defs))
        registered |= set(re.findall(r"pending\('([a-z_]+)'", defs))
        stub = re.compile(r"window\.location\.replace\('scanner\.html\?scan=([a-z_]+)' \+ extra \+ window\.location\.hash\)")
        pages = [p for p in ROOT.glob("*.html") if "ATD-009 phase 2: retired standalone scanner" in
                 p.read_text(encoding="utf-8", errors="replace")]
        self.assertEqual(len(pages), 26, sorted(p.name for p in pages))
        for page in pages:
            html = page.read_text(encoding="utf-8")
            m = stub.search(html)
            self.assertIsNotNone(m, page.name)
            self.assertIn(m.group(1), registered, page.name)
            self.assertIn('content="0; url=scanner.html?scan=%s"' % m.group(1), html, page.name)
            self.assertLess(len(html), 4000, page.name)
        scanner = (ROOT / "scanner.html").read_text(encoding="utf-8")
        self.assertIn("new URLSearchParams(location.search).get('scan')", scanner)

    def test_merged_pages_redirect(self):
        # ATD-009 phase 2: pages whose function the target already covers, plus
        # two demo-only pages and stock-checker (webhook token in page source).
        targets = {"risk-calculator.html": "position-sizer.html", "position-sizer_fresh.html": "position-sizer.html",
                   "my-rules-short.html": "my-rules.html", "dividend-screener.html": "scanner.html?scan=dividend_safety",
                   "automated-trading-plan.html": "trade-plan-builder.html", "news-trading.html": "trade-plan-builder.html",
                   "stock-checker.html": "intrinsic-value.html",
                   "my-rules-long.html": "my-rules.html?tab=longterm", "discipline-checklist.html": "my-rules.html?tab=habits",
                   "ai-valuation.html": "intrinsic-value.html", "intrinsic-value-rsi.html": "intrinsic-value.html",
                   "long-term-intrinsic-value.html": "intrinsic-value.html",
                   "stock-analyzer.html": "analysis-central.html?tab=ai", "chart-analysis-form.html": "analysis-central.html?tab=ai",
                   "quality-screener.html": "scanner.html?scan=quality_compounders", "buy-sell-signal.html": "trade-plan-builder.html",
                   # ATD-009 phase 3
                   "daytrade.html": "trading-command.html", "ai-trading-agent.html": "arowana-trader.html",
                   "earning-watcher.html": "trading-command.html", "sector-sentiment.html": "ai-morning-brief.html",
                   "sector-sentiment-gauge.html": "ai-morning-brief.html", "option-recommender.html": "options-hub.html?tab=calls",
                   "option-trader.html": "options-hub.html?tab=analyzer", "wheel_strategy_web_tool.html": "wheel-strategy.html?tab=import",
                   "short-term-dashboard.html": "trading-command.html", "daily-bias.html": "trade-plan-builder.html",
                   "daily-summary.html": "ai-morning-brief.html", "option-roll-analyzer.html": "options-hub.html?tab=roll"}
        for name, target in targets.items():
            html = (ROOT / name).read_text(encoding="utf-8")
            self.assertIn("var target = '%s';" % target, html, name)
            self.assertIn('content="0; url=%s"' % target, html, name)
            self.assertLess(len(html), 4000, name)
        self.assertIn("pending('dividend_safety'", (ROOT / "js" / "scanner-defs.js").read_text(encoding="utf-8"))
        # my-rules.html took over the two pages' features and must keep their keys.
        rules = (ROOT / "my-rules.html").read_text(encoding="utf-8")
        for key in ("my_rules_longterm_v1", "my_rules_longterm_check", "gs_discipline_v1", "my_rules_v2"):
            self.assertIn(key, rules)
        # intrinsic-value.html took over the three valuation pages' models.
        iv = (ROOT / "intrinsic-value.html").read_text(encoding="utf-8")
        for fn in ("computeGrahamNumber", "computeResidualIncome", "computeEPV", "computePEMultiple", "computeFcfDcf"):
            self.assertIn("function %s(" % fn, iv)

    def test_no_page_loads_auth_guard_rail(self):
        # js/auth-guard.js holds only an outdated rail copy (no auth logic);
        # loaded deferred it re-rendered the rail after the page's own.
        loader = re.compile(r'<script[^>]+src="[^"]*auth-guard\.js')
        for page in ROOT.glob("*.html"):
            html = page.read_text(encoding="utf-8", errors="replace")
            self.assertIsNone(loader.search(html), page.name)


if __name__ == "__main__":
    unittest.main()
