"""Tool 5: Storage fee calculation.

Calculates FBN warehouse storage fees:
- Monthly storage fee (per CBF per month)
- Long-term storage surcharge (items stored > threshold days)
- Non-saleable item storage fee (items marked non-saleable > 30 days)

Data source: Noon FBN fee documentation.
"""

from __future__ import annotations

from calculator.classify import calc_cubic_feet
from calculator.models import Dimensions, Market, load_fee_data


def calc_storage_fee(
    dimensions: Dimensions,
    market: Market,
    storage_months: float = 1.0,
    is_refurbished: bool = False,
) -> dict:
    """Calculate monthly storage fee for an item in Noon's FBN warehouse.

    Args:
        dimensions: Item dimensions (L x W x H in cm).
        market: Target market.
        storage_months: Number of months stored.
        is_refurbished: Whether this is a refurbished/renewed product.

    Returns:
        dict with monthly_fee, cbf, rate_per_cbf, currency.
    """
    fees_data = load_fee_data(market)

    if is_refurbished:
        storage_data = fees_data.get("refurbished", {}).get("storage_fees", {})
    else:
        storage_data = fees_data.get("storage_fees", {})

    monthly_data = storage_data.get("monthly", {})
    rate_per_cbf = monthly_data.get("rate_per_cbf") or storage_data.get("monthly_per_cbf", 0)

    cbf = calc_cubic_feet(dimensions)
    monthly_fee = cbf * rate_per_cbf
    total_fee = monthly_fee * storage_months

    return {
        "monthly_fee": round(monthly_fee, 2),
        "total_fee": round(total_fee, 2),
        "storage_months": storage_months,
        "cbf": round(cbf, 4),
        "rate_per_cbf": rate_per_cbf,
        "currency": fees_data["currency"],
    }


def calc_long_term_storage_fee(
    dimensions: Dimensions,
    market: Market,
    is_refurbished: bool = False,
) -> dict:
    """Calculate the long-term storage surcharge.

    Applied to items stored beyond the threshold (365 days for UAE/KSA, 180 days for Egypt).

    Returns:
        dict with fee, threshold_days, rate_per_cbf, cbf, currency.
    """
    fees_data = load_fee_data(market)

    if is_refurbished:
        storage_data = fees_data.get("refurbished", {}).get("storage_fees", {})
    else:
        storage_data = fees_data.get("storage_fees", {})

    lt_data = storage_data.get("long_term", {})
    threshold_days = lt_data.get("threshold_days", 365)
    rate_per_cbf = lt_data.get("rate_per_cbf") or lt_data.get("fee_per_cbf", 0)

    cbf = calc_cubic_feet(dimensions)
    fee = cbf * rate_per_cbf

    return {
        "fee": round(fee, 2),
        "threshold_days": threshold_days,
        "rate_per_cbf": rate_per_cbf,
        "cbf": round(cbf, 4),
        "currency": fees_data["currency"],
    }


def calc_non_saleable_storage_fee(
    dimensions: Dimensions,
    market: Market,
    is_refurbished: bool = False,
) -> dict:
    """Calculate the non-saleable item storage fee.

    Applied to items marked as non-saleable and stored > 30 days.

    Returns:
        dict with fee, threshold_days, rate_per_cbf, cbf, currency.
    """
    fees_data = load_fee_data(market)

    if is_refurbished:
        storage_data = fees_data.get("refurbished", {}).get("storage_fees", {})
    else:
        storage_data = fees_data.get("storage_fees", {})

    ns_data = storage_data.get("non_saleable", {})
    threshold_days = ns_data.get("threshold_days", 30)
    rate_per_cbf = ns_data.get("rate_per_cbf") or ns_data.get("fee_per_cbf", 0)

    cbf = calc_cubic_feet(dimensions)
    fee = cbf * rate_per_cbf

    return {
        "fee": round(fee, 2),
        "threshold_days": threshold_days,
        "rate_per_cbf": rate_per_cbf,
        "cbf": round(cbf, 4),
        "currency": fees_data["currency"],
    }
