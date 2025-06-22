import pytest
from pydantic import ValidationError
from app.schemas.product import ProductBase, ProductUpdate


class TestProductBase:
    """Test ProductBase schema validation."""

    def test_valid_product_creation(self):
        """Test creating a product with valid data."""
        data = {
            "name": "Test Product",
            "n_pct": 10.0,
            "p_pct": 5.0,
            "k_pct": 15.0,
            "weight_lbs": 50.0,
            "cost_per_bag": 25.0,
        }
        product = ProductBase(**data)
        assert product.name == "Test Product"
        assert product.n_pct == 10.0
        assert product.weight_lbs == 50.0

    def test_minimal_product_creation(self):
        """Test creating a product with minimal required data."""
        data = {"name": "Minimal Product"}
        product = ProductBase(**data)
        assert product.name == "Minimal Product"
        assert product.n_pct == 0.0  # Default value
        assert product.weight_lbs is None

    def test_percentage_validation_valid(self):
        """Test percentage validation with valid values."""
        valid_percentages = [0.0, 50.0, 100.0, None]
        for pct in valid_percentages:
            data = {"name": "Test", "n_pct": pct}
            product = ProductBase(**data)
            assert product.n_pct == pct

    def test_percentage_validation_invalid_negative(self):
        """Test percentage validation with negative values."""
        invalid_percentages = [-1.0, -10.0, -100.0]
        for pct in invalid_percentages:
            with pytest.raises(
                ValidationError, match="Nutrient percentages must be between 0 and 100"
            ):
                ProductBase(name="Test", n_pct=pct)

    def test_percentage_validation_invalid_above_100(self):
        """Test percentage validation with values above 100."""
        invalid_percentages = [101.0, 150.0, 200.0]
        for pct in invalid_percentages:
            with pytest.raises(
                ValidationError, match="Nutrient percentages must be between 0 and 100"
            ):
                ProductBase(name="Test", n_pct=pct)

    def test_all_percentage_fields_validation(self):
        """Test validation for all percentage fields."""
        percentage_fields = [
            "n_pct",
            "p_pct",
            "k_pct",
            "ca_pct",
            "mg_pct",
            "s_pct",
            "fe_pct",
            "cu_pct",
            "mn_pct",
            "b_pct",
            "zn_pct",
        ]

        for field in percentage_fields:
            # Test invalid value
            with pytest.raises(
                ValidationError, match="Nutrient percentages must be between 0 and 100"
            ):
                ProductBase(name="Test", **{field: 101.0})

            # Test valid value
            data = {"name": "Test", field: 50.0}
            product = ProductBase(**data)
            assert getattr(product, field) == 50.0

    def test_positive_number_validation_valid(self):
        """Test positive number validation with valid values."""
        valid_values = [0.1, 1.0, 10.0, 100.0]
        for value in valid_values:
            data = {"name": "Test", "weight_lbs": value}
            product = ProductBase(**data)
            assert product.weight_lbs == value

    def test_positive_number_validation_invalid_zero(self):
        """Test positive number validation with zero."""
        with pytest.raises(
            ValidationError, match="Weight and cost must be positive numbers"
        ):
            ProductBase(name="Test", weight_lbs=0.0)

    def test_positive_number_validation_invalid_negative(self):
        """Test positive number validation with negative values."""
        invalid_values = [-1.0, -10.0, -100.0]
        for value in invalid_values:
            with pytest.raises(
                ValidationError, match="Weight and cost must be positive numbers"
            ):
                ProductBase(name="Test", weight_lbs=value)

    def test_weight_and_cost_validation(self):
        """Test validation for both weight_lbs and cost_per_bag."""
        # Test both fields with invalid values
        with pytest.raises(
            ValidationError, match="Weight and cost must be positive numbers"
        ):
            ProductBase(name="Test", weight_lbs=-10.0, cost_per_bag=0.0)

        # Test valid values
        data = {"name": "Test", "weight_lbs": 50.0, "cost_per_bag": 25.0}
        product = ProductBase(**data)
        assert product.weight_lbs == 50.0
        assert product.cost_per_bag == 25.0

    def test_none_values_allowed(self):
        """Test that None values are allowed for optional fields."""
        data = {
            "name": "Test Product",
            "n_pct": None,
            "weight_lbs": None,
            "cost_per_bag": None,
        }
        product = ProductBase(**data)
        assert product.n_pct is None
        assert product.weight_lbs is None
        assert product.cost_per_bag is None


class TestProductUpdate:
    """Test ProductUpdate schema validation."""

    def test_partial_update_valid(self):
        """Test partial update with valid data."""
        data = {"name": "Updated Product", "n_pct": 15.0}
        product = ProductUpdate(**data)
        assert product.name == "Updated Product"
        assert product.n_pct == 15.0
        assert product.p_pct is None  # Not provided

    def test_update_percentage_validation(self):
        """Test percentage validation in updates."""
        # Test invalid percentage
        with pytest.raises(
            ValidationError, match="Nutrient percentages must be between 0 and 100"
        ):
            ProductUpdate(name="Test", n_pct=101.0)

        # Test valid percentage
        product = ProductUpdate(name="Test", n_pct=50.0)
        assert product.n_pct == 50.0

    def test_update_positive_number_validation(self):
        """Test positive number validation in updates."""
        # Test invalid values
        with pytest.raises(
            ValidationError, match="Weight and cost must be positive numbers"
        ):
            ProductUpdate(name="Test", weight_lbs=-10.0)

        with pytest.raises(
            ValidationError, match="Weight and cost must be positive numbers"
        ):
            ProductUpdate(name="Test", cost_per_bag=0.0)

        # Test valid values
        product = ProductUpdate(name="Test", weight_lbs=25.0, cost_per_bag=15.0)
        assert product.weight_lbs == 25.0
        assert product.cost_per_bag == 15.0

    def test_update_with_none_values(self):
        """Test that None values are allowed in updates."""
        data = {"name": "Test", "n_pct": None, "weight_lbs": None}
        product = ProductUpdate(**data)
        assert product.name == "Test"
        assert product.n_pct is None
        assert product.weight_lbs is None

    def test_empty_update(self):
        """Test creating an update with no fields."""
        product = ProductUpdate()
        assert product.name is None
        assert product.n_pct is None
        assert product.weight_lbs is None
