"""Noon Fee Calculator — Atomic Tool Call Library.

Each function is an independent, composable tool that mirrors one of Noon's
official fee operations. Claude composes these tools to answer seller questions.

Tools:
  1. classify_item_size       — 7-tier FBN size classification
  2. classify_directship_size — 2-tier DirectShip size classification
  3. calc_billable_weight     — Shipping weight (physical+packaging vs volumetric)
  4. calc_cubic_feet          — Cubic feet for storage fee calculation

  5. lookup_referral_fee      — Commission fee by category/price/market
  6. list_categories          — Browse all categories with fee rates

  7. lookup_fbn_outbound_fee  — FBN warehouse outbound shipping fee
  8. lookup_directship_fee    — DirectShip pickup/dropoff shipping fee

  9. calc_storage_fee             — Monthly FBN storage fee
  10. calc_long_term_storage_fee  — Long-term storage surcharge
  11. calc_non_saleable_storage_fee — Non-saleable item storage fee

  12. calc_return_admin_fee       — Return processing fee
  13. calc_inventory_removal_fee  — Inventory removal from FBN warehouse
  14. lookup_vas_fee              — Value-added packaging services
  15. lookup_shipping_reimbursement — Customer shipping charge
  16. calc_vat                    — VAT on service fees
"""

from calculator.classify import (
    calc_billable_weight,
    calc_cubic_feet,
    classify_directship_size,
    classify_item_size,
)
from calculator.fulfillment_fee import (
    lookup_directship_fee,
    lookup_fbn_outbound_fee,
)
from calculator.models import (
    DeliveryMethod,
    Dimensions,
    FulfillmentType,
    InventoryRemovalMethod,
    Market,
    SizeClassification,
    VASType,
)
from calculator.other_fees import (
    calc_inventory_removal_fee,
    calc_return_admin_fee,
    calc_vat,
    lookup_shipping_reimbursement,
    lookup_vas_fee,
)
from calculator.referral_fee import (
    list_categories,
    lookup_referral_fee,
)
from calculator.storage_fee import (
    calc_long_term_storage_fee,
    calc_non_saleable_storage_fee,
    calc_storage_fee,
)

__all__ = [
    # Enums
    "Market",
    "FulfillmentType",
    "DeliveryMethod",
    "SizeClassification",
    "InventoryRemovalMethod",
    "VASType",
    "Dimensions",
    # Classification
    "classify_item_size",
    "classify_directship_size",
    "calc_billable_weight",
    "calc_cubic_feet",
    # Referral
    "lookup_referral_fee",
    "list_categories",
    # Fulfillment
    "lookup_fbn_outbound_fee",
    "lookup_directship_fee",
    # Storage
    "calc_storage_fee",
    "calc_long_term_storage_fee",
    "calc_non_saleable_storage_fee",
    # Other
    "calc_return_admin_fee",
    "calc_inventory_removal_fee",
    "lookup_vas_fee",
    "lookup_shipping_reimbursement",
    "calc_vat",
]
