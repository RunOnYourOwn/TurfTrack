"""populate products table from CSV

Revision ID: 2a1b2c3d4e5f
Revises: 1cd95e5b04c5
Create Date: 2024-06-18 00:00:00

"""

from alembic import op
import sqlalchemy as sa
import csv
import os
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "2a1b2c3d4e5f"
down_revision = "1cd95e5b04c5"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    products_csv = os.path.join(os.path.dirname(__file__), "../data/products.csv")

    def parse_float(val, default=0.0):
        try:
            return float(str(val).replace("%", "").replace("$", "").strip())
        except (ValueError, TypeError):
            return default

    # Clear existing data
    conn.execute(sa.text("DELETE FROM products"))
    print("Cleared existing products table")

    # Read and insert products
    with open(
        products_csv, "r", encoding="utf-8-sig"
    ) as f:  # Note: utf-8-sig handles BOM
        reader = csv.DictReader(f)
        for row in reader:
            # Get name from the correct column (with or without BOM)
            name = row.get("Product") or row.get("\ufeffProduct")
            if not name:
                print(f"Skipping row with no name: {row}")
                continue

            # Check if product already exists
            existing = conn.execute(
                sa.text("SELECT id FROM products WHERE name = :name"), {"name": name}
            ).fetchone()

            if existing:
                print(f"Skipping existing product: {name}")
                continue

            # Parse numeric values with defaults for required fields
            n_pct = parse_float(row.get("N", "0%"))
            p_pct = parse_float(row.get("P", "0%"))
            k_pct = parse_float(row.get("K", "0%"))
            ca_pct = parse_float(row.get("Ca", "0%"))
            mg_pct = parse_float(row.get("Mg", "0%"))
            s_pct = parse_float(row.get("S", "0%"))
            fe_pct = parse_float(row.get("Fe", "0%"))
            cu_pct = parse_float(row.get("Cu", "0%"))
            mn_pct = parse_float(row.get("Mn", "0%"))
            b_pct = parse_float(row.get("B", "0%"))
            zn_pct = parse_float(row.get("Zn", "0%"))
            weight_lbs = parse_float(row.get("Weight in lbs"), None)  # Optional field
            cost_per_bag = parse_float(row.get("Cost / Bag"), None)  # Optional field

            # Insert new product
            conn.execute(
                sa.text("""
                    INSERT INTO products (
                        name, n_pct, p_pct, k_pct, ca_pct, mg_pct, s_pct,
                        fe_pct, cu_pct, mn_pct, b_pct, zn_pct, weight_lbs,
                        cost_per_bag, sgn, product_link, label,
                        sources, urea_nitrogen, ammoniacal_nitrogen,
                        water_insol_nitrogen, other_water_soluble,
                        slowly_available_from, created_at, updated_at
                    ) VALUES (
                        :name, :n_pct, :p_pct, :k_pct, :ca_pct, :mg_pct, :s_pct,
                        :fe_pct, :cu_pct, :mn_pct, :b_pct, :zn_pct, :weight_lbs,
                        :cost_per_bag, :sgn, :product_link, :label,
                        :sources, :urea_nitrogen, :ammoniacal_nitrogen,
                        :water_insol_nitrogen, :other_water_soluble,
                        :slowly_available_from, :created_at, :updated_at
                    )
                """),
                {
                    "name": name,
                    "n_pct": n_pct,
                    "p_pct": p_pct,
                    "k_pct": k_pct,
                    "ca_pct": ca_pct,
                    "mg_pct": mg_pct,
                    "s_pct": s_pct,
                    "fe_pct": fe_pct,
                    "cu_pct": cu_pct,
                    "mn_pct": mn_pct,
                    "b_pct": b_pct,
                    "zn_pct": zn_pct,
                    "weight_lbs": weight_lbs,
                    "cost_per_bag": cost_per_bag,
                    "sgn": row.get("SGN"),
                    "product_link": row.get("Product Link"),
                    "label": row.get("Label"),
                    "sources": row.get("Sources"),
                    "urea_nitrogen": parse_float(row.get("Urea Nitrogen"), None),
                    "ammoniacal_nitrogen": parse_float(
                        row.get("Ammoniacal Nitrogen"), None
                    ),
                    "water_insol_nitrogen": parse_float(
                        row.get("Water Insoluble Nitrogen"), None
                    ),
                    "other_water_soluble": parse_float(
                        row.get("Other water Soluble"), None
                    ),
                    "slowly_available_from": row.get("Slowly Available From"),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                },
            )
            print(f"Inserted product: {name}")


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM products"))
