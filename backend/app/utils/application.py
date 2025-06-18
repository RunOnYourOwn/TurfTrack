from typing import Any, Dict


def convert_to_base_unit(amount: float, unit: str) -> float:
    """
    Convert amount to base unit:
    - Granular: lbs
    - Liquid: oz
    """
    granular_factors = {
        "lbs": 1,
        "oz": 1 / 16,
        "kg": 2.20462,
        "g": 0.00220462,
    }
    liquid_factors = {
        "oz": 1,
        "gal": 128,
        "qt": 32,
        "pt": 16,
        "fl_oz": 1,
        "L": 33.814,
        "mL": 0.033814,
    }
    if unit in granular_factors:
        return amount * granular_factors[unit]
    elif unit in liquid_factors:
        return amount * liquid_factors[unit]
    else:
        return amount  # fallback: no conversion


def calculate_application_results(
    application: Any, product: Any, lawn: Any
) -> Dict[str, float]:
    """
    Calculate nutrient values per area_unit and total cost for the whole lawn.
    Converts amount_per_area to base unit (lbs for granular, oz for liquid) before calculation.
    application: object with amount_per_area, area_unit, etc.
    product: object with n_pct, p_pct, ..., cost_per_lb
    lawn: object with area (sq_ft)
    Returns a dict of {n_applied, p_applied, ..., cost_applied}
    """
    amount_per_area = getattr(application, "amount_per_area", 0) or 0
    unit = getattr(application, "unit", "lbs") or "lbs"
    area_unit = getattr(application, "area_unit", 1000) or 1000
    lawn_sq_ft = getattr(lawn, "area", 0) or 0

    # Convert amount_per_area to base unit
    base_amount = convert_to_base_unit(amount_per_area, unit)

    # Helper to get product field
    def get_pct(field):
        return (getattr(product, field, 0) or 0) / 100

    n_applied = base_amount * get_pct("n_pct") if base_amount else None
    p_applied = base_amount * get_pct("p_pct") if base_amount else None
    k_applied = base_amount * get_pct("k_pct") if base_amount else None
    ca_applied = base_amount * get_pct("ca_pct") if base_amount else None
    mg_applied = base_amount * get_pct("mg_pct") if base_amount else None
    s_applied = base_amount * get_pct("s_pct") if base_amount else None
    fe_applied = base_amount * get_pct("fe_pct") if base_amount else None
    cu_applied = base_amount * get_pct("cu_pct") if base_amount else None
    mn_applied = base_amount * get_pct("mn_pct") if base_amount else None
    b_applied = base_amount * get_pct("b_pct") if base_amount else None
    zn_applied = base_amount * get_pct("zn_pct") if base_amount else None
    cost_per_lb = getattr(product, "cost_per_lb", 0) or 0
    cost_applied = (
        cost_per_lb * base_amount * (lawn_sq_ft / area_unit)
        if base_amount and area_unit and lawn_sq_ft
        else None
    )
    return {
        "n_applied": n_applied,
        "p_applied": p_applied,
        "k_applied": k_applied,
        "ca_applied": ca_applied,
        "mg_applied": mg_applied,
        "s_applied": s_applied,
        "fe_applied": fe_applied,
        "cu_applied": cu_applied,
        "mn_applied": mn_applied,
        "b_applied": b_applied,
        "zn_applied": zn_applied,
        "cost_applied": cost_applied,
    }
