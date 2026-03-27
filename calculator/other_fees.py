"""Tools 6-9: Return admin fee, inventory removal fee, value-added services, shipping reimbursement.

These are the remaining atomic fee operations from Noon's official documentation.
"""

from __future__ import annotations

from calculator.models import (
    DeliveryMethod,
    InventoryRemovalMethod,
    Market,
    SizeClassification,
    VASType,
    load_fee_data,
)


# --- Tool 6: Return Administration Fee ---

def calc_return_admin_fee(
    referral_fee: float,
    market: Market,
) -> dict:
    """Calculate the return administration fee.

    Formula: lesser of (fixed amount) or (percentage × referral fee).
    UAE/KSA: min(15, 20% of referral fee)
    Egypt: min(15, 20% of referral fee)

    Args:
        referral_fee: The referral fee for the returned item.
        market: Target market.

    Returns:
        dict with fee, formula, currency.
    """
    fees_data = load_fee_data(market)
    config = fees_data.get("return_admin_fee", {})

    fixed = config.get("fixed", 15)
    pct = config.get("referral_pct", 0.20)

    pct_amount = referral_fee * pct
    fee = min(fixed, pct_amount)

    return {
        "fee": round(fee, 2),
        "fixed_cap": fixed,
        "pct_of_referral": pct,
        "pct_amount": round(pct_amount, 2),
        "currency": fees_data["currency"],
    }


# --- Tool 7: Inventory Removal Fee ---

def calc_inventory_removal_fee(
    units: int,
    weight_kg: float,
    market: Market,
    method: InventoryRemovalMethod = InventoryRemovalMethod.DELIVERY,
    is_cross_city: bool = False,
    cbf: float = 0.0,
) -> dict:
    """Calculate the fee to remove inventory from Noon's FBN warehouse.

    Two methods:
    - Delivery: Noon ships items to seller's address
    - Collection: Seller picks up from Noon warehouse

    Args:
        units: Number of units to remove.
        weight_kg: Total weight in kg (for delivery method).
        market: Target market.
        method: delivery or collection.
        is_cross_city: Whether delivery is cross-city (higher rate).
        cbf: Cubic feet of items (for collection processing fee).

    Returns:
        dict with fee breakdown, currency.
    """
    fees_data = load_fee_data(market)
    config = fees_data.get("inventory_removal_fees") or fees_data.get("inventory_removal", {})
    method_config = config.get(method.value, {})

    min_fee = method_config.get("min_fee") or method_config.get("minimum_fee", 15)
    handling = method_config.get("handling_per_unit", 0.3) * units

    if method == InventoryRemovalMethod.DELIVERY:
        if is_cross_city:
            transport = method_config.get("cross_city_per_kg", 2.0) * weight_kg
        else:
            transport = method_config.get("same_city_per_kg", 1.0) * weight_kg
        processing = 0
    else:
        transport = 0
        processing = method_config.get("processing_per_cbf", 0.8) * cbf

    subtotal = handling + transport + processing
    fee = max(min_fee, subtotal)

    return {
        "fee": round(fee, 2),
        "min_fee": min_fee,
        "handling_fee": round(handling, 2),
        "transport_fee": round(transport, 2),
        "processing_fee": round(processing, 2),
        "method": method.value,
        "currency": fees_data["currency"],
    }


# --- Tool 8: Value-Added Services Fee ---

def lookup_vas_fee(
    service: VASType,
    size_class: SizeClassification,
    market: Market,
) -> dict:
    """Look up the fee for a value-added packaging service.

    Services: polybag/shrink wrap, bubble wrap, box with filler.
    Fee varies by size classification tier.

    Args:
        service: Type of VAS.
        size_class: Item size classification.
        market: Target market.

    Returns:
        dict with fee (or null if not available), currency.
    """
    fees_data = load_fee_data(market)
    vas_data = fees_data.get("value_added_services") or fees_data.get("vas", {})

    service_key = service.value
    if service_key not in vas_data:
        raise ValueError(f"Unknown VAS type: {service_key}")

    service_fees = vas_data[service_key]

    # Map size classification to VAS tier
    if size_class in (
        SizeClassification.SMALL_ENVELOPE,
        SizeClassification.STANDARD_ENVELOPE,
        SizeClassification.LARGE_ENVELOPE,
        SizeClassification.STANDARD_PARCEL,
    ):
        tier_key = "envelope_standard"
    elif size_class == SizeClassification.OVERSIZE:
        tier_key = "oversize"
    else:
        tier_key = "extra_oversize_bulky"

    fee = service_fees.get(tier_key)

    return {
        "fee": fee,
        "available": fee is not None,
        "service": service_key,
        "size_tier": tier_key,
        "currency": fees_data["currency"],
    }


# --- Tool 9: Shipping Fee Reimbursement ---

def lookup_shipping_reimbursement(
    order_value: float,
    market: Market,
) -> dict:
    """Look up the shipping fee charged to the customer (reimbursed to seller).

    Fee depends on order value. Higher-value orders get free shipping.
    This is relevant for FBP/DirectShip sellers.

    Args:
        order_value: Total order value in local currency.
        market: Target market.

    Returns:
        dict with charge, max_per_order, currency.
    """
    fees_data = load_fee_data(market)
    config = fees_data.get("shipping_fee_reimbursement", {})

    max_per_order = config.get("max_per_order", 0)
    tiers = config.get("tiers", [])

    charge = 0
    for tier in tiers:
        max_val = tier.get("max_order_value")
        if max_val is None or order_value <= max_val:
            charge = tier["charge"]
            break

    return {
        "charge": charge,
        "max_per_order": max_per_order,
        "order_value": order_value,
        "currency": fees_data["currency"],
    }


# --- Tool 10: VAT calculation ---

def calc_vat(
    *fee_amounts: float,
    market: Market,
) -> dict:
    """Calculate VAT on Noon service fees.

    IMPORTANT: VAT is applied to service fees (referral + fulfillment + VAS etc.),
    NOT to the selling price.

    VAT rates: UAE 5%, KSA 15%, Egypt 14%.

    Args:
        *fee_amounts: One or more fee amounts to apply VAT to.
        market: Target market.

    Returns:
        dict with vat_amount, vat_rate, base_amount, currency.
    """
    fees_data = load_fee_data(market)
    vat_rate = fees_data["vat_rate"]
    base = sum(fee_amounts)
    vat = base * vat_rate

    return {
        "vat_amount": round(vat, 2),
        "vat_rate": vat_rate,
        "base_amount": round(base, 2),
        "currency": fees_data["currency"],
    }
