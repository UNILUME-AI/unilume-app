"""Tests for item classification and weight calculation."""

import pytest
from calculator.models import Dimensions, Market, SizeClassification
from calculator.classify import (
    calc_billable_weight,
    calc_cubic_feet,
    classify_directship_size,
    classify_item_size,
)


class TestClassifyItemSize:
    """FBN 7-tier classification."""

    def test_small_envelope(self):
        dims = Dimensions(length_cm=18, width_cm=12, height_cm=0.5)
        result = classify_item_size(dims, weight_kg=0.05)
        assert result == SizeClassification.SMALL_ENVELOPE

    def test_standard_envelope(self):
        dims = Dimensions(length_cm=30, width_cm=20, height_cm=2)
        result = classify_item_size(dims, weight_kg=0.3)
        assert result == SizeClassification.STANDARD_ENVELOPE

    def test_large_envelope(self):
        dims = Dimensions(length_cm=30, width_cm=20, height_cm=4)
        result = classify_item_size(dims, weight_kg=0.8)
        assert result == SizeClassification.LARGE_ENVELOPE

    def test_standard_parcel(self):
        dims = Dimensions(length_cm=40, width_cm=30, height_cm=20)
        result = classify_item_size(dims, weight_kg=2.0)
        assert result == SizeClassification.STANDARD_PARCEL

    def test_oversize(self):
        dims = Dimensions(length_cm=80, width_cm=30, height_cm=20)
        result = classify_item_size(dims, weight_kg=5.0)
        assert result == SizeClassification.OVERSIZE

    def test_extra_oversize(self):
        dims = Dimensions(length_cm=100, width_cm=80, height_cm=60)
        result = classify_item_size(dims, weight_kg=15.0)
        assert result == SizeClassification.EXTRA_OVERSIZE

    def test_bulky(self):
        dims = Dimensions(length_cm=200, width_cm=100, height_cm=80)
        result = classify_item_size(dims, weight_kg=35.0)
        assert result == SizeClassification.BULKY

    def test_none_dimensions_defaults_standard_parcel(self):
        assert classify_item_size(None, weight_kg=1.0) == SizeClassification.STANDARD_PARCEL

    def test_weight_exceeds_standard_parcel(self):
        """Item fits dimensionally but weight > 12kg → oversize."""
        dims = Dimensions(length_cm=40, width_cm=30, height_cm=20)
        result = classify_item_size(dims, weight_kg=15.0)
        assert result == SizeClassification.OVERSIZE


class TestClassifyDirectshipSize:
    """DirectShip 2-tier classification."""

    def test_standard_parcel(self):
        dims = Dimensions(length_cm=40, width_cm=30, height_cm=20)
        assert classify_directship_size(dims, 2.0) == SizeClassification.STANDARD_PARCEL

    def test_oversize_by_dimension(self):
        dims = Dimensions(length_cm=60, width_cm=30, height_cm=20)
        assert classify_directship_size(dims, 2.0) == SizeClassification.OVERSIZE

    def test_oversize_by_weight(self):
        dims = Dimensions(length_cm=40, width_cm=30, height_cm=20)
        assert classify_directship_size(dims, 15.0) == SizeClassification.OVERSIZE

    def test_none_defaults(self):
        assert classify_directship_size(None, 5.0) == SizeClassification.STANDARD_PARCEL
        assert classify_directship_size(None, 15.0) == SizeClassification.OVERSIZE


class TestBillableWeight:
    def test_physical_weight_with_packaging(self):
        # Standard parcel: 0.5kg + 0.1kg packaging = 0.6kg
        result = calc_billable_weight(0.5, size_class=SizeClassification.STANDARD_PARCEL)
        assert result == 0.6

    def test_small_envelope_packaging(self):
        # Small envelope: 0.05kg + 0.02kg packaging = 0.07kg → ceil to 0.1
        result = calc_billable_weight(0.05, size_class=SizeClassification.SMALL_ENVELOPE)
        assert result == 0.1  # rounded up to nearest 0.05

    def test_volumetric_dominates(self):
        # physical: 0.3 + 0.1 = 0.4, volumetric: 40*30*20/5000 = 4.8
        dims = Dimensions(length_cm=40, width_cm=30, height_cm=20)
        result = calc_billable_weight(0.3, dims, SizeClassification.STANDARD_PARCEL)
        assert result == 4.8

    def test_rounds_up_to_50g(self):
        # 0.32 + 0.1 = 0.42 → rounds up to 0.45
        result = calc_billable_weight(0.32, size_class=SizeClassification.STANDARD_PARCEL)
        assert result == 0.45


class TestCubicFeet:
    def test_calculation(self):
        dims = Dimensions(length_cm=30, width_cm=20, height_cm=10)
        cbf = calc_cubic_feet(dims)
        expected = (30 * 20 * 10) / 28317
        assert cbf == pytest.approx(expected)
