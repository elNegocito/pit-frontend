# Roll-off dispatch

Admin-only from Dashboard → Roll-off dispatch. Apply migration `015_roll_off_dispatch.sql` before deploying. The board, order and ticket pages, and actions check the admin role. The database also enforces admin-only access on the tables and reporting views.

1. Set up containers, drivers and trucks under **Inventory and catalogs**. These assets are separate from PIT and Payroll. The reviewed workbook is a blank template, so no example records are loaded.
2. Create a uniquely numbered work order and choose Delivery, Pick Up, Swap Out or Relocation. Assign a truck and driver before marking dispatch **Assigned** or **En route**. Set an optional scheduled date for the dispatch board.
3. Enter the actual delivery date and contracted days to calculate pickup due. The board marks orders due today or overdue using the America/Chicago business date. Orders delivered without a rental duration show **No pickup date**, rather than a false overdue warning.
4. Record actual pickup on the open order to complete rental tracking and release its container. A container can belong to only one open order; before delivery it is **Reserved**, after delivery **On site**. For a standalone service use a new order only if the container is not already on another open order. Cancel an order to exclude it from pickup alerts and release its reservation.
5. Open **Printable ticket** to print or save as PDF from the browser. The ticket includes the job information, assignment, instructions, and signature lines. Internal notes stay on the work order.

The dispatch status and rental tracking status are separate: a completed delivery can still have a pickup due. The workbook does not define multi-container swaps or automated notifications; this module tracks one container per order and shows operational alerts in the board.

Run the tracking, inventory, and permission checks against a local migrated database:

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/roll_off_dispatch.sql
```
