import sys
from pathlib import Path

import pandas as pd
import pytest

PIPELINE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_DIR))

from prepare_tangabid_prices import map_crop, month_bounds  # noqa: E402
import pandas as pd  # noqa: E402


@pytest.mark.parametrize("product, crop", [
    ("Maize", "MAIZE"),
    ("Maize Flour", None),
    ("Maize-flour-imported", None),
    ("Maize Bran", None),
    ("Bean Shyushya", "BEAN"),
    ("Bean - Mugeri", "BEAN"),
    ("Green bean", None),
    ("Fresh bean", None),
    ("Rice Pakistan", "RICE"),
    ("RICE - luck Kema", "RICE"),
    ("Cassava", "CASSAVA"),
    ("Cassava-flour", None),
    ("Cassava leaves", None),
    ("Sweet-Potatoes", "SWEET_POTATO"),
    ("Irish potato - Kinigi Grade 1", "IRISH_POTATO"),
    ("Irish-potato", "IRISH_POTATO"),
    ("Tomatos", "TOMATO"),
    ("White onion", "ONION"),
    ("Banan-fruit", "BANANA"),
    ("Beer-banana", None),
    ("Sorghum flour", None),
    ("Sorghum", "SORGHUM"),
    ("Wheat-Flour", None),
    ("Wheat", "WHEAT"),
    ("Soya-Bean", "SOYA"),
    ("Groundnut", "GROUNDNUT"),
    ("Beef/Iroti", None),
    ("Fish - Tilapia", None),
])
def test_product_mapping(product, crop):
    assert map_crop(product) == crop


def test_month_bounds_handles_february_2028():
    assert month_bounds(pd.Period("2028-02", "M")) == ("2028-02-01", "2028-02-29")
