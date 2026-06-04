from __future__ import annotations

import os
import tempfile
import re
from datetime import datetime, date, time
from typing import Any, List, Dict

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from openpyxl import load_workbook

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


def _parse_date_cell(cell_value: Any) -> str | None:
    """Преобразует значение ячейки (заголовок даты) в строку YYYY-MM-DD."""
    if pd.isna(cell_value):
        return None
    # Попытка преобразовать в datetime
    try:
        if isinstance(cell_value, (datetime, date)):
            return cell_value.strftime("%Y-%m-%d")
        if isinstance(cell_value, (int, float)):
            # Excel serial date
            dt = pd.Timestamp.fromordinal(int(cell_value) - 693594)
            return dt.strftime("%Y-%m-%d")
        # Пробуем распарсить строку
        dt = pd.to_datetime(cell_value)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        # Если не получилось, возвращаем как есть (строка)
        return str(cell_value).strip()


def _parse_wide_format(df: pd.DataFrame, subject: str | None = None) -> List[Dict[str, Any]]:
    """
    Парсит DataFrame в широком формате:
    - Первая строка — заголовки: 0:№, 1:Фамилия Имя, 2:Группа, далее даты.
    - Возвращает список записей {student_name, student_group, date, grade, subject}.
    """
    if df.empty or df.shape[1] < 3:
        return []

    # Определяем заголовки (первая строка)
    headers = df.iloc[0].astype(str).str.strip()
    # Столбцы дат начинаются с индекса 3 (после №, ФИО, Группа)
    date_columns = headers.index[3:]

    records = []
    # Проходим по строкам начиная со второй (индекс 1)
    for idx in range(1, len(df)):
        row = df.iloc[idx]
        # Проверяем, что ФИО и группа не пусты
        student_name = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
        student_group = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ''
        if not student_name or not student_group:
            continue

        for col_idx in date_columns:
            date_header = headers[col_idx]
            date_str = _parse_date_cell(date_header)
            if not date_str:
                # Если заголовок не дата, пропускаем столбец
                continue

            grade_cell = row.iloc[col_idx]
            if pd.isna(grade_cell):
                continue
            grade_value = str(grade_cell).strip()
            if grade_value == '':
                continue

            records.append({
                "student_name": student_name,
                "student_group": student_group,
                "date": date_str,
                "grade": grade_value,
                "subject": subject or ""  # если subject не передан, пустая строка
            })

    return records


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/parse")
async def parse_schedule(
    file: UploadFile = File(...),
    subject: str = Query(None, description="Название предмета (опционально)")
) -> Dict[str, Any]:
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
        # Читаем весь файл, первую строку как заголовок
        df = pd.read_excel(temp_path, engine=engine, header=0, dtype=str)
        # Заполняем NaN на None
        df = df.where(pd.notnull(df), None)

        records = _parse_wide_format(df, subject)

        # Формируем ответ в структуре, совместимой с бэкендом (ожидает sheets[0].records)
        return {
            "fileName": filename,
            "extension": ext,
            "sheetsCount": 1,
            "sheets": [
                {
                    "sheetName": "Sheet1",  # можно определить из openpyxl, но для простоты
                    "records": records,
                    "rowsCount": len(df),
                    "columnsCount": len(df.columns)
                }
            ]
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse spreadsheet: {exc}")
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass