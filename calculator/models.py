"""Data models for the Noon fee calculator."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


class Market(str, Enum):
    UAE = "UAE"
    KSA = "KSA"
    EGYPT = "Egypt"


class Fulfillment(str, Enum):
    FBN = "fbn"
    DIRECTSHIP_PICKUP = "directship_pickup"
    DIRECTSHIP_DROPOFF = "directship_dropoff"


class SizeClassification(str, Enum):
    STANDARD = "standard_parcel"
    OVERSIZE = "oversize_parcel"


@dataclass
class Dimensions:
    length_cm: float
    width_cm: float
    height_cm: float


@dataclass
class ProfitInput:
    selling_price: float
    market: Market
    category_id: str
    fulfillment: Fulfillment
    weight_kg: float
    cost_price: float = 0.0
    cost_currency: str = "CNY"
    shipping_cost_per_unit: float = 0.0
    exchange_rate: Optional[float] = None
    dimensions: Optional[Dimensions] = None
    average_selling_price: Optional[float] = None  # for ASP-based FBN tiers


@dataclass
class FeeBreakdown:
    revenue: float
    referral_fee: float
    referral_rate: float
    fulfillment_fee: float
    vat: float
    cost_of_goods: float
    international_shipping: float
    total_costs: float


@dataclass
class ProfitResult:
    input_summary: dict
    breakdown: FeeBreakdown
    net_profit: float
    profit_margin: float
    breakeven_price: float
    exchange_rate_used: Optional[dict] = None


# --- Fee data loading ---

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Default exchange rates (fallback when no live rate available)
DEFAULT_EXCHANGE_RATES: dict[str, dict[str, float]] = {
    "CNY": {"AED": 0.50, "SAR": 0.51, "EGP": 6.80},
    "USD": {"AED": 3.67, "SAR": 3.75, "EGP": 49.50},
}

MARKET_CURRENCY = {
    Market.UAE: "AED",
    Market.KSA: "SAR",
    Market.EGYPT: "EGP",
}

_fee_cache: dict[str, dict] = {}


def load_fee_data(market: Market) -> dict:
    """Load fee data JSON for a given market, with caching."""
    key = market.value
    if key not in _fee_cache:
        file_map = {
            "UAE": "fees_uae.json",
            "KSA": "fees_ksa.json",
            "Egypt": "fees_egypt.json",
        }
        path = _DATA_DIR / file_map[key]
        with open(path, "r", encoding="utf-8") as f:
            _fee_cache[key] = json.load(f)
    return _fee_cache[key]


def get_exchange_rate(
    from_currency: str,
    to_currency: str,
    custom_rate: Optional[float] = None,
) -> float:
    """Get exchange rate. Uses custom rate if provided, else falls back to defaults."""
    if from_currency == to_currency:
        return 1.0
    if custom_rate is not None:
        return custom_rate
    return DEFAULT_EXCHANGE_RATES[from_currency][to_currency]
