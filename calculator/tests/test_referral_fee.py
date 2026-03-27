"""Tests for referral fee calculation."""

import pytest
from calculator.models import Market
from calculator.referral_fee import calc_referral_fee


class TestFlatRate:
    """Flat rate — simple percentage of sale price."""

    def test_uae_apparel_27_percent(self):
        fee, rate = calc_referral_fee(100.0, "fashion.apparel", Market.UAE)
        assert fee == 27.0
        assert rate == pytest.approx(0.27)

    def test_uae_cleaning_9_percent(self):
        fee, rate = calc_referral_fee(200.0, "home.cleaning_hygiene", Market.UAE)
        assert fee == 18.0
        assert rate == pytest.approx(0.09)

    def test_uae_laptops_6_percent(self):
        fee, rate = calc_referral_fee(3000.0, "electronics.laptops", Market.UAE)
        assert fee == 180.0

    def test_ksa_headphones_20_percent(self):
        fee, rate = calc_referral_fee(100.0, "electronics.headphones", Market.KSA)
        assert fee == 20.0

    def test_minimum_fee_applied(self):
        """When calculated fee is below minimum (1 AED), minimum is used."""
        fee, rate = calc_referral_fee(5.0, "electronics.tvs_projectors", Market.UAE)
        # 5 * 0.05 = 0.25, but min is 1.0
        assert fee == 1.0

    def test_egypt_apparel_14_percent(self):
        fee, rate = calc_referral_fee(500.0, "fashion.apparel", Market.EGYPT)
        assert fee == 70.0


class TestTieredRate:
    """Tiered / graduated — each band computed independently, cumulative."""

    def test_uae_watches_below_threshold(self):
        """6000 AED watch: 5000 * 15% + 1000 * 5% = 800 AED."""
        fee, _ = calc_referral_fee(6000.0, "fashion.watches", Market.UAE)
        assert fee == 800.0

    def test_uae_watches_within_first_tier(self):
        """3000 AED watch: 3000 * 15% = 450 AED."""
        fee, _ = calc_referral_fee(3000.0, "fashion.watches", Market.UAE)
        assert fee == 450.0

    def test_uae_watches_exactly_at_threshold(self):
        """5000 AED watch: 5000 * 15% = 750 AED."""
        fee, _ = calc_referral_fee(5000.0, "fashion.watches", Market.UAE)
        assert fee == 750.0

    def test_uae_furniture_tiered(self):
        """1000 AED furniture: 750 * 15% + 250 * 10% = 137.5 AED."""
        fee, _ = calc_referral_fee(1000.0, "home.furniture", Market.UAE)
        assert fee == 137.5

    def test_uae_fine_jewelry_tiered(self):
        """2000 AED jewelry: 1000 * 16% + 1000 * 5% = 210 AED."""
        fee, _ = calc_referral_fee(2000.0, "fashion.fine_jewelry", Market.UAE)
        assert fee == 210.0


class TestPriceSwitchRate:
    """Price switch — entire amount uses one rate based on price band."""

    def test_uae_cosmetics_low_price(self):
        """40 AED cosmetics: 40 * 8% = 3.2 AED."""
        fee, _ = calc_referral_fee(40.0, "beauty.colour_cosmetics", Market.UAE)
        assert fee == 3.2

    def test_uae_cosmetics_high_price(self):
        """60 AED cosmetics: 60 * 15% = 9.0 AED (NOT tiered)."""
        fee, _ = calc_referral_fee(60.0, "beauty.colour_cosmetics", Market.UAE)
        assert fee == 9.0

    def test_uae_cosmetics_at_threshold(self):
        """50 AED cosmetics: 50 * 8% = 4.0 AED (≤50 → uses lower rate)."""
        fee, _ = calc_referral_fee(50.0, "beauty.colour_cosmetics", Market.UAE)
        assert fee == 4.0

    def test_uae_phones_low(self):
        """400 AED phone: 400 * 6% = 24.0 AED."""
        fee, _ = calc_referral_fee(400.0, "electronics.phones", Market.UAE)
        assert fee == 24.0

    def test_uae_phones_high(self):
        """1000 AED phone: 1000 * 5% = 50.0 AED."""
        fee, _ = calc_referral_fee(1000.0, "electronics.phones", Market.UAE)
        assert fee == 50.0

    def test_uae_sports_low(self):
        """25 AED: 25 * 20% = 5.0 AED."""
        fee, _ = calc_referral_fee(25.0, "sports.sports_outdoors", Market.UAE)
        assert fee == 5.0

    def test_uae_sports_high(self):
        """100 AED: 100 * 13% = 13.0 AED."""
        fee, _ = calc_referral_fee(100.0, "sports.sports_outdoors", Market.UAE)
        assert fee == 13.0

    def test_egypt_headphones_low(self):
        """800 EGP: 800 * 15% = 120 EGP."""
        fee, _ = calc_referral_fee(800.0, "electronics.headphones", Market.EGYPT)
        assert fee == 120.0

    def test_egypt_headphones_high(self):
        """2000 EGP: 2000 * 8% = 160 EGP."""
        fee, _ = calc_referral_fee(2000.0, "electronics.headphones", Market.EGYPT)
        assert fee == 160.0


class TestEdgeCases:
    def test_unknown_category_raises(self):
        with pytest.raises(ValueError, match="Unknown category"):
            calc_referral_fee(100.0, "nonexistent.category", Market.UAE)
