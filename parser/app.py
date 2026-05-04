from __future__ import annotations

import os
import tempfile
import re
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile

app = FastAPI(title="StudHub Schedule Parser")

ALLOWED_EXTENSIONS = {".xlsx", ".xlsm", ".xlsb", ".xls"}


def _extract_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


def _engine_for_extension(ext: str) -> str:
    if ext in {".xlsx", ".xlsm"}:
        return "openpyxl"
    if ext == ".xlsb":
        return "pyxlsb"
    if ext == ".xls":
        return "xlrd"
    raise ValueError("Unsupported extension")


def _normalize_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def _column_label(index: int) -> str:
    label = ""
    n = index + 1
    while n > 0:
        n, rem = divmod(n - 1, 26)
        label = chr(65 + rem) + label
    return label


def _slug(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[^a-zа-я0-9_]+", "", text)
    return text


def _records_from_frame(frame: pd.DataFrame) -> list[dict[str, Any]]:
    if frame.empty:
        return []

    cleaned = frame.dropna(axis=0, how="all").dropna(axis=1, how="all")
    if cleaned.empty:
        return []

    header_row_idx = None
    best_score = -1
    for idx, row in cleaned.iterrows():
        score = sum(
            1
            for value in row.values
            if value is not None and str(value).strip() != ""
        )
        if score > best_score:
            best_score = score
            header_row_idx = idx

    if header_row_idx is None:
        return []

    header_values = [
        _normalize_value(v) for v in cleaned.loc[header_row_idx].values
    ]
    header_names: list[str] = []
    for pos, value in enumerate(header_values):
        if value is None:
            header_names.append(f"column_{pos + 1}")
        else:
            normalized = _slug(str(value))
            header_names.append(normalized if normalized else f"column_{pos + 1}")

    data_rows = cleaned.loc[cleaned.index > header_row_idx]
    records: list[dict[str, Any]] = []
    for _, row in data_rows.iterrows():
        record = {
            header_names[pos]: _normalize_value(value)
            for pos, value in enumerate(row.values)
        }
        if any(value is not None and str(value).strip() != "" for value in record.values()):
            records.append(record)
    return records


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse")
async def parse_schedule(file: UploadFile = File(...)) -> dict[str, Any]:
    filename = file.filename or ""
    ext = _extract_extension(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Supported formats: .xlsx, .xlsm, .xlsb, .xls")

    engine = _engine_for_extension(ext)
    raw_content = await file.read()

    if not raw_content:
        raise HTTPException(status_code=400, detail="File is empty")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(raw_content)
        temp_path = tmp.name

    try:
        workbook = pd.ExcelFile(temp_path, engine=engine)
        sheets: list[dict[str, Any]] = []

        for sheet_name in workbook.sheet_names:
            frame = pd.read_excel(workbook, sheet_name=sheet_name, engine=engine, header=None)
            frame = frame.where(pd.notnull(frame), None)

            columns_count = int(frame.shape[1]) if not frame.empty else 0
            rows_payload = []
            for row_idx, row in frame.iterrows():
                cells = []
                for col_idx in range(columns_count):
                    value = _normalize_value(row.iloc[col_idx])
                    if value is None:
                        continue
                    cells.append(
                        {
                            "columnIndex": col_idx,
                            "columnName": _column_label(col_idx),
                            "value": value,
                        }
                    )

                rows_payload.append(
                    {
                        "rowIndex": int(row_idx),
                        "cells": cells,
                    }
                )

            records = _records_from_frame(frame)

            sheets.append(
                {
                    "sheetName": sheet_name,
                    "rowsCount": int(frame.shape[0]),
                    "columnsCount": columns_count,
                    "rows": rows_payload,
                    "records": records,
                }
            )

        return {
            "fileName": filename,
            "extension": ext,
            "sheetsCount": len(sheets),
            "sheets": sheets,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse spreadsheet: {exc}") from exc
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
