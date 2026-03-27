"""Tests for fulfillment fee calculation."""

import pytest
from calculator.models import Dimensions, Fulfillment, Market, SizeClassification
from calculator.fulfillment_fee import (
    calc_billable_weight,
    classify_size,
    lookup_fulfillment_fee,
)


class TestSizeClassification:
    def test_standard_within_limits(self):
        dims = Dimensions(length_cm=40, width_cm=30, height_cm=20)
        assert classify_size(dims) == SizeClassification.STANDARD

    def test_oversize_longest_exceeds(self):
        dims = Dimensions(length_cm=50, width_cm=30, height_cm=20)
        assert classify_size(dims) == SizeClassification.OVERSIZE

    def test_oversize_median_exceeds(self):
        dims = Dimensions(length_cm=45, width_cm=40, height_cm=20)
        assert classify_size(dims) == SizeClassification.OVERSIZE

    def test_none_defaults_to_standard(self):
        assert classify_size(None) == SizeClassification.STANDARD

    def test_exactly_at_limit_is_standard(self):
        dims = Dimensions(length_cm=45, width_cm=34, height_cm=26)
        assert classify_size(dims) == SizeClassification.STANDARD


class TestBillableWeight:
    def test_physical_weight_dominates(self):
        # 0.5kg + 0.1kg packaging = 0.6kg, no volumetric
        result = calc_billable_weight(0.5)
        assert result == 0.6

    def test_volumetric_weight_dominates(self):
        # physical: 0.3 + 0.1 = 0.4kg
        # volumetric: 40*30*20 / 5000 = 4.8kg
        dims = Dimensions(length_cm=40, width_cm=30, height_cm=20)
        result = calc_billable_weight(0.3, dims)
        assert result == 4.8

    def test_rounds_up_to_nearest_005(self):
        # 0.32 + 0.1 = 0.42 → rounds up to 0.45
        result = calc_billable_weight(0.32)
        assert result == 0.45

    def test_oversize_no_packaging(self):
        dims = Dimensions(length_cm=50, width_cm=40, height_cm=30)
        result = calc_billable_weight(
            2.0, dims, SizeClassification.OVERSIZE
        )
        # physical: 2.0 + 0 = 2.0, volumetric: 50*40*30/5000 = 12.0
        assert result == 12.0


class TestFBNFees:
    def test_uae_standard_low_asp_025kg(self):
        fee = lookup_fulfillment_fee(
            0.25, Market.UAE, Fulfillment.FBN,
            SizeClassification.STANDARD, average_selling_price=20.0,
        )
        assert fee == 7.0  # ASP ≤ 25

    def test_uae_standard_high_asp_025kg(self):
        fee = lookup_fulfillment_fee(
            0.25, Market.UAE, Fulfillment.FBN,
            SizeClassification.STANDARD, average_selling_price=50.0,
        )
        assert fee == 8.5  # ASP > 25

    def test_uae_standard_2kg(self):
        fee = lookup_fulfillment_fee(
            2.0, Market.UAE, Fulfillment.FBN,
            SizeClassification.STANDARD, average_selling_price=50.0,
        )
        assert fee == 11.0

    def test_ksa_standard_1kg(self):
        fee = lookup_fulfillment_fee(
            1.0, Market.KSA, Fulfillment.FBN,
            SizeClassification.STANDARD, average_selling_price=50.0,
        )
        assert fee == 10.0

    def test_egypt_standard_no_asp(self):
        """Egypt FBN has no ASP split."""
        fee = lookup_fulfillment_fee(
            0.5, Market.EGYPT, Fulfillment.FBN,
            SizeClassification.STANDARD,
        )
        assert fee == 20.0

    def test_uae_oversize_5kg(self):
        fee = lookup_fulfillment_fee(
            5.0, Market.UAE, Fulfillment.FBN,
            SizeClassification.OVERSIZE, average_selling_price=50.0,
        )
        assert fee == 15.5


class TestDirectShipFees:
    def test_uae_pickup_standard_050kg(self):
        fee = lookup_fulfillment_fee(
            0.50, Market.UAE, Fulfillment.DIRECTSHIP_PICKUP,
            SizeClassification.STANDARD,
        )
        assert fee == 14.5

    def test_uae_dropoff_standard_050kg(self):
        fee = lookup_fulfillment_fee(
            0.50, Market.UAE, Fulfillment.DIRECTSHIP_DROPOFF,
            SizeClassification.STANDARD,
        )
        assert fee == 12.5

    def test_pickup_vs_dropoff_2_aed_difference(self):
        """Pickup is consistently 2 AED more than dropoff in UAE."""
        pickup = lookup_fulfillment_fee(
            1.0, Market.UAE, Fulfillment.DIRECTSHIP_PICKUP,
            SizeClassification.STANDARD,
        )
        dropoff = lookup_fulfillment_fee(
            1.0, Market.UAE, Fulfillment.DIRECTSHIP_DROPOFF,
            SizeClassification.STANDARD,
        )
        assert pickup - dropoff == 2.0

    def test_ksa_pickup_025kg(self):
        fee = lookup_fulfillment_fee(
            0.25, Market.KSA, Fulfillment.DIRECTSHIP_PICKUP,
            SizeClassification.STANDARD,
        )
        assert fee == 19.0

    def test_egypt_pickup_050kg(self):
        fee = lookup_fulfillment_fee(
            0.50, Market.EGYPT, Fulfillment.DIRECTSHIP_PICKUP,
            SizeClassification.STANDARD,
        )
        assert fee == 50.5

    def test_egypt_dropoff_050kg(self):
        fee = lookup_fulfillment_fee(
            0.50, Market.EGYPT, Fulfillment.DIRECTSHIP_DROPOFF,
            SizeClassification.STANDARD,
        )
        assert fee == 48.5


class TestWeightExceedsTiers:
    def test_fbn_weight_beyond_last_tier(self):
        """Weight beyond all tiers should use additional_per_kg."""
        fee = lookup_fulfillment_fee(
            14.0, Market.UAE, Fulfillment.FBN,
            SizeClassification.STANDARD, average_selling_price=50.0,
        )
        # Last tier: 12kg → 21.0 AED, additional 2kg → +2*1.0 = 23.0
        assert fee == 23.0
