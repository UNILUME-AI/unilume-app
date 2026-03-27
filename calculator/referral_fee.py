"""Tool 2: Referral (commission) fee lookup.

Looks up the referral fee for a sale on Noon marketplace.
Supports three fee models:
  - flat:         Fixed percentage
  - tiered:       Graduated rates by price band, cumulative
  - price_switch: Whole-amount rate switches at a price threshold

Data source: Noon official fee documentation.
FBN and FBP have slightly different rates for some categories.
"""

from __future__ import annotations

from calculator.models import FulfillmentType, Market, load_fee_data


def lookup_referral_fee(
    sale_price: float,
    category_id: str,
    market: Market,
    fulfillment_type: FulfillmentType = FulfillmentType.FBN,
) -> dict:
    """Look up the referral (commission) fee for a product sale.

    Args:
        sale_price: The selling price in local currency.
        category_id: Category identifier (e.g. 'fashion.apparel_footwear').
        market: Target market (UAE/KSA/Egypt).
        fulfillment_type: FBN or FBP (some categories have different rates).

    Returns:
        dict with:
          - fee: The referral fee amount
          - effective_rate: fee / sale_price
          - category_name: Human-readable category name
          - rate_type: flat/tiered/price_switch
          - min_fee_applied: Whether minimum fee was used
    """
    fees_data = load_fee_data(market)
    min_fee = fees_data.get("min_referral_fee", 1.0)

    referral_section = fees_data["referral_fees"]

    # Determine the base category list and FBP overrides
    # New structure: referral_fees.fbn + referral_fees.fbp_overrides
    # Legacy structure: flat dict of categories (+ optional fbp_referral_overrides)
    if "fbn" in referral_section and isinstance(referral_section["fbn"], dict):
        base_fees = referral_section["fbn"]
        fbp_overrides = referral_section.get("fbp_overrides", {})
    else:
        base_fees = referral_section
        fbp_overrides = (
            fees_data.get("fbp_referral_overrides")
            or fees_data.get("referral_fees_fbp_overrides")
            or {}
        )

    config = None

    if fulfillment_type == FulfillmentType.FBP and category_id in fbp_overrides:
        config = fbp_overrides[category_id]

    if config is None:
        if category_id not in base_fees:
            raise ValueError(
                f"Unknown category '{category_id}' for market {market.value}. "
                f"Available: {sorted(base_fees.keys())}"
            )
        config = base_fees[category_id]

    rate_type = config["type"]
    category_name = config.get("category_name", category_id)

    if rate_type == "flat":
        fee = sale_price * config["rate"]
    elif rate_type == "tiered":
        fee = _calc_tiered(sale_price, config["tiers"])
    elif rate_type == "price_switch":
        fee = _calc_price_switch(sale_price, config["rules"])
    else:
        raise ValueError(f"Unknown rate type: {rate_type}")

    min_fee_applied = fee < min_fee
    fee = max(fee, min_fee)
    effective_rate = fee / sale_price if sale_price > 0 else 0.0

    return {
        "fee": round(fee, 2),
        "effective_rate": round(effective_rate, 6),
        "category_name": category_name,
        "rate_type": rate_type,
        "min_fee_applied": min_fee_applied,
        "currency": fees_data["currency"],
    }


def list_categories(
    market: Market,
    fulfillment_type: FulfillmentType = FulfillmentType.FBN,
) -> list[dict]:
    """List all available categories and their referral fee rates.

    Returns:
        List of dicts with category_id, category_name, rate_type, and rate info.
    """
    fees_data = load_fee_data(market)
    referral_section = fees_data["referral_fees"]

    if "fbn" in referral_section and isinstance(referral_section["fbn"], dict):
        referral_fees = referral_section["fbn"]
        fbp_overrides = referral_section.get("fbp_overrides", {})
    else:
        referral_fees = referral_section
        fbp_overrides = (
            fees_data.get("fbp_referral_overrides")
            or fees_data.get("referral_fees_fbp_overrides")
            or {}
        )

    result = []
    for cat_id, config in referral_fees.items():
        entry = {
            "category_id": cat_id,
            "category_name": config.get("category_name", cat_id),
            "rate_type": config["type"],
        }

        # Use FBP override if applicable
        effective_config = config
        if fulfillment_type == FulfillmentType.FBP and cat_id in fbp_overrides:
            effective_config = fbp_overrides[cat_id]
            entry["fbp_override"] = True

        if effective_config["type"] == "flat":
            entry["rate"] = effective_config["rate"]
        elif effective_config["type"] == "tiered":
            entry["tiers"] = effective_config["tiers"]
        elif effective_config["type"] == "price_switch":
            entry["rules"] = effective_config["rules"]

        result.append(entry)

    return result


def _calc_tiered(sale_price: float, tiers: list[dict]) -> float:
    """Tiered / graduated — each band computed independently then summed.

    Example (Watches UAE):
      tiers = [{"up_to": 5000, "rate": 0.15}, {"up_to": null, "rate": 0.05}]
      sale_price = 6000
      fee = 5000 * 0.15 + 1000 * 0.05 = 800
    """
    fee = 0.0
    remaining = sale_price

    for tier in tiers:
        up_to = tier["up_to"]
        rate = tier["rate"]

        if up_to is None:
            fee += remaining * rate
            break

        taxable = min(remaining, up_to)
        fee += taxable * rate
        remaining -= taxable

        if remaining <= 0:
            break

    return fee


def _calc_price_switch(sale_price: float, rules: list[dict]) -> float:
    """Price-switch — entire amount uses one rate based on which band the price falls into.

    Example (Cosmetics UAE):
      rules = [{"max_price": 50, "rate": 0.08}, {"max_price": null, "rate": 0.15}]
      sale_price = 60 → 60 * 0.15 = 9.0  (NOT tiered — whole amount at 15%)
    """
    for rule in rules:
        max_price = rule["max_price"]
        if max_price is None or sale_price <= max_price:
            return sale_price * rule["rate"]

    return sale_price * rules[-1]["rate"]
