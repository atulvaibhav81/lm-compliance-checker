"""tests/test_rules.py — Unit tests for each LM-PC compliance rule."""
from __future__ import annotations

import pytest

from rule_engine.rules.name_rule import NameRule
from rule_engine.rules.net_quantity_rule import NetQuantityRule
from rule_engine.rules.mrp_rule import MrpRule
from rule_engine.rules.manufacturer_rule import ManufacturerRule
from rule_engine.rules.date_rule import DateRule
from rule_engine.rules.customer_care_rule import CustomerCareRule
from db.models.compliance import RuleStatus


# ── Sample OCR text fixtures ──────────────────────────────────────────────────

FULL_LABEL = """
Tasty Biscuits Premium
Net Weight: 200 g
MRP Rs. 30 (Inclusive of all taxes)
Manufactured by: ABC Foods Pvt. Ltd.
123, Industrial Area, Phase 2, Delhi - 110001
Mfg. Date: 03/2024  Best Before: 03/2025
Customer Care: 1800-123-4567
www.abcfoods.com
"""

MINIMAL_LABEL = """
Snacks 100g
Price: 20
By: XYZ Co. Delhi
"""

EMPTY_LABEL = ""


# ── R6-A: Name Rule ───────────────────────────────────────────────────────────

class TestNameRule:
    rule = NameRule()

    def test_pass_on_full_label(self):
        result = self.rule.check(FULL_LABEL)
        assert result.status == RuleStatus.PASS

    def test_fail_on_empty(self):
        result = self.rule.check(EMPTY_LABEL)
        assert result.status == RuleStatus.FAIL


# ── R6-B: Net Quantity Rule ───────────────────────────────────────────────────

class TestNetQuantityRule:
    rule = NetQuantityRule()

    def test_pass_grams(self):
        result = self.rule.check("Net Weight: 200 g")
        assert result.status == RuleStatus.PASS
        assert "200" in result.extracted_value

    def test_pass_ml(self):
        result = self.rule.check("Volume: 500 ml")
        assert result.status == RuleStatus.PASS

    def test_pass_kg(self):
        result = self.rule.check("1 kg")
        assert result.status == RuleStatus.PASS

    def test_fail_no_unit(self):
        result = self.rule.check("Weight 200")
        assert result.status == RuleStatus.FAIL

    def test_fail_empty(self):
        result = self.rule.check(EMPTY_LABEL)
        assert result.status == RuleStatus.FAIL


# ── R6-C: MRP Rule ───────────────────────────────────────────────────────────

class TestMrpRule:
    rule = MrpRule()

    def test_pass_with_tax_note(self):
        result = self.rule.check("MRP Rs. 30 (Inclusive of all taxes)")
        assert result.status == RuleStatus.PASS

    def test_warn_without_tax_note(self):
        result = self.rule.check("MRP Rs. 30")
        assert result.status == RuleStatus.WARN

    def test_fail_no_mrp(self):
        result = self.rule.check("Price 30 rupees")
        assert result.status == RuleStatus.FAIL

    def test_pass_mrp_symbol(self):
        result = self.rule.check("MRP ₹45.50 incl. all taxes")
        assert result.status == RuleStatus.PASS


# ── R6-D: Manufacturer Rule ───────────────────────────────────────────────────

class TestManufacturerRule:
    rule = ManufacturerRule()

    def test_pass_with_pin(self):
        result = self.rule.check("Manufactured by: ABC Pvt. Ltd., Delhi 110001")
        assert result.status == RuleStatus.PASS

    def test_warn_keyword_no_address(self):
        result = self.rule.check("Manufactured by: ABC Co.")
        assert result.status == RuleStatus.WARN

    def test_fail_no_keyword(self):
        result = self.rule.check("Some product label without maker info")
        assert result.status == RuleStatus.FAIL


# ── R6-E: Date Rule ──────────────────────────────────────────────────────────

class TestDateRule:
    rule = DateRule()

    def test_pass_mfg_date(self):
        result = self.rule.check("Mfg. Date: 03/2024")
        assert result.status == RuleStatus.PASS

    def test_pass_packed_month_word(self):
        result = self.rule.check("Packed: March 2024")
        assert result.status == RuleStatus.PASS

    def test_warn_only_best_before(self):
        result = self.rule.check("Best Before: 06/2025")
        assert result.status == RuleStatus.WARN

    def test_fail_no_date(self):
        result = self.rule.check("Some random text without dates")
        assert result.status == RuleStatus.FAIL


# ── R6-F: Customer Care Rule ──────────────────────────────────────────────────

class TestCustomerCareRule:
    rule = CustomerCareRule()

    def test_pass_tollfree_with_keyword(self):
        result = self.rule.check("Consumer Care: 1800-123-4567")
        assert result.status == RuleStatus.PASS

    def test_pass_email_with_keyword(self):
        result = self.rule.check("Customer Care: support@brand.com")
        assert result.status == RuleStatus.PASS

    def test_warn_phone_no_keyword(self):
        result = self.rule.check("Call us: 9876543210")
        assert result.status == RuleStatus.WARN

    def test_warn_website_only(self):
        result = self.rule.check("Visit www.brand.com")
        assert result.status == RuleStatus.WARN

    def test_fail_no_contact(self):
        result = self.rule.check("Some text without any contact information")
        assert result.status == RuleStatus.FAIL
