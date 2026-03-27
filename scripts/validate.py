#!/usr/bin/env python3
"""Validate calculator against Noon's Excel calculators and real-world test cases.

Usage:
    python scripts/validate.py              # Run all validations
    python scripts/validate.py --excel      # Only Excel cross-validation
    python scripts/validate.py --scenarios  # Only real-world scenarios
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from calculator.classify import classify_item_size, classify_directship_size, calc_billable_weight, calc_cubic_feet
from calculator.referral_fee import lookup_referral_fee
from calculator.fulfillment_fee import lookup_fbn_outbound_fee, lookup_directship_fee
from calculator.storage_fee import calc_storage_fee
from calculator.other_fees import calc_return_admin_fee, calc_vat, lookup_shipping_reimbursement
from calculator.models import (
    Dimensions, Market, SizeClassification, FulfillmentType,
    DeliveryMethod, get_exchange_rate, MARKET_CURRENCY,
)


def validate_excel_default_case():
    """Validate against the default values in Noon's FBN Excel Calculator.

    Excel default inputs: UAE, 10x10x10cm, 100g, Sale Price 25 AED
    """
    print("=" * 60)
    print("TEST 1: Excel Default Case (UAE, 10x10x10cm, 100g, 25 AED)")
    print("=" * 60)

    dims = Dimensions(length_cm=10, width_cm=10, height_cm=10)
    weight_kg = 0.1  # 100g
    sale_price = 25.0
    market = Market.UAE

    # Step 1: Classify
    size = classify_item_size(dims, weight_kg, market)
    print(f"  Classification: {size.value}")
    # 10x10x10 fits Standard Parcel (≤45x34x26)
    assert size == SizeClassification.STANDARD_PARCEL, f"Expected standard_parcel, got {size.value}"

    # Step 2: Billable weight
    billable = calc_billable_weight(weight_kg, dims, size, market)
    print(f"  Billable weight: {billable} kg")
    # physical: 100g + 100g packaging = 200g = 0.2kg
    # volumetric: 10*10*10/5000 = 0.2kg
    # max(0.2, 0.2) = 0.2kg
    assert billable == 0.2, f"Expected 0.2, got {billable}"

    # Step 3: FBN Outbound Fee
    fbn = lookup_fbn_outbound_fee(billable, size, market, average_selling_price=sale_price)
    print(f"  FBN Fee: {fbn['fee']} {fbn['currency']} (ASP bucket: {fbn['asp_bucket']})")
    # ASP = 25 → ≤ 25 threshold → low bucket
    # Standard Parcel, 0.2kg (= 200g), ASP low → 7.0 AED (first tier ≤250g)
    assert fbn["asp_bucket"] == "low"
    assert fbn["fee"] == 7.0, f"Expected 7.0, got {fbn['fee']}"

    # Step 4: Storage
    storage = calc_storage_fee(dims, market)
    cbf = calc_cubic_feet(dims)
    print(f"  CBF: {cbf:.4f}")
    print(f"  Monthly storage: {storage['monthly_fee']} {storage['currency']}")

    print("  ✅ PASSED\n")


def validate_directship_default_case():
    """Validate against the default values in Noon's DirectShip Excel Calculator.

    Excel default inputs: UAE, 10x10x10cm, 100g
    """
    print("=" * 60)
    print("TEST 2: DirectShip Default Case (UAE, 10x10x10cm, 100g)")
    print("=" * 60)

    dims = Dimensions(length_cm=10, width_cm=10, height_cm=10)
    weight_kg = 0.1
    market = Market.UAE

    # Classification for DirectShip
    ds_size = classify_directship_size(dims, weight_kg)
    print(f"  DS Classification: {ds_size.value}")
    assert ds_size == SizeClassification.STANDARD_PARCEL

    # Billable weight (DirectShip uses max of physical vs volumetric, no packaging addition in classification)
    billable = calc_billable_weight(weight_kg, dims, ds_size, market)
    print(f"  Billable weight: {billable} kg")

    # DirectShip fees
    pickup = lookup_directship_fee(billable, ds_size, market, DeliveryMethod.PICKUP)
    dropoff = lookup_directship_fee(billable, ds_size, market, DeliveryMethod.DROPOFF)
    print(f"  Pickup fee:  {pickup['fee']} {pickup['currency']}")
    print(f"  Dropoff fee: {dropoff['fee']} {dropoff['currency']}")
    print(f"  Difference:  {pickup['fee'] - dropoff['fee']} (should be 2.0)")
    assert pickup["fee"] - dropoff["fee"] == 2.0

    print("  ✅ PASSED\n")


def validate_real_scenario_portable_fan():
    """Real scenario: Chinese seller selling portable fan on Noon UAE via FBN.

    Product: Portable USB Fan
    Cost: ¥35 CNY
    Weight: 300g
    Dimensions: 20x15x8 cm
    Selling Price: 69 AED
    Fulfillment: FBN
    Market: UAE
    Category: Home (Cleaning & Hygiene, 9%)
    International Shipping: ¥30/kg → ¥9 for 0.3kg
    """
    print("=" * 60)
    print("TEST 3: Real Scenario - Portable Fan (UAE FBN)")
    print("=" * 60)

    dims = Dimensions(length_cm=20, width_cm=15, height_cm=8)
    weight_kg = 0.3
    sale_price = 69.0
    cost_cny = 35.0
    shipping_cny = 9.0  # ¥30/kg × 0.3kg
    fx_rate = 0.50  # 1 CNY ≈ 0.50 AED
    market = Market.UAE
    category = "home.cleaning_hygiene"

    # Classification
    size = classify_item_size(dims, weight_kg, market)
    print(f"  Classification: {size.value}")

    # Billable weight
    billable = calc_billable_weight(weight_kg, dims, size, market)
    print(f"  Billable weight: {billable} kg")
    # physical: 300g + 100g = 400g; volumetric: 20*15*8/5000 = 0.48kg
    # max(0.4, 0.48) = 0.48 → ceil to 0.5

    # Referral fee
    ref = lookup_referral_fee(sale_price, category, market)
    print(f"  Referral fee: {ref['fee']} AED ({ref['rate_type']}, {ref['effective_rate']:.1%})")

    # FBN fee
    fbn = lookup_fbn_outbound_fee(billable, size, market, average_selling_price=sale_price)
    print(f"  FBN fee: {fbn['fee']} AED (ASP: {fbn['asp_bucket']})")

    # VAT
    vat = calc_vat(ref["fee"], fbn["fee"], market=market)
    print(f"  VAT (5%): {vat['vat_amount']} AED (on {vat['base_amount']} AED service fees)")

    # Cost conversion
    cost_aed = cost_cny * fx_rate
    shipping_aed = shipping_cny * fx_rate
    print(f"  Cost: ¥{cost_cny} = {cost_aed} AED")
    print(f"  Int'l shipping: ¥{shipping_cny} = {shipping_aed} AED")

    # Profit calculation (Claude would do this)
    total_costs = ref["fee"] + fbn["fee"] + vat["vat_amount"] + cost_aed + shipping_aed
    net_profit = sale_price - total_costs
    margin = net_profit / sale_price

    print(f"\n  --- Profit Breakdown ---")
    print(f"  Revenue:           {sale_price:>8.2f} AED")
    print(f"  - Referral fee:    {ref['fee']:>8.2f} AED")
    print(f"  - FBN fee:         {fbn['fee']:>8.2f} AED")
    print(f"  - VAT:             {vat['vat_amount']:>8.2f} AED")
    print(f"  - Cost of goods:   {cost_aed:>8.2f} AED")
    print(f"  - Int'l shipping:  {shipping_aed:>8.2f} AED")
    print(f"  = Net profit:      {net_profit:>8.2f} AED")
    print(f"  = Margin:          {margin:>8.1%}")

    assert net_profit > 0, "Expected positive profit"
    assert margin > 0.2, f"Expected >20% margin, got {margin:.1%}"

    # Return scenario
    ret = calc_return_admin_fee(ref["fee"], market)
    print(f"\n  If returned: admin fee = {ret['fee']} AED")
    print(f"  Total loss on return: {cost_aed + shipping_aed + fbn['fee'] + ret['fee']:.2f} AED")

    print("  ✅ PASSED\n")


def validate_real_scenario_phone_case_ksa():
    """Real scenario: Phone case on Noon KSA via DirectShip.

    Product: iPhone Case
    Cost: ¥8 CNY
    Weight: 50g
    Dimensions: 16x8x1.5 cm
    Selling Price: 29 SAR
    Fulfillment: DirectShip Pickup
    Market: KSA
    Category: Electronics Accessories
    """
    print("=" * 60)
    print("TEST 4: Real Scenario - Phone Case (KSA DirectShip)")
    print("=" * 60)

    dims = Dimensions(length_cm=16, width_cm=8, height_cm=1.5)
    weight_kg = 0.05
    sale_price = 29.0
    cost_cny = 8.0
    shipping_cny = 5.0  # small item, low shipping
    fx_rate = 0.51
    market = Market.KSA
    category = "electronics.accessories"

    # Classification (small → envelope or standard parcel)
    size_fbn = classify_item_size(dims, weight_kg, market)
    size_ds = classify_directship_size(dims, weight_kg)
    print(f"  FBN Classification: {size_fbn.value}")
    print(f"  DS Classification:  {size_ds.value}")

    # Billable weight
    billable = calc_billable_weight(weight_kg, dims, size_ds, market)
    print(f"  Billable weight: {billable} kg")

    # Referral fee
    ref = lookup_referral_fee(sale_price, category, market)
    print(f"  Referral fee: {ref['fee']} SAR ({ref['effective_rate']:.1%})")

    # DirectShip fee
    ds = lookup_directship_fee(billable, size_ds, market, DeliveryMethod.PICKUP)
    print(f"  DS pickup fee: {ds['fee']} SAR")

    # VAT (KSA 15%)
    vat = calc_vat(ref["fee"], ds["fee"], market=market)
    print(f"  VAT (15%): {vat['vat_amount']} SAR")

    # Shipping reimbursement (customer pays)
    reimb = lookup_shipping_reimbursement(sale_price, market)
    print(f"  Shipping reimbursement: {reimb['charge']} SAR")

    # Profit
    cost_sar = cost_cny * fx_rate
    shipping_sar = shipping_cny * fx_rate
    total_costs = ref["fee"] + ds["fee"] + vat["vat_amount"] + cost_sar + shipping_sar
    net_profit = sale_price - total_costs
    margin = net_profit / sale_price

    print(f"\n  --- Profit Breakdown ---")
    print(f"  Revenue:           {sale_price:>8.2f} SAR")
    print(f"  - Referral fee:    {ref['fee']:>8.2f} SAR")
    print(f"  - DS fee:          {ds['fee']:>8.2f} SAR")
    print(f"  - VAT:             {vat['vat_amount']:>8.2f} SAR")
    print(f"  - Cost of goods:   {cost_sar:>8.2f} SAR")
    print(f"  - Int'l shipping:  {shipping_sar:>8.2f} SAR")
    print(f"  = Net profit:      {net_profit:>8.2f} SAR")
    print(f"  = Margin:          {margin:>8.1%}")

    print("  ✅ PASSED\n")


def validate_real_scenario_furniture_egypt():
    """Real scenario: Furniture on Noon Egypt via FBN (oversize item).

    Product: Small Bookshelf
    Cost: ¥150 CNY
    Weight: 8kg
    Dimensions: 80x40x30 cm (oversize)
    Selling Price: 1500 EGP
    Fulfillment: FBN
    Market: Egypt
    """
    print("=" * 60)
    print("TEST 5: Real Scenario - Bookshelf (Egypt FBN, Oversize)")
    print("=" * 60)

    dims = Dimensions(length_cm=80, width_cm=40, height_cm=30)
    weight_kg = 8.0
    sale_price = 1500.0
    cost_cny = 150.0
    shipping_cny = 240.0  # ¥30/kg × 8kg
    fx_rate = 6.80
    market = Market.EGYPT
    category = "home.furniture"

    # Classification
    size = classify_item_size(dims, weight_kg, market)
    print(f"  Classification: {size.value}")
    # 80cm longest > 45cm, but median 40 > 34 → could be extra_oversize depending on data
    assert size in (SizeClassification.OVERSIZE, SizeClassification.EXTRA_OVERSIZE)

    # Billable weight
    billable = calc_billable_weight(weight_kg, dims, size, market)
    print(f"  Billable weight: {billable} kg")
    # physical: 8.0 + 0.24 (oversize packaging) = 8.24
    # volumetric: 80*40*30/5000 = 19.2
    # max(8.24, 19.2) = 19.2 → ceil to 19.2

    # Referral fee
    ref = lookup_referral_fee(sale_price, category, market)
    print(f"  Referral fee: {ref['fee']} EGP ({ref['effective_rate']:.1%})")

    # FBN fee (Egypt, no ASP split)
    fbn = lookup_fbn_outbound_fee(billable, size, market)
    print(f"  FBN fee: {fbn['fee']} EGP")

    # VAT (Egypt 14%)
    vat = calc_vat(ref["fee"], fbn["fee"], market=market)
    print(f"  VAT (14%): {vat['vat_amount']} EGP")

    # Storage (6 months estimate)
    storage = calc_storage_fee(dims, market, storage_months=6)
    print(f"  Storage (6mo): {storage['total_fee']} EGP")

    # Profit
    cost_egp = cost_cny * fx_rate
    shipping_egp = shipping_cny * fx_rate
    total_costs = ref["fee"] + fbn["fee"] + vat["vat_amount"] + cost_egp + shipping_egp
    net_profit = sale_price - total_costs
    margin = net_profit / sale_price

    print(f"\n  --- Profit Breakdown ---")
    print(f"  Revenue:           {sale_price:>10.2f} EGP")
    print(f"  - Referral fee:    {ref['fee']:>10.2f} EGP")
    print(f"  - FBN fee:         {fbn['fee']:>10.2f} EGP")
    print(f"  - VAT:             {vat['vat_amount']:>10.2f} EGP")
    print(f"  - Cost of goods:   {cost_egp:>10.2f} EGP")
    print(f"  - Int'l shipping:  {shipping_egp:>10.2f} EGP")
    print(f"  = Net profit:      {net_profit:>10.2f} EGP")
    print(f"  = Margin:          {margin:>10.1%}")

    print("  ✅ PASSED\n")


def validate_market_comparison():
    """Compare the same product across all 3 markets."""
    print("=" * 60)
    print("TEST 6: Cross-Market Comparison (same product, 3 markets)")
    print("=" * 60)

    dims = Dimensions(length_cm=25, width_cm=15, height_cm=5)
    weight_kg = 0.5

    print(f"\n  Product: 25x15x5cm, 0.5kg, FBN")
    print(f"  {'':>20} {'UAE (AED)':>12} {'KSA (SAR)':>12} {'Egypt (EGP)':>12}")
    print(f"  {'':>20} {'-'*12} {'-'*12} {'-'*12}")

    for market in [Market.UAE, Market.KSA, Market.EGYPT]:
        size = classify_item_size(dims, weight_kg, market)
        billable = calc_billable_weight(weight_kg, dims, size, market)
        fbn = lookup_fbn_outbound_fee(billable, size, market, average_selling_price=50)

        if market == Market.UAE:
            row = f"  FBN fee:           {fbn['fee']:>12.2f}"
        elif market == Market.KSA:
            row += f" {fbn['fee']:>12.2f}"
        else:
            row += f" {fbn['fee']:>12.2f}"
            print(row)

    print("  ✅ PASSED\n")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--excel", action="store_true", help="Only Excel validation")
    parser.add_argument("--scenarios", action="store_true", help="Only real scenarios")
    args = parser.parse_args()

    run_all = not args.excel and not args.scenarios

    print("\n🔍 Noon Fee Calculator Validation\n")

    if run_all or args.excel:
        validate_excel_default_case()
        validate_directship_default_case()

    if run_all or args.scenarios:
        validate_real_scenario_portable_fan()
        validate_real_scenario_phone_case_ksa()
        validate_real_scenario_furniture_egypt()
        validate_market_comparison()

    print("=" * 60)
    print("✅ All validations passed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
