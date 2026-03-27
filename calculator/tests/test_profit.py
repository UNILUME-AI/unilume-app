"""Tests for profit calculation (forward and reverse)."""

import pytest
from calculator.models import Dimensions, Fulfillment, Market, ProfitInput
from calculator.profit import calc_profit, reverse_price


class TestForwardProfit:
    """Forward calculation: given selling price → compute profit."""

    def test_basic_uae_fbn(self):
        """Portable fan: cost ¥35, sell 69 AED, FBN UAE, 0.3kg."""
        inp = ProfitInput(
            selling_price=69.0,
            market=Market.UAE,
            category_id="home.cleaning_hygiene",  # 9% flat
            fulfillment=Fulfillment.FBN,
            weight_kg=0.3,
            cost_price=35.0,
            cost_currency="CNY",
            shipping_cost_per_unit=9.0,  # ¥30/kg * 0.3kg
            exchange_rate=0.50,  # 1 CNY = 0.50 AED
            average_selling_price=69.0,
        )
        result = calc_profit(inp)

        assert result.net_profit > 0
        assert result.profit_margin > 0.2  # Should be healthy margin
        assert result.breakdown.referral_fee == pytest.approx(6.21, abs=0.01)
        assert result.breakdown.cost_of_goods == 17.5  # 35 * 0.50
        assert result.breakdown.international_shipping == 4.5  # 9 * 0.50
        assert result.breakeven_price < 69.0

    def test_negative_profit(self):
        """Very high cost → negative profit."""
        inp = ProfitInput(
            selling_price=20.0,
            market=Market.UAE,
            category_id="fashion.apparel",  # 27% flat
            fulfillment=Fulfillment.FBN,
            weight_kg=0.5,
            cost_price=100.0,
            cost_currency="CNY",
            exchange_rate=0.50,
            average_selling_price=20.0,
        )
        result = calc_profit(inp)
        assert result.net_profit < 0
        assert result.profit_margin < 0

    def test_ksa_directship(self):
        """KSA DirectShip pickup scenario."""
        inp = ProfitInput(
            selling_price=100.0,
            market=Market.KSA,
            category_id="electronics.laptops",  # 6% flat
            fulfillment=Fulfillment.DIRECTSHIP_PICKUP,
            weight_kg=2.0,
            cost_price=200.0,
            cost_currency="CNY",
            exchange_rate=0.51,
            average_selling_price=100.0,
        )
        result = calc_profit(inp)
        # Cost alone: 200 * 0.51 = 102 SAR > selling price 100 → loss
        assert result.net_profit < 0

    def test_egypt_fbn(self):
        """Egypt FBN scenario."""
        inp = ProfitInput(
            selling_price=500.0,
            market=Market.EGYPT,
            category_id="beauty.hair_care",  # 11.5% flat
            fulfillment=Fulfillment.FBN,
            weight_kg=0.3,
            cost_price=20.0,
            cost_currency="CNY",
            exchange_rate=6.80,
            average_selling_price=500.0,
        )
        result = calc_profit(inp)
        assert result.net_profit > 0
        assert result.breakdown.referral_fee == pytest.approx(57.5, abs=0.01)

    def test_exchange_rate_info(self):
        """Exchange rate info should be populated."""
        inp = ProfitInput(
            selling_price=100.0,
            market=Market.UAE,
            category_id="home.cleaning_hygiene",
            fulfillment=Fulfillment.FBN,
            weight_kg=0.5,
            cost_price=50.0,
            cost_currency="CNY",
            exchange_rate=0.52,
            average_selling_price=100.0,
        )
        result = calc_profit(inp)
        assert result.exchange_rate_used is not None
        assert result.exchange_rate_used["rate"] == 0.52
        assert result.exchange_rate_used["source"] == "custom"

    def test_vat_on_service_fees_not_selling_price(self):
        """VAT is applied to (referral + fulfillment), not selling price."""
        inp = ProfitInput(
            selling_price=100.0,
            market=Market.KSA,  # 15% VAT
            category_id="electronics.laptops",  # 6%
            fulfillment=Fulfillment.FBN,
            weight_kg=0.5,
            cost_price=0,
            average_selling_price=100.0,
        )
        result = calc_profit(inp)
        referral = result.breakdown.referral_fee
        fulfillment = result.breakdown.fulfillment_fee
        expected_vat = (referral + fulfillment) * 0.15
        assert result.breakdown.vat == pytest.approx(expected_vat, abs=0.01)


class TestReversePrice:
    """Reverse pricing: given cost + target margin → find selling price."""

    def test_flat_rate_reverse(self):
        """For flat-rate category, closed-form should work."""
        price = reverse_price(
            cost_price=35.0,
            cost_currency="CNY",
            target_margin=0.30,
            market=Market.UAE,
            category_id="home.cleaning_hygiene",  # 9% flat
            fulfillment=Fulfillment.FBN,
            weight_kg=0.5,
            shipping_cost_per_unit=9.0,
            exchange_rate=0.50,
            average_selling_price=50.0,
        )
        assert price > 0

        # Verify: forward calc at this price should yield ~30% margin
        inp = ProfitInput(
            selling_price=price,
            market=Market.UAE,
            category_id="home.cleaning_hygiene",
            fulfillment=Fulfillment.FBN,
            weight_kg=0.5,
            cost_price=35.0,
            cost_currency="CNY",
            shipping_cost_per_unit=9.0,
            exchange_rate=0.50,
            average_selling_price=50.0,
        )
        result = calc_profit(inp)
        assert result.profit_margin == pytest.approx(0.30, abs=0.02)

    def test_price_switch_reverse(self):
        """For price_switch, binary search is used."""
        price = reverse_price(
            cost_price=20.0,
            cost_currency="CNY",
            target_margin=0.25,
            market=Market.UAE,
            category_id="beauty.colour_cosmetics",  # price_switch
            fulfillment=Fulfillment.FBN,
            weight_kg=0.3,
            exchange_rate=0.50,
            average_selling_price=50.0,
        )
        assert price > 0

        # Verify
        inp = ProfitInput(
            selling_price=price,
            market=Market.UAE,
            category_id="beauty.colour_cosmetics",
            fulfillment=Fulfillment.FBN,
            weight_kg=0.3,
            cost_price=20.0,
            cost_currency="CNY",
            exchange_rate=0.50,
            average_selling_price=50.0,
        )
        result = calc_profit(inp)
        assert result.profit_margin == pytest.approx(0.25, abs=0.02)

    def test_tiered_reverse(self):
        """For tiered, binary search is used."""
        price = reverse_price(
            cost_price=500.0,
            cost_currency="CNY",
            target_margin=0.20,
            market=Market.UAE,
            category_id="fashion.watches",  # tiered
            fulfillment=Fulfillment.FBN,
            weight_kg=0.2,
            exchange_rate=0.50,
            average_selling_price=500.0,
        )
        assert price > 0

        # Verify
        inp = ProfitInput(
            selling_price=price,
            market=Market.UAE,
            category_id="fashion.watches",
            fulfillment=Fulfillment.FBN,
            weight_kg=0.2,
            cost_price=500.0,
            cost_currency="CNY",
            exchange_rate=0.50,
            average_selling_price=500.0,
        )
        result = calc_profit(inp)
        assert result.profit_margin == pytest.approx(0.20, abs=0.02)

    def test_impossible_margin_raises(self):
        """Margin too high for the referral rate → error."""
        with pytest.raises(ValueError, match="not achievable"):
            reverse_price(
                cost_price=100.0,
                cost_currency="CNY",
                target_margin=0.80,  # 80% margin with 27% referral
                market=Market.UAE,
                category_id="fashion.apparel",
                fulfillment=Fulfillment.FBN,
                weight_kg=0.5,
                exchange_rate=0.50,
            )
