"""Core data models and fee data loading for Noon marketplace tools."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional


# --- Enums ---

class Market(str, Enum):
    UAE = "UAE"
    KSA = "KSA"
    EGYPT = "Egypt"


class FulfillmentType(str, Enum):
    FBN = "fbn"
    FBP = "fbp"


class DeliveryMethod(str, Enum):
    PICKUP = "pickup"
    DROPOFF = "dropoff"


class SizeClassification(str, Enum):
    SMALL_ENVELOPE = "small_envelope"
    STANDARD_ENVELOPE = "standard_envelope"
    LARGE_ENVELOPE = "large_envelope"
    STANDARD_PARCEL = "standard_parcel"
    OVERSIZE = "oversize"
    EXTRA_OVERSIZE = "extra_oversize"
    BULKY = "bulky"


class InventoryRemovalMethod(str, Enum):
    DELIVERY = "delivery"
    COLLECTION = "collection"


class VASType(str, Enum):
    POLYBAG_SHRINK_WRAP = "polybag_shrink_wrap"
    BUBBLE_WRAP = "bubble_wrap"
    BOX_WITH_FILLER = "box_with_filler"


# --- Data classes ---

@dataclass
class Dimensions:
    length_cm: float
    width_cm: float
    height_cm: float


# --- Fee data loading ---

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_fee_cache: dict[str, dict] = {}

MARKET_CURRENCY = {
    Market.UAE: "AED",
    Market.KSA: "SAR",
    Market.EGYPT: "EGP",
}

# Default exchange rates (fallback)
DEFAULT_EXCHANGE_RATES: dict[str, dict[str, float]] = {
    "CNY": {"AED": 0.50, "SAR": 0.51, "EGP": 6.80},
    "USD": {"AED": 3.67, "SAR": 3.75, "EGP": 49.50},
}


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


def clear_fee_cache():
    """Clear the fee data cache (useful for testing or after data updates)."""
    _fee_cache.clear()


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
