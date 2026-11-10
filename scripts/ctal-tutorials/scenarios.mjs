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
    // Spoken over the intro card, then one line per step.
    voice: {
      intro: "Welcome. This is a quick tour of your carrier workspace: what the home screen tells you, and how to find anything in seconds.",
      steps: [
        "The overview opens on the current week. You see how many loads are logged, what you owe your carriers, what you will bill, and your profit, with and without fuel surcharge.",
        "On the right is the insurance list. Carriers whose insurance has expired show in red, and those expiring within thirty days show in amber, so you can call them in time.",
        "The search box finds a carrier by name, by its number, by owner or by phone. Just start typing and the matches appear.",
        "It also finds tickets. Type part of a ticket number, pick the result, and you land on that exact row of the weekly log.",
        "The menu at the top takes you everywhere: weeks, carriers, customers, and these tutorials.",
      ],
    },
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
    // Spoken over the intro card, then one line per step.
    voice: {
      intro: "This video covers your carrier list: searching it, filtering it, adding a carrier, and importing your Google Sheet.",
      steps: [
        "Every carrier is here with the same columns as your sheet: pay term, contacts, equipment, insurance date, hub city and U.S. D.O.T. number.",
        "Search works as you type, across every column. Try a city, or a phone number, and the list narrows down right away.",
        "These filters show who needs attention: insurance expired, expiring soon, or missing documents. You can also list quick pay carriers, or those paid at twenty-eight days.",
        "To add a carrier, fill in the form. Only the name is required. The pay term matters: quick pay carriers get the three point five percent fee, and twenty-eight day carriers do not. Hub city suggests the cities you already use. Save, and the carrier is ready for its documents.",
        "To bring in the whole sheet at once, copy the table in Google Sheets, header row included, and paste it here. Check the preview, then import. Carriers you already have are skipped, so nothing is duplicated.",
      ],
    },
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
    // Spoken over the intro card, then one line per step.
    voice: {
      intro: "Here you will see how to keep each carrier's paperwork: insurance, contract and driver's license, as PDF files or photos.",
      steps: [
        "Open a carrier from the list. Its page has the documents at the top, its information below, and its past statements at the bottom.",
        "Drop the files here, or choose them from your computer. Each file gets a type, guessed from its name, and you can set the date it expires. Then upload.",
        "Click a document to read it right on the screen, without downloading it. It works for PDF files and for photos.",
        "Below, update the insurance date and paste the link to this carrier's tickets folder on your own server. After saving, a button at the top opens that folder directly.",
        "When a file is outdated, delete it. It is removed for good, so only current paperwork stays.",
      ],
    },
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
    // Spoken over the intro card, then one line per step.
    voice: {
      intro: "This video explains customers. Each customer holds the rules of its job, and the log uses them to fill in every load for you.",
      steps: [
        "For each customer you set the unit it is paid by, tons, yards, loads or hours, and the broker rate and carrier rate.",
        "Then the fee taken from the carrier. Most jobs use the quick pay fee of three point five percent. Others, like this one, use a broker fee of eight percent instead.",
        "Fuel surcharge can be off, a fixed amount per load, or a percentage of the carrier amount. And Billed by decides whether the job goes on the A.S.G., Ready Mix or Excavation sheet.",
        "To add a customer, type its name, the rates, and choose its rules. Here, fuel surcharge is ten percent.",
        "You can change a rate at any time. Weeks already logged keep their own numbers, so past statements never change.",
      ],
    },
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
    // Spoken over the intro card, then one line per step.
    voice: {
      intro: "This is the heart of the work: the weekly log, where you enter the invoices and tickets your carriers send you.",
      steps: [
        "A week runs from Sunday to Saturday and is paid the following Friday. Pick any day of that week and start it.",
        "Type a few letters of the carrier and pick it from the suggestions. Its truck and driver fill in by themselves. Do the same with the customer, and the unit, rates, fee and fuel surcharge appear. You only type the ticket and the tons.",
        "Press Enter, and the next load starts with the same date, carrier, truck, driver and customer. Just keep typing tickets and tons.",
        "For a different job, change the carrier and the customer. This customer uses a broker fee of eight percent and a fixed fuel surcharge, and this carrier is paid at twenty-eight days. The row adjusts on its own.",
        "If you type a ticket that is already in the week, both rows turn amber, so you never pay a ticket twice.",
        "Deleted a row by mistake? Click Undo and it comes right back.",
        "Click a carrier to see only its loads. The bar at the bottom shows its totals, including what you will pay it.",
        "There is no save button. Everything is saved as you type.",
      ],
    },
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
    // Spoken over the intro card, then one line per step.
    voice: {
      intro: "Now the statements: what each carrier is paid for the week, ready to print, download or email.",
      steps: [
        "Open the week and go to Statements. Each carrier that hauled that week has its own statement, with the total next to its name.",
        "Find a carrier by typing part of its name, and select it.",
        "The statement lists every load. At the bottom, the subtotal, minus the broker fee or quick pay fee, plus fuel surcharge, gives the total to pay.",
        "Print it, or download it as a PDF. This is the document your carrier receives.",
        "You can keep a link to that week's tickets on your own server. The tickets are not uploaded here, only the link is saved.",
        "Email statement sends the PDF to the address on the carrier's record. The list then shows when it was sent.",
        "Or send them all at once. Carriers without an email address are skipped, and the ones already sent are not sent again.",
      ],
    },
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
    // Spoken over the intro card, then one line per step.
    voice: {
      intro: "Last, billing and profit: what you bill each company for the week, and how the week turned out.",
      steps: [
        "The Billing tab splits the week's loads into three sheets: A.S.G., Ready Mix and Excavation, according to each customer.",
        "Each sheet ends with its subtotal, the fuel surcharge, and the total to bill.",
        "Download any sheet as a PDF, or as a file you can open in Excel.",
        "The Billings button exports the whole log without the amounts, just like the Billings sheet in your workbook.",
        "Broker profit sums it up by carrier: the difference between what you bill and what you pay, plus the fees you kept. The total is shown with and without fuel surcharge.",
        "Click any carrier to jump straight to its statement.",
      ],
    },
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
