"""Referral (commission) fee calculation for Noon marketplace.

Supports three fee models:
  - flat:         Fixed percentage (e.g. 9% for Cleaning & Hygiene)
  - tiered:       Graduated rates by price band, cumulative (e.g. Watches)
  - price_switch: Whole-amount rate switches at a price threshold (e.g. Cosmetics)
"""

from __future__ import annotations

from calculator.models import Market, load_fee_data


def calc_referral_fee(
    sale_price: float,
    category_id: str,
    market: Market,
) -> tuple[float, float]:
    """Calculate the referral fee for a sale.

    Returns:
        (fee_amount, effective_rate) where effective_rate = fee / sale_price
    """
    fees_data = load_fee_data(market)
    min_fee = fees_data.get("min_referral_fee", 1.0)

    referral_fees = fees_data["referral_fees"]
    if category_id not in referral_fees:
        raise ValueError(
            f"Unknown category '{category_id}' for market {market.value}. "
            f"Available: {list(referral_fees.keys())}"
        )

    config = referral_fees[category_id]
    rate_type = config["type"]

    if rate_type == "flat":
        fee = sale_price * config["rate"]

    elif rate_type == "tiered":
        fee = _calc_tiered(sale_price, config["tiers"], min_fee)

    elif rate_type == "price_switch":
        fee = _calc_price_switch(sale_price, config["rules"])

    else:
        raise ValueError(f"Unknown rate type: {rate_type}")

    fee = max(fee, min_fee)
    effective_rate = fee / sale_price if sale_price > 0 else 0.0
    return round(fee, 2), round(effective_rate, 6)


def _calc_tiered(sale_price: float, tiers: list[dict], min_fee: float) -> float:
    """Tiered / graduated calculation — each band computed independently then summed.

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
            # Last tier — apply to all remaining
            fee += remaining * rate
            break

        taxable = min(remaining, up_to)
        fee += taxable * rate
        remaining -= taxable

        if remaining <= 0:
            break

    return fee


def _calc_price_switch(sale_price: float, rules: list[dict]) -> float:
    """Price-switch calculation — the entire amount uses one rate based on which
    price band the sale price falls into.

    Example (Cosmetics UAE):
      rules = [{"max_price": 50, "rate": 0.08}, {"max_price": null, "rate": 0.15}]
      sale_price = 60 → 60 * 0.15 = 9.0  (NOT tiered)
    """
    for rule in rules:
        max_price = rule["max_price"]
        if max_price is None or sale_price <= max_price:
            return sale_price * rule["rate"]

    # Fallback (should not reach here if data is well-formed)
    return sale_price * rules[-1]["rate"]
