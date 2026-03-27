"""Tests for FBN outbound and DirectShip fee lookup."""

import pytest
from calculator.models import DeliveryMethod, Market, SizeClassification
from calculator.fulfillment_fee import lookup_fbn_outbound_fee, lookup_directship_fee


class TestFBNOutbound:
    def test_uae_small_envelope_low_asp(self):
        r = lookup_fbn_outbound_fee(0.05, SizeClassification.SMALL_ENVELOPE, Market.UAE, average_selling_price=20)
        assert r["fee"] == 5.0
        assert r["asp_bucket"] == "low"

    def test_uae_small_envelope_high_asp(self):
        r = lookup_fbn_outbound_fee(0.05, SizeClassification.SMALL_ENVELOPE, Market.UAE, average_selling_price=50)
        assert r["fee"] == 7.0
        assert r["asp_bucket"] == "high"

    def test_uae_standard_parcel_025kg_low(self):
        r = lookup_fbn_outbound_fee(0.25, SizeClassification.STANDARD_PARCEL, Market.UAE, average_selling_price=20)
        assert r["fee"] == 7.0

    def test_uae_standard_parcel_025kg_high(self):
        r = lookup_fbn_outbound_fee(0.25, SizeClassification.STANDARD_PARCEL, Market.UAE, average_selling_price=50)
        assert r["fee"] == 8.5

    def test_uae_standard_parcel_2kg_high(self):
        r = lookup_fbn_outbound_fee(2.0, SizeClassification.STANDARD_PARCEL, Market.UAE, average_selling_price=50)
        assert r["fee"] == 11.0

    def test_uae_oversize_5kg_high(self):
        r = lookup_fbn_outbound_fee(5.0, SizeClassification.OVERSIZE, Market.UAE, average_selling_price=50)
        assert r["fee"] == 15.5

    def test_uae_oversize_30kg_low(self):
        r = lookup_fbn_outbound_fee(30.0, SizeClassification.OVERSIZE, Market.UAE, average_selling_price=20)
        assert r["fee"] == 37.5

    def test_uae_bulky_20kg_high(self):
        r = lookup_fbn_outbound_fee(20.0, SizeClassification.BULKY, Market.UAE, average_selling_price=50)
        # Bulky 20kg ASP high from Excel data
        assert r["fee"] > 0
        assert r["asp_bucket"] == "high"

    def test_egypt_no_asp_split(self):
        """Egypt has no ASP split — single rate."""
        r = lookup_fbn_outbound_fee(0.5, SizeClassification.STANDARD_PARCEL, Market.EGYPT)
        assert r["fee"] == 20.0
        assert r["asp_bucket"] is None


class TestDirectShip:
    def test_uae_pickup_standard_025kg(self):
        r = lookup_directship_fee(0.25, SizeClassification.STANDARD_PARCEL, Market.UAE, DeliveryMethod.PICKUP)
        assert r["fee"] == 14.0

    def test_uae_dropoff_is_pickup_minus_2(self):
        pickup = lookup_directship_fee(1.0, SizeClassification.STANDARD_PARCEL, Market.UAE, DeliveryMethod.PICKUP)
        dropoff = lookup_directship_fee(1.0, SizeClassification.STANDARD_PARCEL, Market.UAE, DeliveryMethod.DROPOFF)
        assert pickup["fee"] - dropoff["fee"] == 2.0

    def test_uae_oversize_1kg(self):
        r = lookup_directship_fee(1.0, SizeClassification.OVERSIZE, Market.UAE, DeliveryMethod.PICKUP)
        assert r["fee"] == 18.5

    def test_uae_oversize_30kg(self):
        r = lookup_directship_fee(30.0, SizeClassification.OVERSIZE, Market.UAE, DeliveryMethod.PICKUP)
        assert r["fee"] == 44.0

    def test_envelope_maps_to_standard_parcel(self):
        """Envelope types should be mapped to standard_parcel for DirectShip."""
        r = lookup_directship_fee(0.25, SizeClassification.SMALL_ENVELOPE, Market.UAE, DeliveryMethod.PICKUP)
        assert r["size_classification"] == "standard_parcel"
        assert r["fee"] == 14.0
