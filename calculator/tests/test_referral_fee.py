"""Tests for referral fee lookup."""

import pytest
from calculator.models import FulfillmentType, Market
from calculator.referral_fee import lookup_referral_fee, list_categories


class TestFlatRate:
    def test_uae_apparel_27pct(self):
        r = lookup_referral_fee(100.0, "fashion.apparel_footwear", Market.UAE)
        assert r["fee"] == 27.0
        assert r["effective_rate"] == pytest.approx(0.27)
        assert r["rate_type"] == "flat"

    def test_uae_cleaning_9pct(self):
        r = lookup_referral_fee(200.0, "home.cleaning_hygiene", Market.UAE)
        assert r["fee"] == 18.0

    def test_minimum_fee(self):
        r = lookup_referral_fee(5.0, "electronics.tv_projectors_streaming", Market.UAE)
        assert r["fee"] == 1.0
        assert r["min_fee_applied"] is True


class TestTieredRate:
    def test_uae_watches_across_tiers(self):
        """6000 AED: 5000*15% + 1000*5% = 800."""
        r = lookup_referral_fee(6000.0, "fashion.watches", Market.UAE)
        assert r["fee"] == 800.0

    def test_uae_watches_within_first_tier(self):
        r = lookup_referral_fee(3000.0, "fashion.watches", Market.UAE)
        assert r["fee"] == 450.0

    def test_uae_furniture_tiered(self):
        """1000 AED: 750*15% + 250*10% = 137.5."""
        r = lookup_referral_fee(1000.0, "home.furniture", Market.UAE)
        assert r["fee"] == 137.5


class TestPriceSwitchRate:
    def test_uae_cosmetics_low(self):
        r = lookup_referral_fee(40.0, "beauty.colour_cosmetics", Market.UAE)
        assert r["fee"] == pytest.approx(3.2)

    def test_uae_cosmetics_high(self):
        r = lookup_referral_fee(60.0, "beauty.colour_cosmetics", Market.UAE)
        assert r["fee"] == 9.0

    def test_uae_sports_low(self):
        r = lookup_referral_fee(25.0, "sports.sports_outdoors", Market.UAE)
        assert r["fee"] == 5.0

    def test_uae_sports_high(self):
        r = lookup_referral_fee(100.0, "sports.sports_outdoors", Market.UAE)
        assert r["fee"] == 13.0


class TestFBPOverrides:
    def test_uae_fbp_laptops_different_rate(self):
        fbn = lookup_referral_fee(1000.0, "electronics.laptops_desktop", Market.UAE, FulfillmentType.FBN)
        fbp = lookup_referral_fee(1000.0, "electronics.laptops_desktop", Market.UAE, FulfillmentType.FBP)
        # FBN: 6%, FBP: 6.5%
        assert fbn["fee"] == 60.0
        assert fbp["fee"] == 65.0

    def test_uae_fbn_fallback_when_no_override(self):
        """Categories without FBP override use FBN rate."""
        fbn = lookup_referral_fee(100.0, "fashion.apparel_footwear", Market.UAE, FulfillmentType.FBN)
        fbp = lookup_referral_fee(100.0, "fashion.apparel_footwear", Market.UAE, FulfillmentType.FBP)
        assert fbn["fee"] == fbp["fee"]


class TestListCategories:
    def test_returns_categories(self):
        cats = list_categories(Market.UAE)
        assert len(cats) > 50
        names = [c["category_id"] for c in cats]
        assert "fashion.apparel_footwear" in names

    def test_egypt_categories(self):
        cats = list_categories(Market.EGYPT)
        assert len(cats) > 20


class TestEdgeCases:
    def test_unknown_category(self):
        with pytest.raises(ValueError, match="Unknown category"):
            lookup_referral_fee(100.0, "nonexistent", Market.UAE)

    def test_egypt_flat_apparel(self):
        r = lookup_referral_fee(500.0, "fashion.apparel", Market.EGYPT)
        assert r["fee"] == 70.0  # 14%
