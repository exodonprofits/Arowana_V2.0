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
                         "trade-plan-builder.html", "wheel-strategy.html", "ai-morning-brief.html"):
            self.assertIn(required, migrated)
        self.assertEqual(len(migrated), 32, migrated)
        # arowana-trader.html's sidebar is the coach panel: the nav renders only
        # the mobile bar and More sheet there, by design.
        no_rail_mount = {"arowana-trader.html"}
        direct = re.compile(r'<script[^>]+src="[^"]*(nav-rail|arowana-nav[a-z-]*)\.js')
        for name in migrated:
            html = (ROOT / name).read_text(encoding="utf-8", errors="replace")
            self.assertEqual(html.count('src="./js/nav-loader.js'), 1, name)
            self.assertIsNone(direct.search(html), "%s loads a nav script directly" % name)
            if name not in no_rail_mount:
                self.assertIn('id="railMount"', html, name)
            # No inline rail copy or post-render correction patch may remain.
            self.assertNotIn("The rail is inlined rather than loaded", html, name)
            self.assertNotIn("Rail correction, inline and last", html, name)

if __name__ == "__main__":
    unittest.main()
