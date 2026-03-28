"""End-to-end validation against real Noon transaction data.

Uses actual transaction CSV (from Noon Finance Web) and inventory CSV
(from Noon Seller Portal) to verify that our calculator logic matches
Noon's actual charges.
"""

from __future__ import annotations

import csv
from pathlib import Path

import pytest

from calculator.classify import calc_billable_weight, classify_item_size
from calculator.fulfillment_fee import lookup_fbn_outbound_fee
from calculator.models import (
    Dimensions,
    FulfillmentType,
    Market,
    SizeClassification,
)
from calculator.referral_fee import lookup_referral_fee

FIXTURES = Path(__file__).parent / "fixtures"
TRANSACTIONS_CSV = FIXTURES / "transactions_sample.csv"
INVENTORY_CSV = FIXTURES / "inventory_sample.csv"

UAE_VAT_RATE = 0.05

# All SANAG products on Noon UAE are classified under headphones (15% for ≤250 AED).
# Speakers also fall into this category based on real transaction data.
CATEGORY_ID = "electronics.headphones"


def _load_inventory() -> dict[str, dict]:
    """Build partner_sku → inventory info lookup (deduplicated)."""
    sku_info: dict[str, dict] = {}
    with open(INVENTORY_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ps = row["partner_sku"]
            if ps not in sku_info:
                sku_info[ps] = {
                    "weight_kg": float(row["weight"]),
                    "shortest": float(row["shortest_side"]),
                    "median": float(row["median_side"]),
                    "longest": float(row["longest_side"]),
                    "noon_class": row["classification_code"],
                    "sku_code": row["sku"],
                }
    return sku_info


def _load_orders() -> list[dict]:
    """Load order rows with positive Net Proceeds."""
    orders = []
    with open(TRANSACTIONS_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Transaction Type"] == "order" and float(row["Net Proceeds"]) > 0:
                orders.append(row)
    return orders


def _match_inventory(order: dict, inventory: dict[str, dict]) -> dict | None:
    """Find inventory entry for an order row."""
    partner_sku = order["Partner SKUs"]
    sku_key = order["SKUs"]
    for ps, info in inventory.items():
        if ps == partner_sku or info["sku_code"] == sku_key:
            return info
    return None


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def inventory():
    return _load_inventory()


@pytest.fixture(scope="module")
def orders():
    return _load_orders()


@pytest.fixture(scope="module")
def matched_orders(orders, inventory):
    """Orders that have a matching inventory entry."""
    result = []
    for o in orders:
        inv = _match_inventory(o, inventory)
        if inv is not None:
            result.append((o, inv))
    return result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestClassification:
    """Verify our classify_item_size matches Noon's official classification_code."""

    def test_all_matched_orders(self, matched_orders):
        failures = []
        for order, inv in matched_orders:
            dims = Dimensions(inv["longest"], inv["median"], inv["shortest"])
            our_class = classify_item_size(dims, inv["weight_kg"])
            if our_class.value != inv["noon_class"]:
                failures.append(
                    f'{order["Partner SKUs"]}: expected {inv["noon_class"]}, '
                    f"got {our_class.value}"
                )
        assert not failures, "Classification mismatches:\n" + "\n".join(failures)


class TestReferralFee:
    """Verify referral fee calculation matches CSV 'Referral Fee including VAT'."""

    def test_all_matched_orders(self, matched_orders):
        failures = []
        for order, inv in matched_orders:
            price = float(order["Net Proceeds"])
            csv_ref_vat = abs(float(order["Referral Fee including VAT"]))

            result = lookup_referral_fee(
                price, CATEGORY_ID, Market.UAE, FulfillmentType.FBN
            )
            calc_ref_vat = round(result["fee"] * (1 + UAE_VAT_RATE), 2)

            if abs(csv_ref_vat - calc_ref_vat) >= 0.02:
                failures.append(
                    f'{order["Partner SKUs"]} (AED {price}): '
                    f"CSV {csv_ref_vat} vs calc {calc_ref_vat}"
                )
        assert not failures, "Referral fee mismatches:\n" + "\n".join(failures)


class TestFulfillmentFee:
    """Verify FBN outbound fee matches CSV 'Fulfillment & Logistics Fees including VAT'."""

    def test_all_matched_orders(self, matched_orders):
        failures = []
        for order, inv in matched_orders:
            csv_ful_vat = abs(
                float(order["Fullfilment & Logistics Fees including VAT"])
            )
            if csv_ful_vat == 0:
                continue  # no fulfillment charge (e.g. FBP self-ship)

            price = float(order["Net Proceeds"])
            dims = Dimensions(inv["longest"], inv["median"], inv["shortest"])
            noon_size = SizeClassification(inv["noon_class"])
            bw = calc_billable_weight(inv["weight_kg"], dims, noon_size)

            result = lookup_fbn_outbound_fee(
                bw, noon_size, Market.UAE, average_selling_price=price
            )
            calc_ful_vat = round(result["fee"] * (1 + UAE_VAT_RATE), 2)

            if abs(csv_ful_vat - calc_ful_vat) >= 0.02:
                failures.append(
                    f'{order["Partner SKUs"]} (AED {price}, {noon_size.value}): '
                    f"CSV {csv_ful_vat} vs calc {calc_ful_vat}"
                )
        assert not failures, "Fulfillment fee mismatches:\n" + "\n".join(failures)


class TestTotal:
    """Verify that Net Proceeds - Referral - Fulfillment = CSV Total for order rows."""

    def test_all_matched_orders(self, matched_orders):
        failures = []
        for order, inv in matched_orders:
            price = float(order["Net Proceeds"])
            ref = abs(float(order["Referral Fee including VAT"]))
            ful = abs(float(order["Fullfilment & Logistics Fees including VAT"]))
            csv_total = float(order["Total"])
            calc_total = round(price - ref - ful, 2)

            if abs(csv_total - calc_total) >= 0.02:
                failures.append(
                    f'{order["Partner SKUs"]}: CSV {csv_total} vs calc {calc_total}'
                )
        assert not failures, "Total mismatches:\n" + "\n".join(failures)
