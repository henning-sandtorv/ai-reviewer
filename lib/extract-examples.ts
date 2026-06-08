// Preloaded extraction cases. The point of each is to show the honest-flagging
// behaviour: the first doc is missing a field the requester asked for (no PO
// number), and has an ambiguous one (two dates) — a naive extractor would invent
// the PO and pick a date silently. This one flags both.

export type ExtractExample = {
  id: string;
  label: string;
  expectation: string;
  document: string;
  fields: string[];
};

export const EXTRACT_EXAMPLES: ExtractExample[] = [
  {
    id: "messy-invoice",
    label: "Invoice with a missing field",
    expectation:
      "Should flag — there is no PO number (missing), and the due date is ambiguous (two dates appear).",
    document: `From: billing@nordveststål.no
Subject: Faktura – mars

Hei,

Takk for handelen. Fakturanr. 2026-0413. Beløp kr 18 750 eks. mva (totalt kr 23 437,50 inkl. 25% mva).
Levert 12.03.2026. Betalingsfrist 30 dager. Faktura sendt 14.03.2026.

Vennlig hilsen
Nordvest Stål AS, org. 998 877 665`,
    fields: [
      "Invoice number",
      "Total amount including VAT",
      "VAT rate",
      "Due date",
      "Purchase order (PO) number",
      "Vendor organisation number",
    ],
  },
  {
    id: "clean-receipt",
    label: "Clean receipt",
    expectation: "Should be all found — every field is unambiguously in the text.",
    document: `RECEIPT
Brygge Kaffebar
Date: 2026-05-02  Time: 08:14
Order #4471
1x Flat white .......... 49,00
1x Kanelbolle .......... 39,00
Total: 88,00 NOK
Paid by card ending 4012`,
    fields: ["Order number", "Date", "Total", "Currency", "Payment method"],
  },
];
