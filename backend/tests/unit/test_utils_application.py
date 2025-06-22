import pytest
from app.utils.application import convert_to_base_unit, calculate_application_results


class Dummy:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def test_convert_to_base_unit_granular():
    assert convert_to_base_unit(1, "lbs") == 1
    assert convert_to_base_unit(16, "oz") == 1
    assert convert_to_base_unit(1, "kg") == pytest.approx(2.20462)
    assert convert_to_base_unit(1000, "g") == pytest.approx(2.20462)


def test_convert_to_base_unit_liquid():
    # 'oz' is treated as granular (1 oz = 0.0625 lbs)
    assert convert_to_base_unit(1, "oz") == 0.0625
    assert convert_to_base_unit(1, "gal") == 128
    assert convert_to_base_unit(1, "qt") == 32
    assert convert_to_base_unit(1, "pt") == 16
    assert convert_to_base_unit(1, "fl_oz") == 1
    assert convert_to_base_unit(1, "L") == pytest.approx(33.814)
    assert convert_to_base_unit(1000, "mL") == pytest.approx(33.814)


def test_convert_to_base_unit_fallback():
    assert convert_to_base_unit(42, "unknown") == 42
    assert convert_to_base_unit(0, "lbs") == 0
    assert convert_to_base_unit(0, "gal") == 0


def test_calculate_application_results_basic():
    application = Dummy(amount_per_area=2, unit="lbs", area_unit=1000)
    product = Dummy(
        n_pct=10,
        p_pct=5,
        k_pct=15,
        ca_pct=0,
        mg_pct=0,
        s_pct=0,
        fe_pct=0,
        cu_pct=0,
        mn_pct=0,
        b_pct=0,
        zn_pct=0,
        cost_per_lb=2,
    )
    lawn = Dummy(area=2000)
    result = calculate_application_results(application, product, lawn)
    assert result["n_applied"] == 0.2
    assert result["p_applied"] == 0.1
    assert result["k_applied"] == 0.3
    assert result["cost_applied"] == 8


def test_calculate_application_results_zero_and_none():
    application = Dummy(amount_per_area=0, unit="lbs", area_unit=1000)
    product = Dummy(
        n_pct=None,
        p_pct=None,
        k_pct=None,
        ca_pct=None,
        mg_pct=None,
        s_pct=None,
        fe_pct=None,
        cu_pct=None,
        mn_pct=None,
        b_pct=None,
        zn_pct=None,
        cost_per_lb=None,
    )
    lawn = Dummy(area=0)
    result = calculate_application_results(application, product, lawn)
    for v in result.values():
        assert v is None or v == 0


def test_calculate_application_results_missing_fields():
    application = Dummy(amount_per_area=1, unit="lbs", area_unit=1000)
    product = Dummy()  # No nutrient fields
    lawn = Dummy(area=1000)
    result = calculate_application_results(application, product, lawn)
    for k in result:
        if k == "cost_applied":
            assert result[k] == 0
        else:
            assert result[k] == 0


def test_calculate_application_results_liquid_units():
    application = Dummy(amount_per_area=1, unit="gal", area_unit=1000)
    product = Dummy(
        n_pct=10,
        p_pct=0,
        k_pct=0,
        ca_pct=0,
        mg_pct=0,
        s_pct=0,
        fe_pct=0,
        cu_pct=0,
        mn_pct=0,
        b_pct=0,
        zn_pct=0,
        cost_per_lb=1,
    )
    lawn = Dummy(area=1000)
    result = calculate_application_results(application, product, lawn)
    assert result["n_applied"] == 12.8
    assert result["cost_applied"] == 128


def test_calculate_application_results_edge_cases():
    # Negative values
    application = Dummy(amount_per_area=-1, unit="lbs", area_unit=1000)
    product = Dummy(
        n_pct=-10,
        p_pct=0,
        k_pct=0,
        ca_pct=0,
        mg_pct=0,
        s_pct=0,
        fe_pct=0,
        cu_pct=0,
        mn_pct=0,
        b_pct=0,
        zn_pct=0,
        cost_per_lb=-1,
    )
    lawn = Dummy(area=-1000)
    result = calculate_application_results(application, product, lawn)
    assert result["n_applied"] == 0.1
    assert result["cost_applied"] == -1
