// Preloaded cases so anyone can see the gate work in one click. The first one is
// the demo: the output quietly contradicts the source (30 days becomes 60, and a
// restocking fee appears from nowhere). A cheap reviewer catches both and blocks.

export type Example = {
  id: string;
  label: string;
  // What you'd expect to happen, shown as a hint under the picker.
  expectation: string;
  source: string;
  output: string;
  checklist: string[];
};

export const EXAMPLES: Example[] = [
  {
    id: "refund-hallucination",
    label: "Summary with invented facts",
    expectation: "Should BLOCK — the summary changes 30 days to 60 and invents a restocking fee.",
    source: `Acme Tools — Refund Policy
Customers may return unused items within 30 days of purchase for a full refund. Returns must include the original receipt. Shipping costs are not refundable. Refunds are processed within 5 business days of the item arriving back at our warehouse.`,
    output: `Acme Tools lets customers return unused items within 60 days for a full refund, as long as they keep the original receipt. A 10% restocking fee applies to all returns. Shipping is non-refundable and refunds take about 5 business days once the item is back.`,
    checklist: [
      "Every fact in the summary is supported by the source.",
      "No numbers (days, fees, percentages) are changed or invented.",
      "The summary does not add any policy that is not in the source.",
      "The tone is clear and professional.",
    ],
  },
  {
    id: "clean-product-copy",
    label: "Faithful product description",
    expectation: "Should PASS — every claim traces back to the spec.",
    source: `Product: Fjord 14 backpack
Volume: 14 litres. Weight: 320 g. Material: recycled ripstop nylon. Water-resistant (not waterproof). One main compartment, one padded laptop sleeve up to 13 inches. Colour: slate grey.`,
    output: `The Fjord 14 is a light 320 g daypack with 14 litres of space. Made from recycled ripstop nylon, it shrugs off light rain and holds a laptop up to 13 inches in its padded sleeve. Comes in slate grey.`,
    checklist: [
      "Every fact in the description is supported by the spec.",
      "No numbers are changed or invented.",
      "It does not claim the bag is fully waterproof.",
      "The tone is natural and not overhyped.",
    ],
  },
];
