"""Tool 1: Item size classification.

Determines the size classification of an item based on its dimensions and weight.
FBN uses 7 tiers, DirectShip uses 2 tiers.

This mirrors the Classification logic in Noon's FBN Excel Calculator sheet (rows 30-48)
and DirectShip Calculator sheet (rows 25-34).
"""

from __future__ import annotations

import math
from typing import Optional

from calculator.models import Dimensions, Market, SizeClassification, load_fee_data


def classify_item_size(
    dimensions: Optional[Dimensions],
    weight_kg: float,
    market: Market = Market.UAE,
) -> SizeClassification:
    """Classify an item into one of 7 FBN size tiers.

    Classification is determined by checking dimensions (longest/median/shortest)
    and weight against each tier's limits, from smallest to largest.
    The first tier that fits is selected.

    Args:
        dimensions: Item dimensions (L x W x H in cm). If None, defaults to standard_parcel.
        weight_kg: Item physical weight in kg.
        market: Market (classification rules are the same across all markets).

    Returns:
        SizeClassification enum value.
    """
    if dimensions is None:
        return SizeClassification.STANDARD_PARCEL

    fees_data = load_fee_data(market)
    classifications = fees_data.get("size_classifications") or fees_data.get("size_classification", {})

    # Size classifications are identical across all markets.
    # If a market's JSON is missing full data, fall back to UAE.
    if len(classifications) < 7:
        uae_data = load_fee_data(Market.UAE)
        classifications = uae_data.get("size_classifications") or {}

    # Sort dimensions: longest, median, shortest
    sides = sorted(
        [dimensions.length_cm, dimensions.width_cm, dimensions.height_cm],
        reverse=True,
    )
    longest, median, shortest = sides
    weight_g = weight_kg * 1000

    # Check tiers in order from smallest to largest
    tier_order = [
        SizeClassification.SMALL_ENVELOPE,
        SizeClassification.STANDARD_ENVELOPE,
        SizeClassification.LARGE_ENVELOPE,
        SizeClassification.STANDARD_PARCEL,
        SizeClassification.OVERSIZE,
        SizeClassification.EXTRA_OVERSIZE,
    ]

    for tier in tier_order:
        tier_key = tier.value
        if tier_key not in classifications:
            continue

        spec = classifications[tier_key]
        max_l = spec.get("max_longest_cm")
        max_m = spec.get("max_median_cm")
        max_s = spec.get("max_shortest_cm")
        max_w = spec.get("max_weight_g")

        # null means no limit
        if max_l is not None and longest > max_l:
            continue
        if max_m is not None and median > max_m:
            continue
        if max_s is not None and shortest > max_s:
            continue
        if max_w is not None and weight_g > max_w:
            continue

        return tier

    # If nothing else fits, it's bulky
    return SizeClassification.BULKY


def classify_directship_size(
    dimensions: Optional[Dimensions],
    weight_kg: float,
) -> SizeClassification:
    """Classify an item for DirectShip (only 2 tiers: standard_parcel or oversize).

    DirectShip uses simpler classification than FBN:
    - Standard Parcel: ≤45cm x ≤34cm x ≤26cm, max 12kg
    - Oversize: everything else
    """
    if dimensions is None:
        if weight_kg <= 12:
            return SizeClassification.STANDARD_PARCEL
        return SizeClassification.OVERSIZE

    sides = sorted(
        [dimensions.length_cm, dimensions.width_cm, dimensions.height_cm],
        reverse=True,
    )
    longest, median, shortest = sides

    if longest <= 45 and median <= 34 and shortest <= 26 and weight_kg <= 12:
        return SizeClassification.STANDARD_PARCEL
    return SizeClassification.OVERSIZE


def calc_billable_weight(
    physical_weight_kg: float,
    dimensions: Optional[Dimensions] = None,
    size_class: SizeClassification = SizeClassification.STANDARD_PARCEL,
    market: Market = Market.UAE,
) -> float:
    """Calculate the billable (shipping) weight for an item.

    Billable weight = max(physical weight + packaging weight, volumetric weight)
    Rounded up to nearest 50g.

    This mirrors the Calculator sheet formulas:
    - D15 (Packaging Weight): VLOOKUP from classification table
    - D16 (Shipping Weight): physical + packaging
    - D17 (Rounded): CEILING to nearest 50g
    - Volumetric weight: L * W * H / 5000

    Args:
        physical_weight_kg: Item weight in kg.
        dimensions: Item dimensions in cm.
        size_class: Size classification (determines packaging weight).
        market: Market (to look up packaging weight from data).

    Returns:
        Billable weight in kg, rounded up to nearest 0.05 kg.
    """
    fees_data = load_fee_data(market)
    classifications = fees_data.get("size_classifications") or fees_data.get("size_classification", {})
    if len(classifications) < 7:
        uae_data = load_fee_data(Market.UAE)
        classifications = uae_data.get("size_classifications") or {}

    # Get packaging weight for this classification
    tier_key = size_class.value
    if tier_key in classifications and classifications[tier_key].get("packaging_weight_g") is not None:
        packaging_g = classifications[tier_key]["packaging_weight_g"]
    else:
        packaging_g = 0

    shipping_weight_kg = physical_weight_kg + packaging_g / 1000

    # Volumetric weight
    volumetric_weight_kg = 0.0
    if dimensions is not None:
        volumetric_weight_kg = (
            dimensions.length_cm * dimensions.width_cm * dimensions.height_cm
        ) / 5000.0

    billable = max(shipping_weight_kg, volumetric_weight_kg)

    # Round up to nearest 50g (0.05 kg)
    return math.ceil(billable * 20) / 20


def calc_cubic_feet(dimensions: Dimensions) -> float:
    """Calculate cubic feet for storage fee purposes.

    Formula: L(cm) * W(cm) * H(cm) / 28317

    This mirrors the FBN Calculator sheet formula D18.
    """
    return (dimensions.length_cm * dimensions.width_cm * dimensions.height_cm) / 28317
