import pytest
from pydantic import ValidationError
from app.schemas.application import (
    ApplicationBase,
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationRead,
    ApplicationUnit,
)
from datetime import date, datetime


def test_application_base_positive_validation():
    # Valid
    ApplicationBase(
        lawn_id=1,
        product_id=2,
        application_date=date.today(),
        amount_per_area=1.0,
        area_unit=1000,
        unit=ApplicationUnit.lbs,
    )
    # Invalid amount_per_area
    with pytest.raises(ValidationError):
        ApplicationBase(
            lawn_id=1,
            product_id=2,
            application_date=date.today(),
            amount_per_area=0,
            area_unit=1000,
            unit=ApplicationUnit.lbs,
        )
    # Invalid area_unit
    with pytest.raises(ValidationError):
        ApplicationBase(
            lawn_id=1,
            product_id=2,
            application_date=date.today(),
            amount_per_area=1.0,
            area_unit=0,
            unit=ApplicationUnit.lbs,
        )


def test_application_update_partial_and_validation():
    # All fields optional, valid
    ApplicationUpdate()
    # Valid positive
    ApplicationUpdate(amount_per_area=2.0, area_unit=1000)
    # Invalid negative
    with pytest.raises(ValidationError):
        ApplicationUpdate(amount_per_area=-1)
    with pytest.raises(ValidationError):
        ApplicationUpdate(area_unit=0)


def test_application_enums():
    # Valid enums
    ApplicationBase(
        lawn_id=1,
        product_id=2,
        application_date=date.today(),
        amount_per_area=1.0,
        area_unit=1000,
        unit="lbs",
        status="planned",
    )
    # Invalid enums
    with pytest.raises(ValidationError):
        ApplicationBase(
            lawn_id=1,
            product_id=2,
            application_date=date.today(),
            amount_per_area=1.0,
            area_unit=1000,
            unit="invalid",
        )
    with pytest.raises(ValidationError):
        ApplicationBase(
            lawn_id=1,
            product_id=2,
            application_date=date.today(),
            amount_per_area=1.0,
            area_unit=1000,
            unit="lbs",
            status="bad",
        )


def test_application_create_lawn_id_and_lawn_ids():
    # Only lawn_id
    ApplicationCreate(
        lawn_id=1,
        product_id=2,
        application_date=date.today(),
        amount_per_area=1.0,
        area_unit=1000,
        unit="lbs",
    )
    # Only lawn_ids
    ApplicationCreate(
        lawn_ids=[1, 2],
        product_id=2,
        application_date=date.today(),
        amount_per_area=1.0,
        area_unit=1000,
        unit="lbs",
    )
    # Both
    ApplicationCreate(
        lawn_id=1,
        lawn_ids=[1, 2],
        product_id=2,
        application_date=date.today(),
        amount_per_area=1.0,
        area_unit=1000,
        unit="lbs",
    )
    # Neither (should fail)
    with pytest.raises(ValidationError):
        ApplicationCreate(
            product_id=2,
            application_date=date.today(),
            amount_per_area=1.0,
            area_unit=1000,
            unit="lbs",
        )


def test_application_read_serialization():
    # All fields
    data = dict(
        id=1,
        lawn_id=1,
        product_id=2,
        application_date=date.today(),
        amount_per_area=1.0,
        area_unit=1000,
        unit="lbs",
        status="completed",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        n_applied=1.0,
        p_applied=2.0,
        k_applied=3.0,
        ca_applied=4.0,
        mg_applied=5.0,
        s_applied=6.0,
        fe_applied=7.0,
        cu_applied=8.0,
        mn_applied=9.0,
        b_applied=10.0,
        zn_applied=11.0,
        cost_applied=12.0,
    )
    obj = ApplicationRead(**data)
    assert obj.n_applied == 1.0
    # Only required fields
    minimal = dict(
        id=1,
        lawn_id=1,
        product_id=2,
        application_date=date.today(),
        amount_per_area=1.0,
        area_unit=1000,
        unit="lbs",
        status="planned",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    obj2 = ApplicationRead(**minimal)
    assert obj2.n_applied is None
