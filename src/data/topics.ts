export type Agency = {
  id: string;
  name: string;
  shortName: string;
  blurb: string;
  color: string; // CSS variable reference
};

export const AGENCIES: Record<string, Agency> = {
  ecfr: {
    id: "ecfr",
    name: "Code of Federal Regulations",
    shortName: "eCFR",
    blurb: "The federal government's giant rulebook — everything from food labels to airline safety.",
    color: "var(--sage-deep)",
  },
  irm: {
    id: "irm",
    name: "Internal Revenue Manual",
    shortName: "IRM",
    blurb: "How the IRS actually does its job, in their own words.",
    color: "var(--terracotta)",
  },
  tfm: {
    id: "tfm",
    name: "Treasury Financial Manual",
    shortName: "TFM",
    blurb: "Rules for how federal money gets spent, tracked, and reported.",
    color: "var(--ochre)",
  },
  ucc: {
    id: "ucc",
    name: "Uniform Commercial Code",
    shortName: "UCC",
    blurb: "The shared playbook every state uses for sales, leases, and contracts.",
    color: "oklch(0.55 0.09 220)",
  },
  ftc: {
    id: "ftc",
    name: "Federal Trade Commission",
    shortName: "FTC",
    blurb: "Watches over fair competition and protects consumers from shady practices.",
    color: "oklch(0.5 0.11 320)",
  },
};

export type Citation = {
  id: string;
  agency: keyof typeof AGENCIES;
  ref: string; // e.g. "26 CFR § 1.61-1"
  title: string;
  plain: string; // plain-english summary
  excerpt: string; // formal excerpt
};

export type Topic = {
  slug: string;
  title: string;
  emoji: string;
  question: string;
  oneLiner: string;
  story: string; // 2-3 paragraph plain-language explainer
  citations: Citation[];
  // edges between citation ids — describes how rules relate
  connections: Array<{ from: string; to: string; label: string }>;
  glossary: Array<{ term: string; meaning: string }>;
  related: string[]; // other topic slugs
};

export const TOPICS: Topic[] = [
  {
    slug: "side-hustle-taxes",
    title: "Side Hustle Taxes",
    emoji: "💸",
    question: "I made money on the side. What does the government want from me?",
    oneLiner: "If you earned it, the IRS counts it — even cash, tips, and Venmo.",
    story:
      "The tax code starts from a wide net: pretty much every dollar you receive is income unless a specific rule carves it out. Selling crafts, driving rideshare, freelancing — all of it counts. Once you cross small thresholds, the platforms paying you are required to tell the IRS too.\n\nThe twist: as a 'self-employed' person you also owe an extra 15.3% self-employment tax on top of regular income tax, because nobody is withholding Social Security and Medicare for you. The good news is you can subtract real business expenses first.",
    citations: [
      {
        id: "irc-61",
        agency: "ecfr",
        ref: "26 CFR § 1.61-1",
        title: "Gross income defined",
        plain: "Income means money from any source, period — unless the law specifically excludes it.",
        excerpt:
          "Gross income means all income from whatever source derived, unless excluded by law. Gross income includes income realized in any form, whether in money, property, or services.",
      },
      {
        id: "irm-4-23",
        agency: "irm",
        ref: "IRM 4.23.5",
        title: "Employment Tax — Self-Employment",
        plain: "Here's how the IRS decides whether you're really 'self-employed' and owe SE tax.",
        excerpt:
          "Self-employment income includes net earnings from a trade or business carried on by the individual, including independent contractors and sole proprietors.",
      },
      {
        id: "irc-1402",
        agency: "ecfr",
        ref: "26 CFR § 1.1402(a)-1",
        title: "Self-employment tax",
        plain: "The 15.3% self-employment tax — what it covers and how it's calculated.",
        excerpt:
          "The term 'net earnings from self-employment' means the gross income derived by an individual from any trade or business carried on by such individual, less the deductions allowed.",
      },
      {
        id: "tfm-2-4700",
        agency: "tfm",
        ref: "TFM Vol. I, 2-4700",
        title: "1099-K Reporting",
        plain: "Why Venmo, PayPal, and Etsy now mail you a tax form.",
        excerpt:
          "Third-party settlement organizations must report payments in settlement of reportable transactions to payees and to the IRS on Form 1099-K.",
      },
      {
        id: "ftc-mlm",
        agency: "ftc",
        ref: "FTC Business Guide 2023-04",
        title: "Income Disclosures for Side Businesses",
        plain: "If you advertise your side hustle, the FTC has rules about honest income claims.",
        excerpt:
          "Earnings claims must be truthful, non-misleading, and substantiated by competent and reliable evidence at the time the claim is made.",
      },
    ],
    connections: [
      { from: "irc-61", to: "irc-1402", label: "defines income that triggers" },
      { from: "irc-1402", to: "irm-4-23", label: "implemented by" },
      { from: "irc-61", to: "tfm-2-4700", label: "reported via" },
      { from: "tfm-2-4700", to: "irm-4-23", label: "feeds into" },
      { from: "irc-61", to: "ftc-mlm", label: "advertising rules apply" },
    ],
    glossary: [
      { term: "Gross income", meaning: "Every dollar you receive before subtracting anything." },
      { term: "1099-K", meaning: "A form payment apps send when you cross a sales threshold." },
      { term: "SE tax", meaning: "Self-employment tax — Social Security + Medicare for the self-employed." },
    ],
    related: ["renting-your-place", "selling-online"],
  },
  {
    slug: "renting-your-place",
    title: "Renting Out Your Place",
    emoji: "🏠",
    question: "Can I just list my spare room on Airbnb? What rules apply?",
    oneLiner: "Short-term rentals sit at the crossroads of tax law, consumer protection, and local zoning.",
    story:
      "Renting out a room or a whole home is treated as a small business by the federal government — which means the income is reportable, but you also get to deduct a slice of utilities, depreciation, and supplies.\n\nThere's a fun loophole: if you rent your home out for fewer than 15 days a year, none of that income is taxable. Cross day 15, and the whole year counts. Layered on top: the FTC requires platforms to disclose mandatory fees up front, and your state's UCC chapter governs what counts as a binding rental agreement.",
    citations: [
      {
        id: "irc-280a",
        agency: "ecfr",
        ref: "26 CFR § 1.280A-1",
        title: "The 14-day rule",
        plain: "Rent your home 14 days or fewer per year? It's tax-free.",
        excerpt:
          "If a dwelling unit is used during the taxable year by the taxpayer as a residence and such dwelling unit is rented for less than 15 days, no deduction shall be allowed and no income shall be included.",
      },
      {
        id: "irm-4-10",
        agency: "irm",
        ref: "IRM 4.10.10",
        title: "Rental Income Examination",
        plain: "How the IRS audits short-term rental hosts.",
        excerpt:
          "Examiners should verify that taxpayers properly report rental income and allocate expenses between personal and rental use of the property.",
      },
      {
        id: "ucc-2a",
        agency: "ucc",
        ref: "UCC Article 2A",
        title: "Lease agreements",
        plain: "When a 'rental' becomes a legally binding lease in your state.",
        excerpt:
          "A lease is a transfer of the right to possession and use of goods for a term in return for consideration, but a sale, including a sale on approval or a sale or return, is not a lease.",
      },
      {
        id: "ftc-junk-fees",
        agency: "ftc",
        ref: "16 CFR Part 464",
        title: "Junk Fees Rule",
        plain: "Cleaning fees and service fees must be shown up front.",
        excerpt:
          "It is an unfair or deceptive practice to offer, display, or advertise an amount a consumer may pay without clearly and conspicuously disclosing the total price.",
      },
    ],
    connections: [
      { from: "irc-280a", to: "irm-4-10", label: "audited under" },
      { from: "irc-280a", to: "ucc-2a", label: "agreement governed by" },
      { from: "ftc-junk-fees", to: "ucc-2a", label: "applies to listings under" },
    ],
    glossary: [
      { term: "Dwelling unit", meaning: "Tax code's name for a home or part of one." },
      { term: "Lease", meaning: "A contract to use property for a set time in exchange for payment." },
    ],
    related: ["side-hustle-taxes", "junk-fees"],
  },
  {
    slug: "junk-fees",
    title: "Junk Fees & Hidden Charges",
    emoji: "🎫",
    question: "Why does my $40 ticket cost $73 at checkout?",
    oneLiner: "Federal rules now require sellers to show the real total price up front.",
    story:
      "Hidden fees used to be a Wild West — service fees, processing fees, resort fees, 'convenience' fees — invented at checkout. The FTC's Junk Fees rule changed that: sellers have to display the total amount you'll actually pay, prominently, before you commit.\n\nThe rule pairs with older consumer protection law that bans deceptive pricing across industries. State commercial codes (the UCC) determine what counts as the real 'price' of a contract — important when a seller tries to add fees after you've already agreed.",
    citations: [
      {
        id: "ftc-junk-fees",
        agency: "ftc",
        ref: "16 CFR Part 464",
        title: "Junk Fees Rule",
        plain: "Total price must appear up front, in the same size as other prices.",
        excerpt:
          "Businesses must clearly and conspicuously disclose the total price, inclusive of all mandatory fees, whenever they offer, display, or advertise a price.",
      },
      {
        id: "ftc-deceptive",
        agency: "ftc",
        ref: "15 USC § 45",
        title: "Unfair or Deceptive Acts",
        plain: "The original 'don't lie to customers' law from 1914.",
        excerpt:
          "Unfair methods of competition in or affecting commerce, and unfair or deceptive acts or practices in or affecting commerce, are hereby declared unlawful.",
      },
      {
        id: "ucc-2-305",
        agency: "ucc",
        ref: "UCC § 2-305",
        title: "Open price terms",
        plain: "If the price isn't clearly fixed when you agree, courts use a 'reasonable' price.",
        excerpt:
          "The parties if they so intend can conclude a contract for sale even though the price is not settled. In such a case the price is a reasonable price at the time of delivery.",
      },
      {
        id: "ecfr-1026",
        agency: "ecfr",
        ref: "12 CFR § 1026.4",
        title: "Finance charge disclosures",
        plain: "Credit card and loan fees that count toward your APR.",
        excerpt:
          "The finance charge is the cost of consumer credit as a dollar amount. It includes any charge payable directly or indirectly by the consumer as a condition of the extension of credit.",
      },
    ],
    connections: [
      { from: "ftc-deceptive", to: "ftc-junk-fees", label: "modernized as" },
      { from: "ftc-junk-fees", to: "ucc-2-305", label: "complements" },
      { from: "ftc-junk-fees", to: "ecfr-1026", label: "parallels for credit" },
    ],
    glossary: [
      { term: "Mandatory fee", meaning: "Any fee you can't avoid to complete the purchase." },
      { term: "APR", meaning: "Annual Percentage Rate — the true yearly cost of borrowing." },
    ],
    related: ["renting-your-place", "side-hustle-taxes"],
  },
  {
    slug: "selling-online",
    title: "Selling Stuff Online",
    emoji: "📦",
    question: "I'm selling on Etsy/eBay. What am I on the hook for?",
    oneLiner: "Selling online combines tax reporting, sales rules, and honest-advertising laws.",
    story:
      "When you sell online, three different rulebooks meet. The IRS wants to know about your income (and the platform tells them via 1099-K). The UCC governs the actual sales contract — what counts as a binding offer, what 'as-is' really means, and what happens if the buyer never pays.\n\nThe FTC handles how you describe what you're selling: photos, claims, reviews, and even the word 'free' have rules attached. Get those three right and you're running a real little business.",
    citations: [
      {
        id: "ucc-2-204",
        agency: "ucc",
        ref: "UCC § 2-204",
        title: "Formation of contract",
        plain: "A sale is binding even without a formal contract — if both sides act like there's a deal.",
        excerpt:
          "A contract for sale of goods may be made in any manner sufficient to show agreement, including conduct by both parties which recognizes the existence of a contract.",
      },
      {
        id: "ucc-2-313",
        agency: "ucc",
        ref: "UCC § 2-313",
        title: "Express warranties",
        plain: "What you say about your product can become a legally binding promise.",
        excerpt:
          "Any affirmation of fact or promise made by the seller to the buyer which relates to the goods and becomes part of the basis of the bargain creates an express warranty.",
      },
      {
        id: "tfm-2-4700",
        agency: "tfm",
        ref: "TFM Vol. I, 2-4700",
        title: "1099-K Reporting",
        plain: "Payment platforms must report your sales above the threshold.",
        excerpt:
          "Third-party settlement organizations must report payments in settlement of reportable transactions to payees and to the IRS on Form 1099-K.",
      },
      {
        id: "ftc-endorse",
        agency: "ftc",
        ref: "16 CFR Part 255",
        title: "Endorsement Guides",
        plain: "Reviews and influencer posts have to be honest and disclose paid relationships.",
        excerpt:
          "Endorsements must reflect the honest opinions, findings, beliefs, or experience of the endorser. Material connections between the endorser and the seller must be clearly disclosed.",
      },
      {
        id: "irc-61",
        agency: "ecfr",
        ref: "26 CFR § 1.61-1",
        title: "Gross income defined",
        plain: "Every dollar from sales is income.",
        excerpt:
          "Gross income means all income from whatever source derived, unless excluded by law.",
      },
    ],
    connections: [
      { from: "ucc-2-204", to: "ucc-2-313", label: "creates obligations under" },
      { from: "ucc-2-313", to: "ftc-endorse", label: "and advertising rules in" },
      { from: "irc-61", to: "tfm-2-4700", label: "reported through" },
      { from: "tfm-2-4700", to: "ucc-2-204", label: "evidence of" },
    ],
    glossary: [
      { term: "Express warranty", meaning: "A promise about a product that you can be held to." },
      { term: "Basis of the bargain", meaning: "Anything that influenced the buyer's decision to buy." },
    ],
    related: ["side-hustle-taxes", "junk-fees"],
  },
];

export function getTopic(slug: string) {
  return TOPICS.find((t) => t.slug === slug);
}