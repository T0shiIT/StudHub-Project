from __future__ import annotations

import os
import tempfile
import re
from datetime import datetime, date
from typing import Any, Dict

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile

app = FastAPI(title="StudHub Excel Preview")

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

def _parse_date_string(date_str: str) -> str | None:
    date_str = date_str.strip()
    if re.match(r'\d{2}\.\d{2}\.\d{4}', date_str):
        try:
            dt = datetime.strptime(date_str, '%d.%m.%Y')
            return dt.strftime('%Y-%m-%d')
        except:
            pass
    if re.match(r'\d{4}-\d{2}-\d{2}', date_str):
        return date_str
    try:
        dt = pd.to_datetime(date_str)
        return dt.strftime('%Y-%m-%d')
    except:
        return None

def _parse_date_cell(cell_value: Any) -> str | None:
    if pd.isna(cell_value):
        return None
    if isinstance(cell_value, (datetime, date)):
        return cell_value.strftime("%Y-%m-%d")
    if isinstance(cell_value, (int, float)):
        try:
            dt = pd.Timestamp.fromordinal(int(cell_value) - 693594)
            return dt.strftime("%Y-%m-%d")
        except:
            pass
    if isinstance(cell_value, str):
        return _parse_date_string(cell_value)
    return None

@app.post("/parse")
async def parse_excel(file: UploadFile = File(...)) -> Dict[str, Any]:
    filename = file.filename or ""
    ext = _extract_extension(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported format")

    engine = _engine_for_extension(ext)
    raw_content = await file.read()
    if not raw_content:
        raise HTTPException(status_code=400, detail="File is empty")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(raw_content)
        temp_path = tmp.name

    try:
        df = pd.read_excel(temp_path, engine=engine, header=None, dtype=str)
        df = df.where(pd.notnull(df), None)

        if df.empty or df.shape[1] < 3:
            return {"students": [], "dates": [], "grades": {}}

        headers = df.iloc[0].astype(str).str.strip()
        date_columns = []
        for i in range(3, len(headers)):
            date_val = _parse_date_cell(headers.iloc[i])
            if date_val:
                date_columns.append((i, date_val))

        students = []
        grades = {}
        dates = [date_str for _, date_str in date_columns]

        for idx in range(1, len(df)):
            row = df.iloc[idx]
            full_name = str(row.iloc[1]).strip() if row.iloc[1] else ''
            group = str(row.iloc[2]).strip() if row.iloc[2] else ''
            if not full_name or not group:
                continue

            parts = full_name.split()
            last_name = parts[0] if parts else ''
            first_name = parts[1] if len(parts) > 1 else ''
            student_id = idx
            students.append({
                "id": student_id,
                "firstName": first_name,
                "lastName": last_name,
                "group": group
            })
            grades[student_id] = {}
            for col_idx, date_str in date_columns:
                grade_val = row.iloc[col_idx]
                if grade_val and str(grade_val).strip():
                    try:
                        grade_num = int(float(str(grade_val).strip()))
                        grades[student_id][date_str] = grade_num if 2 <= grade_num <= 5 else None
                    except:
                        grades[student_id][date_str] = None
                else:
                    grades[student_id][date_str] = None

        return {
            "students": students,
            "dates": dates,
            "grades": grades
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Parsing error: {exc}")
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}