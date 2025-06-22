import pytest
from unittest.mock import MagicMock, patch
import datetime
from app.utils import gdd


def test_calculate_and_store_gdd_values_sync_model_not_found():
    session = MagicMock()
    session.get.return_value = None
    with pytest.raises(ValueError, match="GDD model not found"):
        gdd.calculate_and_store_gdd_values_sync(session, 1, 1)


def test_calculate_and_store_gdd_values_sync_no_weather():
    session = MagicMock()
    gdd_model = MagicMock()
    session.get.return_value = gdd_model
    session.execute.return_value.scalars.return_value.all.return_value = []
    result = gdd.calculate_and_store_gdd_values_sync(session, 1, 1)
    assert result == 0


def test_manual_gdd_reset_sync_before_initial():
    session = MagicMock()
    gdd_model_id = 1
    reset_date = datetime.date(2024, 1, 1)
    # initial_reset with reset_date after actual_reset_date
    initial_reset = MagicMock()
    initial_reset.reset_date = datetime.date(2024, 1, 5)
    session.query().filter().order_by().first.return_value = initial_reset
    with pytest.raises(
        ValueError, match="Cannot add manual reset before initial reset/start date."
    ):
        gdd.manual_gdd_reset_sync(session, gdd_model_id, reset_date)


def test_get_effective_parameters_found():
    session = MagicMock()
    gdd_model_id = 1
    target_date = datetime.date(2024, 1, 1)
    param = MagicMock()
    param.base_temp = 50.0
    param.threshold = 100.0
    param.reset_on_threshold = True
    session.query().filter().order_by().first.return_value = param
    result = gdd.get_effective_parameters(session, gdd_model_id, target_date)
    assert result == {
        "base_temp": 50.0,
        "threshold": 100.0,
        "reset_on_threshold": True,
    }


def test_get_effective_parameters_not_found():
    session = MagicMock()
    gdd_model_id = 1
    target_date = datetime.date(2024, 1, 1)
    session.query().filter().order_by().first.return_value = None
    # Patch session.get to return a fallback param
    fallback = MagicMock()
    fallback.base_temp = 60.0
    fallback.threshold = 200.0
    fallback.reset_on_threshold = False
    session.get.return_value = fallback
    result = gdd.get_effective_parameters(session, gdd_model_id, target_date)
    assert result == {
        "base_temp": 60.0,
        "threshold": 200.0,
        "reset_on_threshold": False,
    }


def test_store_parameter_history():
    session = MagicMock()
    gdd_model_id = 1
    base_temp = 50.0
    threshold = 100.0
    reset_on_threshold = True
    effective_from = datetime.date(2024, 1, 1)

    # Mock the existing query to return None (so it creates a new record)
    session.query().filter().first.return_value = None

    with patch("app.utils.gdd.GDDModelParameters") as MockParams:
        mock_params_instance = MagicMock()
        MockParams.return_value = mock_params_instance

        gdd.store_parameter_history(
            session,
            gdd_model_id,
            base_temp,
            threshold,
            reset_on_threshold,
            effective_from,
        )

        # Verify GDDModelParameters was called with correct args
        MockParams.assert_called_once_with(
            gdd_model_id=gdd_model_id,
            base_temp=base_temp,
            threshold=threshold,
            reset_on_threshold=reset_on_threshold,
            effective_from=effective_from,
        )

        # Verify session.add was called with the new params instance
        session.add.assert_called_once_with(mock_params_instance)
        assert session.commit.called


def test_calculate_and_store_gdd_values_sync_segmented_model_not_found():
    session = MagicMock()
    session.get.return_value = None
    with pytest.raises(ValueError, match="GDD model not found"):
        gdd.calculate_and_store_gdd_values_sync_segmented(session, 1, 1)


def test_calculate_and_store_gdd_values_sync_segmented_no_resets():
    session = MagicMock()
    gdd_model = MagicMock()
    session.get.return_value = gdd_model
    session.query().filter().order_by().all.return_value = []
    with pytest.raises(ValueError, match="No resets found for this GDD model"):
        gdd.calculate_and_store_gdd_values_sync_segmented(session, 1, 1)


def test_calculate_and_store_gdd_values_sync_segmented_bulk_save():
    session = MagicMock()
    gdd_model = MagicMock()
    gdd_model.unit.value = "C"
    session.get.return_value = gdd_model
    # Two resets, one segment
    reset1 = MagicMock(reset_date=datetime.date(2024, 1, 1), run_number=1)
    session.query().filter().order_by().all.return_value = [reset1]
    # Weather rows for the segment
    weather_row = MagicMock(
        date=datetime.date(2024, 1, 1),
        temperature_max_c=20,
        temperature_min_c=10,
        type=MagicMock(),
    )
    session.query().filter().order_by().all.side_effect = [[reset1], [weather_row]]
    # Patch get_effective_parameters to return a real base_temp
    with (
        patch("app.utils.gdd.GDDValue") as MockGDDValue,
        patch(
            "app.utils.gdd.get_effective_parameters",
            return_value={
                "base_temp": 10.0,
                "threshold": 100.0,
                "reset_on_threshold": False,
            },
        ),
    ):
        gdd.calculate_and_store_gdd_values_sync_segmented(session, 1, 1)
        assert session.bulk_save_objects.called
        assert session.commit.called


def test_recalculate_historical_gdd_model_not_found():
    session = MagicMock()
    session.get.return_value = None
    with pytest.raises(ValueError, match="GDD model not found"):
        gdd.recalculate_historical_gdd(session, 1, datetime.date(2024, 1, 1))


def test_recalculate_historical_gdd_lawn_not_found():
    session = MagicMock()
    gdd_model = MagicMock()
    gdd_model.lawn_id = 42
    session.get.side_effect = [gdd_model, None]
    with pytest.raises(ValueError, match="Lawn not found for GDD model"):
        gdd.recalculate_historical_gdd(session, 1, datetime.date(2024, 1, 1))


def test_recalculate_historical_gdd_calls_segmented():
    session = MagicMock()
    gdd_model = MagicMock()
    gdd_model.lawn_id = 42
    lawn = MagicMock()
    lawn.location_id = 99
    session.get.side_effect = [gdd_model, lawn]
    with patch(
        "app.utils.gdd.calculate_and_store_gdd_values_sync_segmented"
    ) as mock_segmented:
        gdd.recalculate_historical_gdd(session, 1, datetime.date(2024, 1, 1))
        assert mock_segmented.called


def test_manual_gdd_reset_sync_duplicate_and_future_resets():
    session = MagicMock()
    gdd_model_id = 1
    reset_date = datetime.date(2024, 1, 10)
    # initial_reset is before actual_reset_date
    initial_reset = MagicMock()
    initial_reset.reset_date = datetime.date(2024, 1, 1)
    max_run_mock = MagicMock()
    max_run_mock.run_number = 2
    # Patch .first() to return initial_reset for the first call, max_run_mock for the second
    first_mock = MagicMock(side_effect=[initial_reset, max_run_mock])
    session.query().filter().order_by().first = first_mock
    # No existing reset for this date
    session.query().filter().delete.return_value = 0
    # Simulate future resets
    session.query().filter().delete.return_value = 1
    from app.models.gdd import GDDReset

    mock_reset = MagicMock()
    mock_reset.reset_date = datetime.date(2024, 1, 11)
    # Patch only the constructor for GDDReset
    with patch.object(GDDReset, "__new__", return_value=mock_reset):
        gdd.manual_gdd_reset_sync(session, gdd_model_id, reset_date)
        assert session.add.called
        assert session.commit.called
