"""Portfolio Command reads and writes holdings through the trade journal.

The retired `portfolio` / `portfolio_options` tables were written by a CSV
wizard that is gone; Holdings, Add/Edit/Delete Holding and Import CSV all
go through tj_stocks (Trade Journal Pro). Nothing here may touch the old
tables again, or saves would succeed and never appear.
"""

import re
import unittest
from pathlib import Path

PC = (Path(__file__).resolve().parent.parent / "portfolio-command.html").read_text(encoding="utf-8")


class PortfolioSourceTests(unittest.TestCase):
    def test_no_access_to_retired_tables(self):
        self.assertIsNone(re.search(r"rest/v1/portfolio(?:_options)?\?", PC))
        self.assertIsNone(re.search(r"""from\(\s*['"]portfolio(?:_options)?['"]\s*\)""", PC))

    def test_import_csv_opens_the_journal_importer(self):
        self.assertIn("trade-journal-pro.html?action=import", PC)


if __name__ == "__main__":
    unittest.main()
