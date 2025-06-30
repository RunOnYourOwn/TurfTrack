import pytest
from pydantic import ValidationError
from app.schemas.gdd import (
    GDDModelCreate,
    GDDModelUpdate,
    GDDParameterUpdate,
    GDDModelRead,
    GDDParameterHistory,
    GDDValueRead,
    GDDModelWithValues,
    GDDModelWithHistory,
    GDDResetRead,
)
from datetime import date, datetime
from app.models.gdd import ResetType


def test_gdd_model_create_validators():
    # Valid
    GDDModelCreate(
        location_id=1,
        name="Test",
        base_temp=5,
        unit="C",
        start_date=date.today(),
        threshold=10,
        reset_on_threshold=True,
    )
    # Negative base_temp
    with pytest.raises(ValidationError):
        GDDModelCreate(
            location_id=1,
            name="Test",
            base_temp=-1,
            unit="C",
            start_date=date.today(),
            threshold=10,
            reset_on_threshold=True,
        )
    # Zero threshold
    with pytest.raises(ValidationError):
        GDDModelCreate(
            location_id=1,
            name="Test",
            base_temp=5,
            unit="C",
            start_date=date.today(),
            threshold=0,
            reset_on_threshold=True,
        )
    # Invalid unit
    with pytest.raises(ValidationError):
        GDDModelCreate(
            location_id=1,
            name="Test",
            base_temp=5,
            unit="X",
            start_date=date.today(),
            threshold=10,
            reset_on_threshold=True,
        )
    # Name too long
    with pytest.raises(ValidationError):
        GDDModelCreate(
            location_id=1,
            name="A" * 101,
            base_temp=5,
            unit="C",
            start_date=date.today(),
            threshold=10,
            reset_on_threshold=True,
        )


def test_gdd_model_update_validators():
    # All optional, valid
    GDDModelUpdate()
    # Negative base_temp
    with pytest.raises(ValidationError):
        GDDModelUpdate(base_temp=-1)
    # Zero threshold
    with pytest.raises(ValidationError):
        GDDModelUpdate(threshold=0)
    # Name too long
    with pytest.raises(ValidationError):
        GDDModelUpdate(name="A" * 101)


def test_gdd_parameter_update_validators():
    # All optional, valid
    GDDParameterUpdate()
    # Negative base_temp
    with pytest.raises(ValidationError):
        GDDParameterUpdate(base_temp=-1)
    # Zero threshold
    with pytest.raises(ValidationError):
        GDDParameterUpdate(threshold=0)


def test_gdd_model_update_none_validators():
    # Should not raise
    GDDModelUpdate(base_temp=None, threshold=None)


def test_gdd_parameter_update_none_validators():
    # Should not raise
    GDDParameterUpdate(base_temp=None, threshold=None)


def test_gdd_model_read_serialization():
    data = dict(
        id=1,
        location_id=1,
        name="Test",
        base_temp=5,
        unit="C",
        start_date=date.today(),
        threshold=10,
        reset_on_threshold=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    obj = GDDModelRead(**data)
    assert obj.name == "Test"


def test_gdd_parameter_history_serialization():
    data = dict(
        id=1,
        gdd_model_id=1,
        base_temp=5,
        threshold=10,
        reset_on_threshold=True,
        effective_from=date.today(),
        created_at=datetime.now(),
    )
    obj = GDDParameterHistory(**data)
    assert obj.gdd_model_id == 1


def test_gdd_value_read_serialization():
    data = dict(
        id=1,
        gdd_model_id=1,
        date=date.today(),
        daily_gdd=2.5,
        cumulative_gdd=10.0,
        is_forecast=False,
        effective_params={"base_temp": 5},
    )
    obj = GDDValueRead(**data)
    assert obj.daily_gdd == 2.5


def test_gdd_model_with_values_and_history():
    base = dict(
        id=1,
        location_id=1,
        name="Test",
        base_temp=5,
        unit="C",
        start_date=date.today(),
        threshold=10,
        reset_on_threshold=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    values = [
        dict(
            id=1,
            gdd_model_id=1,
            date=date.today(),
            daily_gdd=2.5,
            cumulative_gdd=10.0,
            is_forecast=False,
            effective_params=None,
        )
    ]
    history = [
        dict(
            id=1,
            gdd_model_id=1,
            base_temp=5,
            threshold=10,
            reset_on_threshold=True,
            effective_from=date.today(),
            created_at=datetime.now(),
        )
    ]
    obj1 = GDDModelWithValues(**base, gdd_values=[GDDValueRead(**values[0])])
    assert obj1.gdd_values[0].daily_gdd == 2.5
    obj2 = GDDModelWithHistory(
        **base, parameter_history=[GDDParameterHistory(**history[0])]
    )
    assert obj2.parameter_history[0].base_temp == 5


def test_gdd_reset_read_serialization():
    data = dict(
        id=1,
        gdd_model_id=1,
        reset_date=date.today(),
        run_number=1,
        reset_type=ResetType.manual,
        created_at=datetime.now(),
    )
    obj = GDDResetRead(**data)
    assert obj.reset_type == ResetType.manual
