"""Inspect the reviewed workbook or write a transactional historical import (openpyxl required)."""

import argparse
from datetime import datetime
from decimal import Decimal
import json
from pathlib import Path

from openpyxl import load_workbook


D = Decimal


def number(value):
    if value is None or value == "":
        return D(0)
    return D(str(value))


def clean(value):
    return "" if value is None else str(value).strip()


def read_workbook(path):
    workbook = load_workbook(path, data_only=True, read_only=True)
    report = workbook["Revenue Report"]
    days, entries = [], []
    for cells in report.iter_rows(min_row=10, max_col=3, values_only=True):
        date, reported_gross, target = cells
        if not isinstance(date, datetime):
            continue  # only dates included in the workbook's actual revenue report
        sheet = workbook[f"{date.month}-{date.day}"]
        a_rate, gp_rate, shale_rate = map(number, next(sheet.iter_rows(min_row=2, max_row=2, min_col=15, max_col=17, values_only=True)))
        day = dict(work_date=date.date().isoformat(), revenue_goal=number(target),
                   ashgrove_rate=a_rate, gp_rate=gp_rate, shale_rate=shale_rate)
        days.append(day)
        total = D(0)
        for row in sheet.iter_rows(min_row=2, max_row=34, max_col=18, values_only=True):
            truck, equipment, driver, loads, ash, alum, silica, other, gp, excavation, cust_tons, cust_loads, gross, pay, _, _, _, _ = row
            if not clean(truck):
                if any(value not in (None, "", 0) for value in row[2:14]):
                    raise ValueError(f"{sheet.title}: activity found without a truck")
                continue
            if gross is None:
                raise ValueError(f"{sheet.title}: save the workbook from Excel to cache gross values first")
            manual_gross = number(gross).quantize(D("0.000001"))
            total += manual_gross
            if not manual_gross and not any(value not in (None, "", 0) for value in (*row[3:12], pay)):
                continue  # inactive template row
            calculated = number(ash)*a_rate + number(gp)*gp_rate + (number(alum)+number(silica))*shale_rate
            entries.append(dict(
                work_date=day["work_date"], truck=clean(truck), equipment=clean(equipment), driver=clean(driver),
                loads=int(loads) if isinstance(loads, int) or clean(loads).isdigit() else 0,
                work_notes=clean(loads) if isinstance(loads, str) and not loads.strip().isdigit() else "",
                ashgrove_tons=number(ash), alumina_tons=number(alum), silica_tons=number(silica), gp_tons=number(gp),
                other_material=clean(sheet["H1"].value) if other else "", other_quantity=number(other),
                excavation=clean(excavation), customer_tons=number(cust_tons), customer_loads=int(number(cust_loads)),
                adjustment=D(0), gross_override=manual_gross if manual_gross != calculated else None,
                driver_pay=number(pay) if pay is not None else None,
            ))
        if abs(total - number(reported_gross)) > D("0.00001"):
            raise ValueError(f"{sheet.title}: row total {total} differs from report {reported_gross}")
    if not days:
        raise ValueError("No worked dates found in Revenue Report")
    return days, entries


def insert(table, rows):
    if not rows:
        return ""
    columns = ", ".join(rows[0])
    # JSON numbers are converted by PostgreSQL directly to the target numeric types.
    payload = json.dumps(rows, default=str, ensure_ascii=False).replace("'", "''")
    return (f"INSERT INTO public.{table} ({columns}) SELECT {columns} FROM "
            f"jsonb_populate_recordset(NULL::public.{table}, '{payload}'::jsonb);\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--sql", type=Path, help="Write SQL to a new local file; does not connect to a database")
    args = parser.parse_args()
    days, entries = read_workbook(args.workbook)
    print(f"{len(days)} worked days; {len(entries)} truck entries; "
          f"{sum(row['gross_override'] is not None for row in entries)} historical gross overrides.")
    if args.sql:
        with args.sql.open("x", encoding="utf-8") as file:
            file.write("BEGIN;\nSET LOCAL standard_conforming_strings = on;\n")
            file.write(insert("trucking_production_days", days))
            file.write(insert("trucking_production_entries", entries))
            file.write("COMMIT;\n")


if __name__ == "__main__":
    main()
