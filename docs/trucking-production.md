# Trucking production

Admin-only from Dashboard → Trucking production. Apply migration `014_trucking_production.sql` before deploying. The page and every server action require the admin role; the database tables and security-invoker reporting views also enforce it.

## How the web version maps to the workbook

- Create a day when it was actually worked. The monthly summary counts only recorded days and shows gross, goal, variance, attainment and cumulative results. Saturday starts with a zero goal, but the goal can be edited.
- Enter truck, equipment, driver, loads and material/customer quantities. The daily rates start at $10.50 Ashgrove, $12.00 GP/ASG R.M., and $5.95 Alumina/Silica per ton. Other charges or credits are entered as an adjustment; a gross override replaces the formula. Driver pay is optional and is not calculated by or synced to Payroll.
- A driver hauling Alumina or Silica has an eight-load target; otherwise a driver hauling Ashgrove or GP has a five-load target. Other entries have no load target. Missing loads are not cancelled out by other trucks exceeding their targets.

## Load the existing October history

The source file is not included or exposed by the app. Run locally with Python and `openpyxl`:

```sh
python scripts/import-trucking-production.py "/path/to/OCTOBER TRUCKING PRODUCTION 3.xlsx"
python scripts/import-trucking-production.py "/path/to/OCTOBER TRUCKING PRODUCTION 3.xlsx" --sql /path/outside/repo/october-production.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /path/outside/repo/october-production.sql
```

Review the target database before executing. The import is atomic and refuses to overwrite a day that already exists. Treat the generated SQL as private operational data. It includes only the 23 worked days in `Revenue Report` (not the four blank early-October tabs). It cross-checks the report gross for each day, imports cached gross overrides where the new calculation differs, and keeps values like `8HR` in work notes, not in the numeric load count. Expected workbook totals for October 2026: **$358,822.66 gross**, **$431,338.00 goal**, **−$72,515.34 variance**.

Run the calculation and permission checks against a local migrated database:

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/trucking_production.sql
```
