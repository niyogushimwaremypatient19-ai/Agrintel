"""
Tests for NISR SAS Excel Workbook Ingestion Tool.
"""

from pathlib import Path
import pytest
import pandas as pd
from pipeline.ingest_sas_excel import parse_sas_excel, create_template_excel, CLEAN_DIR


def test_excel_ingestion_validates_official_tables(tmp_path):
    test_excel = tmp_path / "test_tables_2026.xlsx"
    create_template_excel(test_excel)

    assert test_excel.exists()
    df = parse_sas_excel(test_excel)
    assert len(df) > 0
    assert "observed_yield_kg_per_ha" in df.columns or "yield" in str(df.columns).lower()
    assert "district_code" in df.columns or "district" in str(df.columns).lower()
    assert "season" in df.columns
