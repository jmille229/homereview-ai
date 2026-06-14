/**
 * Static article content for /learn/[slug]. Two real articles to launch with —
 * add more here and they automatically become live links on /learn.
 */

export interface ArticleSection {
  heading?: string
  body:     string[]   // paragraphs
  bullets?: string[]
}

export interface Article {
  slug:     string
  category: string
  title:    string
  summary:  string
  readTime: string
  published: string
  sections: ArticleSection[]
}

export const ARTICLES: Record<string, Article> = {
  'hvac-replacement-quote-fair-price': {
    slug:     'hvac-replacement-quote-fair-price',
    category: 'HVAC',
    title:    'Is your HVAC replacement quote fair? What to expect in 2026.',
    summary:  'What a furnace or AC replacement should cost, what drives the variation, and the line items most likely to be padded.',
    readTime: '6 min',
    published: 'June 2026',
    sections: [
      {
        body: [
          'A full HVAC replacement is one of the largest unplanned expenses a homeowner faces — typically $5,000 to $12,000 depending on the system, your region, and how the job is scoped. Because most people replace a system only once or twice in their life, contractors know you have almost no reference point for what is fair. This guide gives you one.',
        ],
      },
      {
        heading: 'What actually drives the price',
        body: ['Five factors explain most of the spread between a fair quote and an inflated one:'],
        bullets: [
          'System size (tonnage / BTUs) — must be matched to your home with a load calculation, not guessed from the old unit.',
          'Efficiency rating (SEER2 / AFUE) — higher efficiency costs more upfront; the premium is often oversold relative to the energy savings.',
          'Equipment brand and tier — mid-tier equipment from a major brand is usually the value sweet spot.',
          'Labor and accessibility — a tight attic, a rooftop unit, or new ductwork legitimately raises cost.',
          'Region — major metros can run 40–80% higher than rural areas for identical equipment.',
        ],
      },
      {
        heading: 'The line items most likely to be padded',
        body: [
          'A quote being high is not automatically fraud — but these are the items to scrutinize, because they are where margin is quietly added:',
        ],
        bullets: [
          'Premium thermostats bundled in without being requested.',
          '"Required" add-ons (surge protectors, UV lamps, air scrubbers) presented as mandatory when they are optional.',
          'Full-system replacement when a component repair would resolve the actual problem.',
          'Inflated labor hours for what is a standard same-day changeout.',
          'Oversized equipment — a bigger unit is not better; it short-cycles, costs more, and signals no load calculation was done.',
        ],
      },
      {
        heading: 'Questions that separate a good contractor from a bad one',
        body: ['Before you sign, ask:'],
        bullets: [
          'Did you perform a Manual J load calculation to size this system?',
          'Why this tonnage and this efficiency rating for my specific home?',
          'What exactly fails if I repair instead of replace?',
          'Is every line item required, or are some optional?',
          'What is the written warranty on parts and on labor?',
        ],
      },
      {
        heading: 'The bottom line',
        body: [
          'Get the model numbers and SEER2/AFUE ratings in writing, confirm the system was sized with a load calculation, and treat any "today only" pricing as a pressure tactic rather than a real deadline. A fair contractor will happily explain their reasoning; an evasive answer is itself the answer.',
        ],
      },
    ],
  },

  'galvanized-pipe-repipe-cost': {
    slug:     'galvanized-pipe-repipe-cost',
    category: 'Plumbing',
    title:    'Galvanized pipes and repiping: what homeowners in older homes need to know.',
    summary:  'How to tell if your galvanized steel pipes are failing, what a repipe costs, and what a complete scope includes.',
    readTime: '7 min',
    published: 'June 2026',
    sections: [
      {
        body: [
          'If your home was built before about 1970, there is a good chance it has galvanized steel water pipes. They were built to last around 40–50 years — which means almost all of them are now past their design life. Knowing the warning signs, and what a fair repipe looks like, protects you from both surprise failures and overpriced quotes.',
        ],
      },
      {
        heading: 'Signs your galvanized pipes are failing',
        body: ['Galvanized pipe corrodes from the inside out, so problems show up at the tap before the pipe visibly leaks:'],
        bullets: [
          'Discolored or rusty water, especially first thing in the morning.',
          'Low water pressure that has gotten worse over years (internal corrosion narrows the pipe).',
          'Uneven pressure — hot side weaker than cold, or one fixture much worse than others.',
          'Visible rust, flaking, or bubbling at threaded joints.',
        ],
      },
      {
        heading: 'What a repipe costs',
        body: [
          'A whole-home repipe typically runs $4,000–$15,000 depending on the number of bathrooms, the number of stories, whether walls are open, and the material chosen (PEX is usually cheaper and faster than copper). The single biggest cost driver is access — opening and patching drywall. A quote that seems low may be excluding the drywall repair; one that seems high may be assuming worst-case access.',
        ],
      },
      {
        heading: 'What a complete scope must include',
        body: ['A thorough repipe quote should spell out:'],
        bullets: [
          'Which lines are being replaced (hot, cold, both) and the material.',
          'Whether it is a whole-home repipe or only the failing sections.',
          'Drywall cut-out AND patch/finish — confirm who handles repair and paint.',
          'New shutoff valves and fixture connections.',
          'Permits and inspection, where required.',
          'A written warranty on the new piping and the labor.',
        ],
      },
      {
        heading: 'Repipe vs. spot repair',
        body: [
          'A single leak can sometimes be repaired — but on galvanized pipe near the end of its life, fixing one joint often just moves the next failure a few feet down the line. If you are seeing system-wide pressure loss or discoloration, a partial repair is usually a short-term patch. Ask the contractor to be explicit about whether they are solving the problem or deferring it.',
        ],
      },
      {
        heading: 'The bottom line',
        body: [
          'Get the material and scope in writing, confirm drywall repair is included (or budget for it separately), and be skeptical of both unusually cheap quotes (likely excluding finish work) and full-replacement quotes when only a section is failing. A second quote is almost always worth it on a job this size.',
        ],
      },
    ],
  },
}

export function getArticle(slug: string): Article | undefined {
  return ARTICLES[slug]
}

export function isArticleLive(slug: string): boolean {
  return slug in ARTICLES
}
