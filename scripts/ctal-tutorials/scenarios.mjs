// What each tutorial video shows. `steps` are the captions (and chapters);
// `run` performs them. Selectors follow the CTAL screens: when a screen
// changes, fix its scenario and record that video again.
import { pdfCard } from "./lib.mjs";

const grid = (row, col) => `[data-row="${row}"][data-col="${col}"]`;
const lastRow = (a) => a.page.locator("table tbody tr").count().then((n) => n - 1);

export const SCENARIOS = [
  {
    slug: "overview",
    title: "A tour of CTAL",
    summary: "What the overview shows, how to find any carrier, ticket or week from one search box, and how to move between sections.",
    href: "/ctal",
    hrefLabel: "Open the overview",
    start: "/ctal",
    steps: ["This week at a glance", "Insurance to follow up", "Find a carrier by name, number or owner", "Find a ticket number", "Move between sections"],
    async run(a, s) {
      await a.step(s[0]);
      await a.look("h1", 700);
      for (const t of ["Pay to carriers", "Billing", "Profit with FSC"]) await a.look(`dt:has-text("${t}") + dd`, 800);
      await a.step(s[1]);
      await a.look("#ins-h", 600);
      for (const i of [0, 1, 2]) await a.look(a.page.locator('section[aria-labelledby="ins-h"] li').nth(i), 650, { dx: 0.8 });
      await a.step(s[2]);
      await a.click('input[aria-label="Search CTAL"]');
      await a.type("blue");
      await a.sleep(1300);
      await a.key("Control+A", 100);
      await a.type("3005");
      await a.sleep(1300);
      await a.step(s[3]);
      await a.key("Control+A", 100);
      await a.type("5104");
      await a.sleep(1400);
      await a.click(a.page.locator('a[href*="?ticket="]').first());
      await a.settle(1800);
      await a.step(s[4]);
      for (const tab of ["Carriers", "Customers", "Weeks", "Tutorials", "Overview"]) {
        await a.click(`nav[aria-label="CTAL sections"] >> text="${tab}"`);
        await a.settle(900);
      }
    },
  },
  {
    slug: "carriers",
    title: "Carriers",
    summary: "The carrier list, instant search and filters, adding a carrier by hand, and bringing the whole Google Sheet in at once.",
    href: "/ctal/carriers",
    hrefLabel: "Open carriers",
    start: "/ctal/carriers",
    steps: ["All your carriers in one list", "Search as you type", "Filter by insurance or pay term", "Add a carrier", "Import the Google Sheet"],
    async run(a, s) {
      await a.step(s[0]);
      await a.look("tbody tr:nth-child(2) td:nth-child(2)", 700);
      await a.look("tbody tr:nth-child(5) td:nth-child(7)", 900);
      await a.step(s[1]);
      await a.click('input[aria-label="Search carriers"]');
      await a.type("arling");
      await a.sleep(1200);
      await a.key("Control+A", 100);
      await a.type("555) 010-1005");
      await a.sleep(1300);
      await a.key("Control+A", 100);
      await a.key("Backspace", 500);
      await a.step(s[2]);
      await a.click('button:has-text("Insurance expired")');
      await a.sleep(1100);
      await a.click('button:has-text("Expiring in 30 days")');
      await a.sleep(1100);
      await a.click('button:has-text("28 days")');
      await a.sleep(1000);
      await a.click('button:has-text("28 days")');
      await a.step(s[3]);
      await a.click('a:has-text("Add carrier")');
      await a.settle(500);
      await a.fill('input[name="name"]', "Red River Transport");
      await a.fill('input[name="dispatch_contact"]', "Carla (555) 010-1020", { fast: true });
      await a.fill('input[name="owner"]', "Carla (555) 010-1020", { fast: true });
      await a.fill('input[name="equipment"]', "Carla 88 Round Bottom", { fast: true });
      await a.date('input[name="ins_exp"]', "06302027");
      await a.fill('input[name="usdot"]', "3101088", { fast: true });
      await a.click('input[name="hub_city"]');
      await a.type("Al");
      await a.sleep(700);
      await a.key("Enter");
      await a.fill('input[name="email"]', "carla@redriver.example.com", { fast: true });
      await a.click('button:has-text("Add carrier")');
      await a.settle(1800);
      await a.step(s[4]);
      await a.click('nav[aria-label="CTAL sections"] >> text="Carriers"');
      await a.settle(500);
      await a.click('a:has-text("Import from Google Sheets")');
      await a.settle(500);
      await a.click("textarea");
      // Pasting lands all at once.
      await a.page.fill(
        "textarea",
        [
          "Column 1\tCarrier Name\tPAY TERM\tDispatch Contact\tOwner\tDriver, Truck , Equipment\tINS EXP\tHUB CITY\tUSDOT #",
          "3011\tCaprock Haulers\tQP\tNico (555) 010-1031\tNico (555) 010-1031\tNico 12 Round Bottom\t3/14/2027\tGodley\t3101112",
          "3012\tPecan Valley Trucking\t28\tIris (555) 010-1032\tIris (555) 010-1032\tSamuel 77 Belly\t1/9/2027\tRio Vista\t3101277",
          "3013\tSandstone Express\tQP\tHugo (555) 010-1033\tHugo (555) 010-1033\tHugo 5 Aluminum\tCONTACTED\tItasca\t3101305",
          "\tNorthside Hauling\tQP\t\t\t\t\t\t",
        ].join("\n"),
      );
      await a.sleep(1500);
      await a.look("tbody tr:nth-child(2) td:nth-child(2)", 800);
      await a.look("tbody tr:nth-child(4) td:nth-child(2)", 1100);
      await a.click('button:has-text("Import 3 carriers")');
      await a.sleep(1800);
      await a.click('a:has-text("See the carriers")');
      await a.settle(900);
      await a.scrollBy(260);
      await a.look("tbody tr:last-child td:nth-child(2)", 1300);
    },
  },
  {
    slug: "documents",
    title: "Carrier documents",
    summary: "Keeping each carrier's insurance, contract and CDL as PDF or photos, opening them on screen, and saving the link to its tickets folder.",
    href: "/ctal/carriers",
    hrefLabel: "Open carriers",
    start: "/ctal/carriers",
    steps: ["Open the carrier", "Add the insurance and the CDL", "Read a document on screen", "Update the insurance date and the tickets link", "Remove an outdated file"],
    async run(a, s, ctx) {
      await a.step(s[0]);
      await a.click('a:has-text("THREE FORKS CARRIERS")');
      await a.settle(900);
      await a.step(s[1]);
      await a.look('button:has-text("Choose files")', 700);
      // The system file picker is not part of the page: the files simply arrive, as when dropped.
      await a.page.setInputFiles('#documents input[type="file"]', [ctx.files.insurance, ctx.files.cdl]);
      await a.sleep(1300);
      const expires = a.page.locator('#documents input[type="date"]').first();
      await a.date(expires, "11102027");
      await a.sleep(500);
      await a.click('button:has-text("Upload 2 files")');
      await a.page.locator("#documents ul li").nth(1).waitFor();
      await a.sleep(1500);
      await a.step(s[2]);
      await a.click('#documents ul li button:has-text("Insurance")');
      await a.sleep(3600);
      await a.click('button:has-text("Close")');
      await a.click('#documents ul li button:has-text("CDL")');
      await a.sleep(2600);
      await a.click('button:has-text("Close")');
      await a.step(s[3]);
      await a.date('input[name="ins_exp"]', "11102027");
      await a.fill('input[name="tickets_url"]', "https://tickets.example.com/three-forks", { fast: true });
      await a.click('button:has-text("Save changes")');
      await a.sleep(1500);
      await a.page.mouse.wheel(0, -2000);
      await a.sleep(700);
      await a.look('a:has-text("Open tickets folder")', 1500);
      await a.step(s[4]);
      await a.click(a.page.locator("#documents ul li").filter({ hasText: "CDL" }).locator('button:has-text("Delete")'));
      await a.sleep(1800);
    },
  },
  {
    slug: "customers",
    title: "Customers and their rules",
    summary: "Each customer keeps the rules of its job: unit, rates, quick pay or broker fee, FSC, and the company that bills it.",
    href: "/ctal/customers",
    hrefLabel: "Open customers",
    start: "/ctal/customers",
    steps: ["Every job has its own rules", "Quick pay or broker fee", "FSC as a percentage or a fixed amount", "Add a customer", "Change a rate"],
    async run(a, s) {
      const row = (name) => a.page.locator("form").filter({ has: a.page.locator(`input[name="name"][value="${name}"]`) });
      await a.step(s[0]);
      const silica = row("BLUE RIDGE CEMENT / SILICA");
      await a.look(silica.locator('input[name="name"]'), 700);
      await a.look(silica.locator('select[name="default_unit"]'), 600);
      await a.look(silica.locator('input[name="broker_rate"]'), 600);
      await a.look(silica.locator('input[name="carrier_rate"]'), 800);
      await a.step(s[1]);
      await a.look(silica.locator('select[name="fee_kind"]'), 800);
      await a.look(silica.locator('input[name="fee_pct"]'), 800);
      const iron = row("IRONGATE PLANT");
      await a.look(iron.locator('select[name="fee_kind"]'), 900);
      await a.look(iron.locator('input[name="fee_pct"]'), 900);
      await a.step(s[2]);
      await a.look(iron.locator('select[name="fsc_mode"]'), 800);
      await a.look(iron.locator('input[name="fsc_value"]'), 900);
      const mix = row("ASG READY MIX");
      await a.look(mix.locator('select[name="fsc_mode"]'), 800);
      await a.look(mix.locator('select[name="bill_to"]'), 1000);
      await a.step(s[3]);
      await a.page.mouse.wheel(0, -2000);
      const form = a.page.locator("form").first();
      await a.fill(form.locator('input[name="name"]'), "Lone Star Aggregates");
      await a.fill(form.locator('input[name="broker_rate"]'), "14.50");
      await a.fill(form.locator('input[name="carrier_rate"]'), "12.75");
      await a.choose(form.locator('select[name="fsc_mode"]'), "percent");
      await a.fill(form.locator('input[name="fsc_value"]'), "10");
      await a.click(form.locator('button:has-text("Add customer")'));
      await a.sleep(1500);
      await a.step(s[4]);
      const star = row("LONE STAR AGGREGATES");
      await a.fill(star.locator('input[name="carrier_rate"]'), "13");
      await a.click(star.locator('button:has-text("Save changes")'));
      await a.sleep(900);
      await a.look(star.locator('p[role="status"]'), 1700, { dx: 0.05 });
    },
  },
  {
    slug: "weekly-log",
    title: "The weekly log",
    summary: "Starting a week and typing the invoices in: suggestions as you type, rates filled in by themselves, Enter for the next load, repeated tickets flagged, and totals that update live.",
    href: "/ctal/weeks",
    hrefLabel: "Open weeks",
    start: "/ctal/weeks",
    steps: [
      "Start the week",
      "Type the first load",
      "Enter starts the next load",
      "Another carrier and another job",
      "A repeated ticket is flagged",
      "Delete a row and undo it",
      "Totals for one carrier",
      "It saves by itself",
    ],
    async run(a, s) {
      await a.step(s[0]);
      await a.look('input[name="day"]', 900);
      await a.click('button:has-text("Start week")');
      await a.page.waitForURL(/\/ctal\/weeks\/[0-9a-f-]{36}$/);
      await a.settle(900);
      await a.step(s[1]);
      await a.click(grid(0, 1));
      await a.type("nor");
      await a.sleep(900);
      await a.key("Enter", 900);
      await a.look(grid(0, 2), 500);
      await a.look(grid(0, 3), 800);
      await a.click(grid(0, 4));
      await a.type("sil");
      await a.sleep(900);
      await a.key("Enter", 700);
      await a.look(grid(0, 9), 1100);
      await a.click(grid(0, 5));
      await a.type("61001");
      await a.key("Tab", 250);
      await a.type("25.4");
      await a.sleep(900);
      await a.step(s[2]);
      await a.key("Enter", 900);
      await a.type("61002");
      await a.key("Tab", 250);
      await a.type("24.85");
      await a.key("Enter", 800);
      await a.type("61003");
      await a.key("Tab", 250);
      await a.type("25.1");
      await a.sleep(800);
      await a.step(s[3]);
      await a.key("Enter", 800);
      await a.click(grid(3, 1));
      await a.type("river");
      await a.sleep(900);
      await a.key("Enter", 900);
      await a.click(grid(3, 4));
      await a.type("iron");
      await a.sleep(900);
      await a.key("Enter", 900);
      await a.look(grid(3, 10), 1100);
      await a.look(grid(3, 11), 1100);
      await a.click(grid(3, 5));
      await a.type("88900");
      await a.key("Tab", 250);
      await a.type("26.3");
      await a.sleep(700);
      await a.step(s[4]);
      await a.key("Enter", 800);
      await a.type("88900");
      await a.sleep(1700);
      await a.key("Control+A", 150);
      await a.type("88911");
      await a.key("Tab", 250);
      await a.type("27");
      await a.sleep(800);
      await a.step(s[5]);
      await a.click(a.page.locator("table tbody tr").nth(await lastRow(a)).locator('button[title="Delete row"]'));
      await a.sleep(1100);
      await a.click('button:has-text("Undo")');
      await a.sleep(1100);
      await a.step(s[6]);
      await a.click('button[aria-pressed]:has-text("NORTHSIDE HAULING")');
      await a.sleep(700);
      await a.look('dl >> text="Pay to carriers"', 1700);
      await a.click('button[aria-pressed]:has-text("NORTHSIDE HAULING")');
      await a.sleep(600);
      await a.step(s[7]);
      await a.look('p[role="status"]:has-text("saved")', 2000, { dx: 0.3 });
    },
  },
  {
    slug: "statements",
    title: "Statements",
    summary: "What each carrier is paid for the week: check it, print it or download the PDF, keep the link to its tickets, and email it to one carrier or to all of them.",
    href: "/ctal/weeks",
    hrefLabel: "Open weeks",
    start: "/ctal/weeks",
    steps: ["Open the week's statements", "Find a carrier", "What the carrier is paid", "The PDF", "Link to the tickets on your server", "Email one statement", "Email all the others"],
    async run(a, s, ctx) {
      await a.step(s[0]);
      await a.click(a.page.locator("table tbody tr").last().locator("a"));
      await a.settle(700);
      await a.click('nav[aria-label="Week sections"] >> text="Statements"');
      await a.settle(900);
      await a.step(s[1]);
      await a.click('input[aria-label="Find a carrier"]');
      await a.type("river");
      await a.sleep(700);
      await a.click('aside button:has-text("RIVER BEND TRUCKING")');
      await a.sleep(900);
      await a.step(s[2]);
      await a.look("section tfoot td:nth-last-child(4)", 900);
      for (const k of ["Subtotal", "Broker fee", "FSC", "Total"]) await a.look(`section dl dt:text-is("${k}") + dd`, 800);
      await a.step(s[3]);
      await a.look('button:has-text("Print")', 800);
      const download = a.page.waitForEvent("download");
      await a.click('section button:has-text("Download PDF")');
      const pdf = `${ctx.tmp}/statement.pdf`;
      await (await download).saveAs(pdf);
      await a.sleep(500);
      await a.card(pdfCard(pdf, "The statement, ready to print or send"), 4200);
      await a.step(s[4]);
      await a.fill('input[name="url"]', "https://tickets.example.com/river-bend/week-44", { fast: true });
      await a.click('button:has-text("Save link")');
      await a.sleep(1200);
      await a.look('a:has-text("Open tickets")', 1400);
      await a.step(s[5]);
      await a.click('button:has-text("Email statement")');
      await a.sleep(2200);
      await a.look('aside button:has-text("RIVER BEND TRUCKING")', 1400, { dx: 0.3, dy: 0.72 });
      await a.step(s[6]);
      await a.click('input[aria-label="Find a carrier"]');
      await a.key("Control+A", 100);
      await a.key("Backspace", 400);
      await a.click('button:has-text("Email all statements")');
      await a.page.locator('section p[role="status"]:has-text("statements emailed")').waitFor({ timeout: 30000 });
      await a.sleep(900);
      await a.look("aside li:nth-child(2) button", 800, { dx: 0.3, dy: 0.72 });
      await a.look("aside li:nth-child(6) button", 1400, { dx: 0.3, dy: 0.72 });
    },
  },
  {
    slug: "billing-profit",
    title: "Billing and broker profit",
    summary: "The week's billing sheets for ASG, Ready Mix and Excavation with their PDF and Excel downloads, the Billings export, and the profit summary by carrier.",
    href: "/ctal/weeks",
    hrefLabel: "Open weeks",
    start: "/ctal/weeks",
    steps: ["Three billing sheets", "Subtotal, FSC and total", "Download a sheet", "The Billings export", "Broker profit", "From the summary to a statement"],
    async run(a, s, ctx) {
      await a.step(s[0]);
      await a.click(a.page.locator("table tbody tr").last().locator("a"));
      await a.settle(600);
      await a.click('nav[aria-label="Week sections"] >> text="Billing"');
      await a.settle(900);
      const sheet = (name) => a.page.locator(`section[aria-label="${name} billing"]`);
      await a.look(sheet("ASG").locator("h2"), 900, { dx: 0.1 });
      await a.step(s[1]);
      await a.look(sheet("ASG").locator('dl dt:text-is("Total") + dd'), 1400);
      await a.look(sheet("Ready Mix").locator("h2"), 800, { dx: 0.1 });
      await a.look(sheet("Ready Mix").locator('dl dt:text-is("FSC") + dd'), 1100);
      await a.look(sheet("Excavation").locator("h2"), 800, { dx: 0.1 });
      await a.look(sheet("Excavation").locator('dl dt:text-is("Total") + dd'), 1100);
      await a.step(s[2]);
      const download = a.page.waitForEvent("download");
      await a.click(sheet("Ready Mix").locator('button:has-text("Download PDF")'));
      const pdf = `${ctx.tmp}/billing.pdf`;
      await (await download).saveAs(pdf);
      await a.sleep(400);
      await a.card(pdfCard(pdf, "The Ready Mix billing sheet"), 3800);
      await a.look(sheet("Ready Mix").locator('button:has-text("Download Excel (CSV)")'), 1300);
      await a.step(s[3]);
      await a.page.mouse.wheel(0, -4000);
      await a.sleep(500);
      const csv = a.page.waitForEvent("download");
      await a.click('button:has-text("Download Billings (CSV)")');
      await (await csv).saveAs(`${ctx.tmp}/billings.csv`);
      await a.sleep(1300);
      await a.step(s[4]);
      await a.click('nav[aria-label="Week sections"] >> text="Broker profit"');
      await a.settle(800);
      await a.look("main p >> nth=1", 1200, { dx: 0.1 });
      await a.look("table tbody tr:nth-child(3) td:nth-child(5)", 800);
      await a.look("table tbody tr:nth-child(3) td:last-child", 900);
      await a.look("table tfoot td:last-child", 1500);
      await a.step(s[5]);
      await a.click("table tbody tr:nth-child(5) a");
      await a.settle(2200);
    },
  },
];
