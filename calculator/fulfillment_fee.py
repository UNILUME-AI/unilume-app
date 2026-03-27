"""Fulfillment fee calculation for FBN and DirectShip.

Handles:
  - Billable weight calculation (physical + packaging vs volumetric)
  - Size classification (standard vs oversize)
  - Fee lookup by weight tier
"""

from __future__ import annotations

import math
from typing import Optional

from calculator.models import (
    Dimensions,
    Fulfillment,
    Market,
    SizeClassification,
    load_fee_data,
)


def classify_size(dimensions: Optional[Dimensions]) -> SizeClassification:
    """Classify parcel as standard or oversize based on dimensions.

    Standard: longest ≤ 45cm, median ≤ 34cm, shortest ≤ 26cm
    Everything else is oversize.
    """
    if dimensions is None:
        return SizeClassification.STANDARD

    sides = sorted(
        [dimensions.length_cm, dimensions.width_cm, dimensions.height_cm],
        reverse=True,
    )
    longest, median, shortest = sides

    if longest <= 45 and median <= 34 and shortest <= 26:
        return SizeClassification.STANDARD
    return SizeClassification.OVERSIZE


def calc_billable_weight(
    physical_weight_kg: float,
    dimensions: Optional[Dimensions] = None,
    size_class: SizeClassification = SizeClassification.STANDARD,
) -> float:
    """Calculate billable weight.

    billable = max(physical + packaging, volumetric)
    Round up to nearest 0.05 kg.
    """
    packaging_kg = 0.1 if size_class == SizeClassification.STANDARD else 0.0
    shipping_weight = physical_weight_kg + packaging_kg

    volumetric_weight = 0.0
    if dimensions is not None:
        volumetric_weight = (
            dimensions.length_cm * dimensions.width_cm * dimensions.height_cm
        ) / 5000.0

    billable = max(shipping_weight, volumetric_weight)
    # Round up to nearest 0.05 kg
    return math.ceil(billable * 20) / 20


def lookup_fulfillment_fee(
    billable_weight_kg: float,
    market: Market,
    fulfillment: Fulfillment,
    size_class: SizeClassification = SizeClassification.STANDARD,
    average_selling_price: Optional[float] = None,
) -> float:
    """Look up fulfillment fee from the fee table.

    For FBN in UAE/KSA, fees differ by ASP (average selling price) threshold.
    Egypt FBN and all DirectShip have no ASP split.
    """
    fees_data = load_fee_data(market)
    ff = fees_data["fulfillment_fees"]

    if fulfillment == Fulfillment.FBN:
        fbn_data = ff["fbn"]
        size_key = size_class.value
        tier_group = fbn_data[size_key]

        # Egypt FBN has no ASP split — tiers directly
        if "tiers" in tier_group:
            return _lookup_from_tiers(
                billable_weight_kg,
                tier_group["tiers"],
                tier_group.get("additional_per_kg", 1.0),
            )

        # UAE/KSA have asp_low and asp_high
        asp_threshold = tier_group["asp_low"]["asp_threshold"]
        if average_selling_price is not None and average_selling_price <= asp_threshold:
            selected = tier_group["asp_low"]
        else:
            selected = tier_group["asp_high"]

        return _lookup_from_tiers(
            billable_weight_kg,
            selected["tiers"],
            selected.get("additional_per_kg", 1.0),
        )

    # DirectShip
    if fulfillment == Fulfillment.DIRECTSHIP_PICKUP:
        ds_data = ff["directship"]["pickup"]
    else:
        ds_data = ff["directship"]["dropoff"]

    size_key = size_class.value
    tier_data = ds_data[size_key]

    return _lookup_from_tiers(
        billable_weight_kg,
        tier_data["tiers"],
        tier_data.get("additional_per_kg", 1.0),
    )


def _lookup_from_tiers(
    weight_kg: float,
    tiers: list[dict],
    additional_per_kg: float,
) -> float:
    """Find the fee for a given weight from a list of weight tiers.

    If weight exceeds all tiers, compute additional fee per kg beyond the last tier.
    """
    for tier in tiers:
        if weight_kg <= tier["max_weight_kg"]:
            return tier["fee"]

    # Weight exceeds all tiers — use last tier as base + additional per kg
    last_tier = tiers[-1]
    extra_weight = weight_kg - last_tier["max_weight_kg"]
    extra_kg_rounded = math.ceil(extra_weight)
    return last_tier["fee"] + extra_kg_rounded * additional_per_kg
