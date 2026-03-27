"""Tests for storage, return, inventory removal, VAS, shipping, and VAT."""

import pytest
from calculator.models import (
    DeliveryMethod,
    Dimensions,
    InventoryRemovalMethod,
    Market,
    SizeClassification,
    VASType,
)
from calculator.storage_fee import (
    calc_storage_fee,
    calc_long_term_storage_fee,
    calc_non_saleable_storage_fee,
)
from calculator.other_fees import (
    calc_return_admin_fee,
    calc_inventory_removal_fee,
    calc_vat,
    lookup_shipping_reimbursement,
    lookup_vas_fee,
)


class TestStorageFee:
    def test_uae_monthly(self):
        dims = Dimensions(length_cm=30, width_cm=20, height_cm=10)
        r = calc_storage_fee(dims, Market.UAE, storage_months=1)
        # CBF = 6000/28317 ≈ 0.2119
        assert r["rate_per_cbf"] == 1.5
        assert r["monthly_fee"] == pytest.approx(0.32, abs=0.01)

    def test_ksa_monthly_higher_rate(self):
        dims = Dimensions(length_cm=30, width_cm=20, height_cm=10)
        r = calc_storage_fee(dims, Market.KSA, storage_months=1)
        assert r["rate_per_cbf"] == 2.5

    def test_multi_month(self):
        dims = Dimensions(length_cm=30, width_cm=20, height_cm=10)
        r = calc_storage_fee(dims, Market.UAE, storage_months=3)
        assert r["total_fee"] == pytest.approx(r["monthly_fee"] * 3, abs=0.02)


class TestLongTermStorage:
    def test_uae_365_days(self):
        dims = Dimensions(length_cm=30, width_cm=20, height_cm=10)
        r = calc_long_term_storage_fee(dims, Market.UAE)
        assert r["threshold_days"] == 365
        assert r["rate_per_cbf"] == 25.0

    def test_egypt_180_days(self):
        dims = Dimensions(length_cm=30, width_cm=20, height_cm=10)
        r = calc_long_term_storage_fee(dims, Market.EGYPT)
        assert r["threshold_days"] == 180


class TestNonSaleableStorage:
    def test_uae_30_days(self):
        dims = Dimensions(length_cm=30, width_cm=20, height_cm=10)
        r = calc_non_saleable_storage_fee(dims, Market.UAE)
        assert r["threshold_days"] == 30
        assert r["rate_per_cbf"] == 12.0


class TestReturnAdminFee:
    def test_low_referral_fee(self):
        """20% of referral < 15 → use 20%."""
        r = calc_return_admin_fee(referral_fee=10.0, market=Market.UAE)
        assert r["fee"] == 2.0  # min(15, 10*0.2=2) = 2

    def test_high_referral_fee(self):
        """20% of referral > 15 → cap at 15."""
        r = calc_return_admin_fee(referral_fee=100.0, market=Market.UAE)
        assert r["fee"] == 15.0  # min(15, 100*0.2=20) = 15


class TestInventoryRemoval:
    def test_delivery_same_city(self):
        r = calc_inventory_removal_fee(
            units=10, weight_kg=5.0, market=Market.UAE,
            method=InventoryRemovalMethod.DELIVERY, is_cross_city=False,
        )
        # handling: 10*0.3=3, transport: 5*1.0=5, total=8, min=15
        assert r["fee"] == 15.0  # min_fee applies

    def test_delivery_large_order(self):
        r = calc_inventory_removal_fee(
            units=100, weight_kg=50.0, market=Market.UAE,
            method=InventoryRemovalMethod.DELIVERY,
        )
        # handling: 100*0.3=30, transport: 50*1.0=50, total=80 > 15
        assert r["fee"] == 80.0

    def test_egypt_higher_min_fee(self):
        r = calc_inventory_removal_fee(
            units=5, weight_kg=2.0, market=Market.EGYPT,
            method=InventoryRemovalMethod.DELIVERY,
        )
        assert r["fee"] == 100.0  # Egypt min is 100 EGP


class TestVAS:
    def test_polybag_standard(self):
        r = lookup_vas_fee(VASType.POLYBAG_SHRINK_WRAP, SizeClassification.STANDARD_PARCEL, Market.UAE)
        assert r["fee"] == 0.8
        assert r["available"] is True

    def test_bubble_wrap_bulky_not_available(self):
        r = lookup_vas_fee(VASType.BUBBLE_WRAP, SizeClassification.BULKY, Market.UAE)
        assert r["available"] is False


class TestShippingReimbursement:
    def test_uae_low_order(self):
        r = lookup_shipping_reimbursement(50.0, Market.UAE)
        assert r["charge"] == 10.0

    def test_uae_mid_order(self):
        r = lookup_shipping_reimbursement(300.0, Market.UAE)
        assert r["charge"] == 5.0

    def test_uae_high_order(self):
        r = lookup_shipping_reimbursement(600.0, Market.UAE)
        assert r["charge"] == 0


class TestVAT:
    def test_uae_5pct(self):
        r = calc_vat(10.0, 5.0, market=Market.UAE)
        assert r["vat_rate"] == 0.05
        assert r["vat_amount"] == 0.75  # 15 * 0.05

    def test_ksa_15pct(self):
        r = calc_vat(100.0, market=Market.KSA)
        assert r["vat_rate"] == 0.15
        assert r["vat_amount"] == 15.0

    def test_egypt_14pct(self):
        r = calc_vat(50.0, 30.0, market=Market.EGYPT)
        assert r["vat_rate"] == 0.14
        assert r["vat_amount"] == pytest.approx(11.2)
