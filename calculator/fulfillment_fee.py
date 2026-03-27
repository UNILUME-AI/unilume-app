"""Tool 3 & 4: FBN Outbound Fee and DirectShip Fee lookup.

These are two separate atomic operations:
- lookup_fbn_outbound_fee: Fee for picking, packing, shipping from Noon warehouse
- lookup_directship_fee: Fee for Noon collecting from seller and delivering to customer

Data source: Noon Excel Calculator "Outbound" and "directship" sheets.
"""

from __future__ import annotations

import math
from typing import Optional

from calculator.models import (
    DeliveryMethod,
    Market,
    SizeClassification,
    load_fee_data,
)


def lookup_fbn_outbound_fee(
    billable_weight_kg: float,
    size_class: SizeClassification,
    market: Market,
    average_selling_price: Optional[float] = None,
    is_refurbished: bool = False,
) -> dict:
    """Look up the FBN outbound fee for an item.

    The fee depends on:
    - Size classification (7 tiers)
    - Billable weight
    - Market
    - ASP (average selling price) — determines low/high fee bucket
      (UAE/KSA only; Egypt has single rate; refurbished has single rate)

    Args:
        billable_weight_kg: Calculated billable weight.
        size_class: Item size classification.
        market: Target market.
        average_selling_price: ASP for fee bucket selection.
        is_refurbished: Whether this is a refurbished/renewed product.

    Returns:
        dict with fee, asp_bucket, size_classification, currency.
    """
    fees_data = load_fee_data(market)

    if is_refurbished:
        refurb = fees_data.get("refurbished", {})
        fbn_data = refurb.get("fbn_outbound_fees", {})
    else:
        fbn_data = fees_data.get("fbn_outbound_fees") or fees_data.get("fulfillment_fees", {}).get("fbn", {})

    size_key = size_class.value
    weight_g = billable_weight_kg * 1000
    asp_threshold = fbn_data.get("asp_threshold", 25)

    if size_key not in fbn_data:
        raise ValueError(
            f"Size classification '{size_key}' not found in FBN outbound fees "
            f"for market {market.value}"
        )

    tier_data = fbn_data[size_key]

    # Determine fee based on data structure
    asp_bucket = None

    if isinstance(tier_data, (int, float)):
        # Single flat rate (shouldn't happen with current data, but handle it)
        fee = float(tier_data)

    elif isinstance(tier_data, dict):
        if "asp_low" in tier_data:
            # Has ASP split
            use_low = (
                average_selling_price is not None
                and average_selling_price <= asp_threshold
            )

            if use_low:
                asp_bucket = "low"
                selected = tier_data["asp_low"]
                additional = tier_data.get("asp_low_additional_per_kg", 1.0)
            else:
                asp_bucket = "high"
                selected = tier_data["asp_high"]
                additional = tier_data.get("asp_high_additional_per_kg", 1.0)

            if isinstance(selected, (int, float)):
                # Single rate (e.g. small_envelope, large_envelope)
                fee = float(selected)
            elif isinstance(selected, list):
                fee = _lookup_weight_tiers_g(weight_g, selected, additional)
            else:
                raise ValueError(f"Unexpected data type for {size_key} ASP bucket")
        elif "tiers" in tier_data:
            # No ASP split, has tiers (refurbished)
            additional = tier_data.get("additional_per_kg", 1.0)
            fee = _lookup_weight_tiers_g(weight_g, tier_data["tiers"], additional)
        else:
            raise ValueError(f"Unexpected structure for {size_key}")

    elif isinstance(tier_data, list):
        # No ASP split, just weight tiers (Egypt)
        fee = _lookup_weight_tiers_g(weight_g, tier_data, 1.0)

    else:
        raise ValueError(f"Unexpected fee data structure for {size_key}")

    # Bulky overflow: >40kg → +10 per 5kg
    if size_class == SizeClassification.BULKY and weight_g > 40000:
        overflow_5kg = math.floor((weight_g - 40000) / 5000)
        fee += overflow_5kg * 10

    return {
        "fee": round(fee, 2),
        "size_classification": size_key,
        "asp_bucket": asp_bucket,
        "currency": fees_data["currency"],
    }


def lookup_directship_fee(
    billable_weight_kg: float,
    size_class: SizeClassification,
    market: Market,
    delivery_method: DeliveryMethod = DeliveryMethod.PICKUP,
) -> dict:
    """Look up the DirectShip fee for a shipment.

    DirectShip has only 2 size classifications: standard_parcel and oversize.
    Fee differs by pickup vs dropoff (dropoff is always 2 units cheaper).

    Includes fee cap logic for volumetric-weight-dominant items.

    Args:
        billable_weight_kg: Calculated billable weight.
        size_class: standard_parcel or oversize.
        market: Target market.
        delivery_method: pickup or dropoff.

    Returns:
        dict with fee, delivery_method, size_classification, currency.
    """
    fees_data = load_fee_data(market)
    ds_data = fees_data.get("directship_fees") or fees_data.get("fulfillment_fees", {}).get("directship", {})
    method_key = delivery_method.value
    weight_g = billable_weight_kg * 1000

    # DirectShip only supports standard_parcel and oversize
    if size_class not in (SizeClassification.STANDARD_PARCEL, SizeClassification.OVERSIZE):
        if size_class in (
            SizeClassification.SMALL_ENVELOPE,
            SizeClassification.STANDARD_ENVELOPE,
            SizeClassification.LARGE_ENVELOPE,
        ):
            size_class = SizeClassification.STANDARD_PARCEL
        else:
            size_class = SizeClassification.OVERSIZE

    size_key = size_class.value
    method_data = ds_data[method_key]

    if size_key not in method_data:
        raise ValueError(
            f"Size '{size_key}' not found in DirectShip {method_key} fees "
            f"for market {market.value}"
        )

    tier_config = method_data[size_key]
    tiers = tier_config["tiers"]
    fee = _lookup_weight_tiers_g(weight_g, tiers, tier_config.get("additional_per_kg", 1.0))

    # Oversize overflow above 30kg
    if size_class == SizeClassification.OVERSIZE:
        overflow_rate = tier_config.get("additional_per_kg_above_30kg")
        if overflow_rate and weight_g > 30000:
            last_fee = tiers[-1]["fee"]
            extra_kg = math.ceil((weight_g - 30000) / 1000)
            fee = last_fee + extra_kg * overflow_rate

    # Apply fee cap (standard parcel pickup)
    max_fee = tier_config.get("max_fee")
    if max_fee is not None and fee > max_fee:
        fee = max_fee

    # Also check global fee cap
    fee_cap_data = ds_data.get("fee_cap", {})
    if delivery_method == DeliveryMethod.PICKUP:
        global_cap = fee_cap_data.get("standard_parcel_pickup_max")
        if global_cap and size_class == SizeClassification.STANDARD_PARCEL and fee > global_cap:
            fee = global_cap

    return {
        "fee": round(fee, 2),
        "delivery_method": method_key,
        "size_classification": size_key,
        "currency": fees_data["currency"],
    }


def _lookup_weight_tiers_g(
    weight_g: float,
    tiers: list[dict],
    additional_per_kg: float = 1.0,
) -> float:
    """Find the fee for a given weight (in grams) from a list of weight tiers.

    Tiers use max_weight_g as the key.
    If weight exceeds all tiers, computes additional fee per kg beyond the last tier.
    """
    for tier in tiers:
        if weight_g <= tier["max_weight_g"]:
            return tier["fee"]

    # Weight exceeds all explicit tiers
    last_tier = tiers[-1]
    extra_weight_g = weight_g - last_tier["max_weight_g"]
    extra_kg_rounded = math.ceil(extra_weight_g / 1000)
    return last_tier["fee"] + extra_kg_rounded * additional_per_kg
