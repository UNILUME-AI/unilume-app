"""Profit calculation engine.

Forward:  given selling price → compute net profit
Reverse:  given cost + target margin → compute suggested selling price
"""

from __future__ import annotations

from calculator.fulfillment_fee import (
    calc_billable_weight,
    classify_size,
    lookup_fulfillment_fee,
)
from calculator.models import (
    FeeBreakdown,
    Fulfillment,
    Market,
    ProfitInput,
    ProfitResult,
    get_exchange_rate,
    load_fee_data,
    MARKET_CURRENCY,
)
from calculator.referral_fee import calc_referral_fee


def calc_profit(inp: ProfitInput) -> ProfitResult:
    """Calculate net profit for a product sale on Noon.

    Formula:
      net_profit = selling_price - referral_fee - fulfillment_fee
                   - VAT * (referral_fee + fulfillment_fee)
                   - cost_of_goods_local - international_shipping_local
    """
    fees_data = load_fee_data(inp.market)
    vat_rate = fees_data["vat_rate"]
    target_currency = MARKET_CURRENCY[inp.market]

    # Exchange rate
    fx_rate = get_exchange_rate(inp.cost_currency, target_currency, inp.exchange_rate)

    # Convert costs to local currency
    cost_local = inp.cost_price * fx_rate
    shipping_local = inp.shipping_cost_per_unit * fx_rate

    # Referral fee
    referral_fee, referral_rate = calc_referral_fee(
        inp.selling_price, inp.category_id, inp.market
    )

    # Fulfillment fee
    size_class = classify_size(inp.dimensions)
    billable_weight = calc_billable_weight(inp.weight_kg, inp.dimensions, size_class)
    fulfillment_fee = lookup_fulfillment_fee(
        billable_weight,
        inp.market,
        inp.fulfillment,
        size_class,
        inp.average_selling_price,
    )

    # VAT on service fees (referral + fulfillment), NOT on selling price
    vat_amount = (referral_fee + fulfillment_fee) * vat_rate

    # Total costs
    total_costs = (
        referral_fee + fulfillment_fee + vat_amount + cost_local + shipping_local
    )

    net_profit = inp.selling_price - total_costs
    profit_margin = net_profit / inp.selling_price if inp.selling_price > 0 else 0.0

    # Breakeven price: find the minimum selling price where net_profit >= 0
    breakeven = _calc_breakeven(
        cost_local=cost_local,
        shipping_local=shipping_local,
        category_id=inp.category_id,
        market=inp.market,
        fulfillment_fee=fulfillment_fee,
        vat_rate=vat_rate,
        fees_data=fees_data,
    )

    breakdown = FeeBreakdown(
        revenue=round(inp.selling_price, 2),
        referral_fee=round(referral_fee, 2),
        referral_rate=round(referral_rate, 6),
        fulfillment_fee=round(fulfillment_fee, 2),
        vat=round(vat_amount, 2),
        cost_of_goods=round(cost_local, 2),
        international_shipping=round(shipping_local, 2),
        total_costs=round(total_costs, 2),
    )

    exchange_info = None
    if inp.cost_currency != target_currency:
        exchange_info = {
            "from": inp.cost_currency,
            "to": target_currency,
            "rate": fx_rate,
            "source": "custom" if inp.exchange_rate else "default",
        }

    return ProfitResult(
        input_summary={
            "selling_price": inp.selling_price,
            "cost_price": inp.cost_price,
            "cost_currency": inp.cost_currency,
            "market": inp.market.value,
            "category_id": inp.category_id,
            "fulfillment": inp.fulfillment.value,
            "weight_kg": inp.weight_kg,
        },
        breakdown=breakdown,
        net_profit=round(net_profit, 2),
        profit_margin=round(profit_margin, 4),
        breakeven_price=round(breakeven, 2),
        exchange_rate_used=exchange_info,
    )


def reverse_price(
    cost_price: float,
    cost_currency: str,
    target_margin: float,
    market: Market,
    category_id: str,
    fulfillment: Fulfillment,
    weight_kg: float,
    shipping_cost_per_unit: float = 0.0,
    exchange_rate: float | None = None,
    dimensions=None,
    average_selling_price: float | None = None,
) -> float:
    """Given cost and target profit margin, find the selling price.

    For flat-rate categories, uses closed-form formula:
      P = (C + L * (1 + v)) / (1 - r * (1 + v) - M)

    For tiered/price_switch, uses binary search since the rate is a function of price.

    Args:
        target_margin: desired profit margin as decimal (e.g. 0.30 for 30%)

    Returns:
        Suggested selling price in local currency.
    """
    fees_data = load_fee_data(market)
    vat_rate = fees_data["vat_rate"]
    target_currency = MARKET_CURRENCY[market]
    fx_rate = get_exchange_rate(cost_currency, target_currency, exchange_rate)

    cost_local = cost_price * fx_rate
    shipping_local = shipping_cost_per_unit * fx_rate

    # Fulfillment fee (fixed for a given weight/size)
    size_class = classify_size(dimensions)
    billable_weight = calc_billable_weight(weight_kg, dimensions, size_class)
    fulfillment_fee = lookup_fulfillment_fee(
        billable_weight, market, fulfillment, size_class, average_selling_price
    )

    # Check if flat rate — can use closed-form
    referral_config = fees_data["referral_fees"].get(category_id)
    if referral_config and referral_config["type"] == "flat":
        r = referral_config["rate"]
        v = vat_rate
        fixed_costs = cost_local + shipping_local + fulfillment_fee * (1 + v)
        denominator = 1 - r * (1 + v) - target_margin
        if denominator <= 0:
            raise ValueError(
                f"Target margin {target_margin:.0%} is not achievable with "
                f"referral rate {r:.0%} and VAT {v:.0%}"
            )
        return round(fixed_costs / denominator, 2)

    # Binary search for tiered/price_switch
    return _binary_search_price(
        cost_local=cost_local,
        shipping_local=shipping_local,
        fulfillment_fee=fulfillment_fee,
        vat_rate=vat_rate,
        target_margin=target_margin,
        category_id=category_id,
        market=market,
    )


def _binary_search_price(
    cost_local: float,
    shipping_local: float,
    fulfillment_fee: float,
    vat_rate: float,
    target_margin: float,
    category_id: str,
    market: Market,
    max_iterations: int = 100,
    tolerance: float = 0.01,
) -> float:
    """Binary search to find selling price that achieves target margin."""
    lo = 0.01
    hi = (cost_local + shipping_local + fulfillment_fee) * 10  # generous upper bound

    for _ in range(max_iterations):
        mid = (lo + hi) / 2
        ref_fee, _ = calc_referral_fee(mid, category_id, market)
        vat = (ref_fee + fulfillment_fee) * vat_rate
        total_costs = ref_fee + fulfillment_fee + vat + cost_local + shipping_local
        net_profit = mid - total_costs
        margin = net_profit / mid if mid > 0 else -1

        if abs(margin - target_margin) < tolerance / 100:
            return round(mid, 2)

        if margin < target_margin:
            lo = mid
        else:
            hi = mid

    return round((lo + hi) / 2, 2)


def _calc_breakeven(
    cost_local: float,
    shipping_local: float,
    category_id: str,
    market: Market,
    fulfillment_fee: float,
    vat_rate: float,
    fees_data: dict,
) -> float:
    """Calculate breakeven selling price (net_profit = 0, margin = 0)."""
    referral_config = fees_data["referral_fees"].get(category_id)

    # Flat rate — closed-form
    if referral_config and referral_config["type"] == "flat":
        r = referral_config["rate"]
        v = vat_rate
        fixed_costs = cost_local + shipping_local + fulfillment_fee * (1 + v)
        denominator = 1 - r * (1 + v)
        if denominator <= 0:
            return float("inf")
        return fixed_costs / denominator

    # Binary search for margin = 0
    return _binary_search_price(
        cost_local=cost_local,
        shipping_local=shipping_local,
        fulfillment_fee=fulfillment_fee,
        vat_rate=vat_rate,
        target_margin=0.0,
        category_id=category_id,
        market=market,
    )
