import type { CategoryId, Flow } from './enums'

/**
 * lib/landing.ts — search-intent landing pages ("Is my HVAC quote fair?").
 *
 * Each entry renders at /check/[slug] through one template
 * (app/check/[slug]/page.tsx), and is picked up by the sitemap automatically.
 * To add a page, append an entry: no other file changes. Kept in code (not
 * Sanity) so every page is typed and reviewed in a PR, and so the template can
 * rely on every section being present.
 *
 * Cost figures are national ballparks for orientation, not quotes. Keep them
 * conservative and review them at least yearly (bump `updated` when you do).
 */

export interface CostRow {
  item:   string
  range:  string
  note?:  string
}

export interface LandingPage {
  slug:            string
  category:        CategoryId
  /** Which funnel the CTA starts: 'post' = Quote Shield, 'pre' = Diagnostic Brief. */
  flow:            Flow
  /** ISO date the content was last reviewed. Feeds sitemap lastModified. */
  updated:         string
  /** <title> without the site suffix. Aim for ≤ 60 chars with the suffix. */
  metaTitle:       string
  /** Meta description. Aim for 140–160 chars. */
  metaDescription: string
  eyebrow:         string
  /** The H1. Should match the search query's wording closely. */
  h1:              string
  lede:            string
  costTable: {
    caption: string
    rows:    CostRow[]
  }
  /** "What drives the price" — short factors, one line each. */
  priceDrivers:    string[]
  redFlags:        string[]
  questions:       string[]
  faqs:            { q: string; a: string }[]
  /** Short label for cross-links and the /check index. */
  shortTitle:      string
}

export const LANDING_PAGES: LandingPage[] = [
  {
    slug:      'is-my-hvac-quote-fair',
    category:  'hvac',
    flow:      'post',
    updated:   '2026-10-05',
    shortTitle: 'HVAC quote',
    metaTitle: 'Is My HVAC Quote Fair? How to Check an AC or Furnace Quote',
    metaDescription:
      'Got an HVAC quote for a new AC, furnace, or repair? See typical price ranges, red flags that signal padding, and how to check your quote line by line.',
    eyebrow: 'HVAC quote check',
    h1:      'Is my HVAC quote fair?',
    lede:
      'HVAC quotes are hard to judge because the same symptom can be a $250 part or a $12,000 system. ' +
      'Before you sign, check whether the scope matches the problem and whether each line is priced in a normal range.',
    costTable: {
      caption: 'Typical installed prices, US national ballpark',
      rows: [
        { item: 'Capacitor or contactor replacement', range: '$150 – $450', note: 'Common no-cool fix; parts are inexpensive' },
        { item: 'Refrigerant leak search and recharge', range: '$400 – $1,500', note: 'Depends on refrigerant type and leak location' },
        { item: 'Blower or condenser fan motor', range: '$400 – $1,200' },
        { item: 'Central AC replacement (2–4 ton)', range: '$5,000 – $10,000', note: 'Condenser plus matched coil' },
        { item: 'Gas furnace replacement', range: '$3,500 – $8,000' },
        { item: 'Heat pump system replacement', range: '$7,000 – $16,000' },
        { item: 'Full AC + furnace replacement', range: '$9,000 – $18,000', note: 'Ductwork changes push this higher' },
      ],
    },
    priceDrivers: [
      'System size (tons) and efficiency rating (SEER2 / AFUE)',
      'Whether ductwork, line sets, or electrical need changes',
      'Brand tier: premium brands often add 15–30% for similar performance',
      'Permits, haul-away, and labor rates in your area',
      'Season: emergency summer and winter calls cost more',
    ],
    redFlags: [
      'A full system replacement quoted for a symptom that is often a repair (no cooling, short cycling) with no diagnostic readings to back it up',
      'No load calculation (Manual J) for a replacement: a bigger unit is not a better unit',
      'A single lump-sum price with no breakdown of equipment, labor, and materials',
      'Add-ons you did not ask for: premium thermostats, UV lights, air purifiers, duct cleaning',
      'Pressure to sign today for a "discount" that expires',
      'Repeated refrigerant top-ups without finding the leak',
    ],
    questions: [
      'What readings or tests confirmed this diagnosis?',
      'Can this be repaired, and what would the repair cost compared with replacement?',
      'Did you do a load calculation, and what size does it call for?',
      'What exactly is the model number of the equipment, and is the coil matched to the condenser?',
      'What does the warranty cover for parts and for labor, and for how long?',
      'Is the permit included in this price?',
    ],
    faqs: [
      {
        q: 'How much should a new HVAC system cost?',
        a: 'Across the US, a central air conditioner replacement typically runs $5,000 to $10,000 installed and a full AC plus furnace replacement $9,000 to $18,000. Size, efficiency, brand tier, ductwork changes, and local labor rates explain most of the spread.',
      },
      {
        q: 'How do I know if my HVAC contractor is overcharging me?',
        a: 'Compare the scope to the problem first: a quote to replace a whole system for a repairable fault is the most expensive kind of overcharge. Then check each line against typical ranges, look for add-ons you did not request, and get a second itemized quote for any job over a few thousand dollars.',
      },
      {
        q: 'Should I repair or replace my AC?',
        a: 'A common rule of thumb is to replace when the repair costs more than about half the price of a new system, or when the unit is over 12 to 15 years old and uses phased-out R-22 refrigerant. Otherwise, a repair is often the better value.',
      },
      {
        q: 'Can HomeReview AI check my HVAC quote?',
        a: 'Yes. Upload a photo or PDF of the quote and Quote Shield reviews it line by line against typical ranges, flags missing scope and upsells, and gives you questions and negotiation language. The first look is free.',
      },
    ],
  },
  {
    slug:      'is-my-roof-quote-fair',
    category:  'roofing',
    flow:      'post',
    updated:   '2026-10-05',
    shortTitle: 'Roof quote',
    metaTitle: 'Is My Roof Quote Fair? How to Check a Roofing Estimate',
    metaDescription:
      'Got a roof replacement or repair quote? See typical cost per square, what drives the price, red flags in roofing estimates, and how to check yours.',
    eyebrow: 'Roofing quote check',
    h1:      'Is my roof quote fair?',
    lede:
      'Roof quotes vary widely because they are priced per "square" (100 sq ft) with a long list of extras. ' +
      'Knowing how many squares you are paying for, and what is included, is most of the battle.',
    costTable: {
      caption: 'Typical installed prices, US national ballpark',
      rows: [
        { item: 'Minor repair (flashing, a few shingles)', range: '$300 – $1,500' },
        { item: 'Asphalt shingle replacement, per square', range: '$450 – $800', note: 'Includes tear-off of one layer' },
        { item: 'Typical asphalt roof (20–30 squares)', range: '$10,000 – $22,000' },
        { item: 'Extra layer tear-off, per square', range: '$100 – $250' },
        { item: 'Decking (plywood) replacement, per sheet', range: '$70 – $150', note: 'Should be quoted as a unit price, not a lump sum' },
        { item: 'Metal roof replacement, per square', range: '$1,000 – $1,800' },
      ],
    },
    priceDrivers: [
      'Roof size in squares, plus a waste factor (usually 10–15%)',
      'Pitch and complexity: steep roofs, valleys, and dormers add labor',
      'Number of existing layers to tear off',
      'Material: architectural shingles cost more than 3-tab; metal more again',
      'Underlayment, ice and water shield, ventilation, and flashing replacement',
    ],
    redFlags: [
      'No measured square count on the quote, or a square count much higher than your roof size suggests',
      'Decking replacement as an open-ended lump sum instead of a per-sheet price',
      'Reusing old flashing on a full replacement',
      'Storm-chaser tactics: door-to-door offers, "we\'ll cover your deductible", pressure to sign an insurance assignment',
      'A large upfront deposit (well over a third) before materials are delivered',
      'Vague warranty language with no manufacturer warranty tier named',
    ],
    questions: [
      'How many squares did you measure, and what waste factor did you add?',
      'How many layers will you tear off?',
      'What is the per-sheet price if decking needs replacement, and how will I be told before you replace it?',
      'Which underlayment, ice and water shield, and drip edge are included?',
      'Will you replace all flashing and pipe boots?',
      'Which manufacturer warranty is this installation eligible for, and what is your workmanship warranty?',
    ],
    faqs: [
      {
        q: 'How much does a new roof cost?',
        a: 'Most asphalt shingle replacements in the US run about $450 to $800 per square (100 sq ft) installed, which puts a typical 20 to 30 square roof at roughly $10,000 to $22,000. Steep pitch, multiple layers, and decking replacement push it higher.',
      },
      {
        q: 'How do I check a roofer\'s square count?',
        a: 'Your roof area is larger than your home\'s footprint because of pitch and overhangs. Satellite measurement reports are inexpensive and widely available; compare the square count on each quote to one of those and to each other.',
      },
      {
        q: 'Is it normal for a roof quote to include decking?',
        a: 'Most quotes include a small allowance or a per-sheet price, because rotten decking is only found after tear-off. A per-sheet price is normal; an unpriced or lump-sum decking line is a red flag.',
      },
      {
        q: 'Can HomeReview AI check my roofing quote?',
        a: 'Yes. Upload the estimate and Quote Shield checks the square count, unit prices, and included materials against typical ranges and flags what is missing. The first look is free.',
      },
    ],
  },
  {
    slug:      'is-my-water-heater-quote-fair',
    category:  'plumbing',
    flow:      'post',
    updated:   '2026-10-05',
    shortTitle: 'Water heater quote',
    metaTitle: 'Is My Water Heater Quote Fair? Replacement Cost Guide',
    metaDescription:
      'Got a water heater replacement quote? See typical installed prices for tank and tankless units, code items that add cost, and red flags to watch for.',
    eyebrow: 'Water heater quote check',
    h1:      'Is my water heater quote fair?',
    lede:
      'Water heater replacements look simple, but quotes differ by thousands depending on fuel type, code upgrades, and whether you are switching to tankless. ' +
      'Here is how to tell a fair quote from a padded one.',
    costTable: {
      caption: 'Typical installed prices, US national ballpark',
      rows: [
        { item: 'Thermostat, element, or thermocouple repair', range: '$150 – $450' },
        { item: '40–50 gal gas tank replacement', range: '$1,500 – $3,200' },
        { item: '40–50 gal electric tank replacement', range: '$1,200 – $2,800' },
        { item: 'Tankless (gas) replacement or conversion', range: '$3,000 – $6,500', note: 'Conversions may need new gas line and venting' },
        { item: 'Heat pump water heater', range: '$3,000 – $6,000', note: 'Often eligible for rebates and tax credits' },
        { item: 'Expansion tank (if required by code)', range: '$150 – $400' },
      ],
    },
    priceDrivers: [
      'Fuel type and capacity: gas, electric, heat pump, or tankless',
      'Code upgrades: expansion tank, seismic straps, drain pan, venting',
      'Access: attics and tight closets add labor',
      'Permit and old-unit haul-away',
      'Whether gas line, venting, or electrical must be upsized (common with tankless)',
    ],
    redFlags: [
      'A tankless conversion quoted without mentioning gas line sizing or venting',
      'No model number or capacity listed for the new unit',
      'Replacement recommended for a problem that is often a cheap part (no hot water on an electric unit is frequently an element or thermostat)',
      'Code items listed with no explanation of why your home needs them',
      'No permit included where your area requires one',
    ],
    questions: [
      'What is the exact model and capacity, and why that size for my household?',
      'Is the permit included?',
      'Which code upgrades does my installation need, and why?',
      'For tankless: does my gas line and venting support it, and is that work included?',
      'Could this be repaired instead, and what would that cost?',
      'What does the warranty cover for the tank, parts, and labor?',
    ],
    faqs: [
      {
        q: 'How much does it cost to replace a water heater?',
        a: 'A standard 40 to 50 gallon tank typically costs $1,200 to $3,200 installed in the US, with gas units at the higher end. Tankless and heat pump models usually run $3,000 to $6,500, especially when gas lines or venting need upgrades.',
      },
      {
        q: 'Is tankless worth the extra cost?',
        a: 'It can be for larger households or where space matters, but the upfront cost is often double a tank and the energy savings take years to pay back. A heat pump tank is often the better value where rebates are available.',
      },
      {
        q: 'Why is my water heater quote so much higher than the unit price online?',
        a: 'Installed prices include labor, permit, haul-away, fittings, and any code upgrades. That is normal; what is not normal is a quote that does not itemize those pieces.',
      },
      {
        q: 'Can HomeReview AI check my water heater quote?',
        a: 'Yes. Upload the quote and Quote Shield checks the unit, labor, and code items against typical ranges and flags anything missing or padded. The first look is free.',
      },
    ],
  },
]

export function getLandingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug)
}
