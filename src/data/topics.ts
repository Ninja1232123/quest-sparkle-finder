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
  {
    slug: "traffic-stops",
    title: "Rights at a Traffic Stop",
    emoji: "🚦",
    question: "What am I actually required to do if I'm pulled over?",
    oneLiner: "The Fourth and Fifth Amendments set the floor; state codes fill in the rest.",
    story:
      "A traffic stop is a 'seizure' under the Fourth Amendment, which means the officer needs reasonable suspicion to initiate it and probable cause to extend it. You generally must identify yourself and produce license, registration, and insurance — but answering investigative questions beyond that is voluntary in most states.\n\nConsent to a search waives your Fourth Amendment protection. Federal regulations and DOJ guidance describe how officers should articulate cause; state vehicle codes spell out what counts as a lawful stop and which documents you must hand over.",
    citations: [
      {
        id: "us-const-4",
        agency: "ecfr",
        ref: "U.S. Const. amend. IV",
        title: "Right against unreasonable search and seizure",
        plain: "Police need a real reason — not a hunch — to stop, search, or detain you.",
        excerpt:
          "The right of the people to be secure in their persons, houses, papers, and effects, against unreasonable searches and seizures, shall not be violated, and no Warrants shall issue, but upon probable cause.",
      },
      {
        id: "us-const-5",
        agency: "ecfr",
        ref: "U.S. Const. amend. V",
        title: "Right to remain silent",
        plain: "You don't have to answer questions that could be used against you.",
        excerpt:
          "No person shall be compelled in any criminal case to be a witness against himself, nor be deprived of life, liberty, or property, without due process of law.",
      },
      {
        id: "doj-stops",
        agency: "ftc",
        ref: "DOJ COPS Guide 2019-Stops",
        title: "Investigative stops guidance",
        plain: "Federal guidance on when officers may extend a routine stop into a search.",
        excerpt:
          "An officer may not prolong a traffic stop beyond the time reasonably required to complete the mission of the stop absent independent reasonable suspicion of additional criminal activity.",
      },
      {
        id: "ucc-9-609",
        agency: "ucc",
        ref: "UCC § 9-609",
        title: "Repossession after default",
        plain: "If you're behind on a car loan, lenders can repossess — but not by 'breach of peace.'",
        excerpt:
          "After default, a secured party may take possession of the collateral without judicial process, if it proceeds without breach of the peace.",
      },
    ],
    connections: [
      { from: "us-const-4", to: "doj-stops", label: "interpreted by" },
      { from: "us-const-4", to: "us-const-5", label: "operates alongside" },
      { from: "us-const-4", to: "ucc-9-609", label: "limits private seizures under" },
    ],
    glossary: [
      { term: "Reasonable suspicion", meaning: "Specific facts suggesting a crime — more than a hunch, less than probable cause." },
      { term: "Probable cause", meaning: "Enough facts that a reasonable person would believe a crime occurred." },
      { term: "Breach of peace", meaning: "Conduct that risks violence or public disturbance — bars self-help repossession." },
    ],
    related: ["tenant-rights", "debt-collection"],
  },
  {
    slug: "tenant-rights",
    title: "Tenant Rights & Eviction",
    emoji: "🔑",
    question: "What can my landlord actually do — and what do I have to take?",
    oneLiner: "Habitability, notice, and due process are baked into both federal rules and state property codes.",
    story:
      "Federal fair-housing law sets the outer limits: landlords can't discriminate on protected characteristics, and federally-backed properties have additional notice rules. Beneath that, every state recognizes an 'implied warranty of habitability' — the place must be safe and livable regardless of what the lease says.\n\nEviction is a court process, not a self-help remedy. Locking you out, shutting off utilities, or removing your belongings without a court order is illegal in nearly every state. The UCC governs the security-deposit accounting and any goods left behind.",
    citations: [
      {
        id: "fha-3604",
        agency: "ecfr",
        ref: "42 USC § 3604",
        title: "Fair Housing Act",
        plain: "Landlords can't refuse, charge more, or set different terms based on protected traits.",
        excerpt:
          "It shall be unlawful to refuse to sell or rent, or to discriminate against any person in the terms, conditions, or privileges of sale or rental of a dwelling, because of race, color, religion, sex, familial status, or national origin.",
      },
      {
        id: "hud-247",
        agency: "ecfr",
        ref: "24 CFR § 247.4",
        title: "Termination notice requirements",
        plain: "Federally-subsidized landlords must give written notice with specific reasons.",
        excerpt:
          "The landlord's determination to terminate the tenancy shall be in writing and shall state that the tenancy is terminated on a date certain, the reasons for the action with enough specificity to enable the tenant to prepare a defense.",
      },
      {
        id: "ucc-2a-lease",
        agency: "ucc",
        ref: "UCC Article 2A",
        title: "Lease as binding contract",
        plain: "Your lease is a contract — both sides have to follow it.",
        excerpt:
          "A lease is a transfer of the right to possession and use of goods for a term in return for consideration.",
      },
      {
        id: "ftc-deposit",
        agency: "ftc",
        ref: "FTC Consumer Advisory 2022-DEP",
        title: "Security deposit transparency",
        plain: "Deposit deductions must be itemized and supported by receipts.",
        excerpt:
          "Failure to provide an itemized written statement of deductions from a security deposit may constitute an unfair or deceptive practice in or affecting commerce.",
      },
    ],
    connections: [
      { from: "fha-3604", to: "hud-247", label: "enforced through" },
      { from: "hud-247", to: "ucc-2a-lease", label: "supplements" },
      { from: "ucc-2a-lease", to: "ftc-deposit", label: "deposit rules under" },
    ],
    glossary: [
      { term: "Implied warranty of habitability", meaning: "Unwritten promise that a rental is fit to live in." },
      { term: "Self-help eviction", meaning: "When a landlord tries to force you out without court — generally illegal." },
    ],
    related: ["renting-your-place", "debt-collection"],
  },
  {
    slug: "debt-collection",
    title: "Debt Collectors & Your Rights",
    emoji: "📞",
    question: "A collector keeps calling. What can they actually do to me?",
    oneLiner: "The FDCPA limits how debts are collected; the FCRA controls what ends up on your credit report.",
    story:
      "Federal law treats debt collection as a regulated industry. Collectors must identify themselves, can't call at unreasonable hours, can't threaten action they aren't legally able to take, and must stop contacting you at work if you tell them to in writing.\n\nIf the debt ends up on your credit report, the Fair Credit Reporting Act gives you the right to dispute inaccurate entries — and the bureau must investigate within 30 days. The UCC governs the underlying contract that created the debt in the first place.",
    citations: [
      {
        id: "fdcpa-1692c",
        agency: "ftc",
        ref: "15 USC § 1692c",
        title: "Communication restrictions",
        plain: "Collectors can't call before 8am or after 9pm, or contact you at work if you say not to.",
        excerpt:
          "Without the prior consent of the consumer, a debt collector may not communicate with a consumer at any unusual time or place, particularly before 8 o'clock antemeridian and after 9 o'clock postmeridian.",
      },
      {
        id: "fdcpa-1692e",
        agency: "ftc",
        ref: "15 USC § 1692e",
        title: "False or misleading representations",
        plain: "Collectors can't lie about the amount, threaten arrest, or pose as lawyers or government.",
        excerpt:
          "A debt collector may not use any false, deceptive, or misleading representation or means in connection with the collection of any debt.",
      },
      {
        id: "fcra-1681i",
        agency: "ftc",
        ref: "15 USC § 1681i",
        title: "Disputing credit report errors",
        plain: "You can dispute anything on your credit report; the bureau has 30 days to investigate.",
        excerpt:
          "If the completeness or accuracy of any item of information contained in a consumer's file is disputed, the agency shall conduct a reasonable reinvestigation to determine whether the disputed information is inaccurate.",
      },
      {
        id: "ucc-3-104",
        agency: "ucc",
        ref: "UCC § 3-104",
        title: "Negotiable instruments",
        plain: "The legal foundation for promissory notes, checks, and other paper debts.",
        excerpt:
          "A 'negotiable instrument' means an unconditional promise or order to pay a fixed amount of money, with or without interest.",
      },
      {
        id: "ecfr-1006",
        agency: "ecfr",
        ref: "12 CFR Part 1006",
        title: "CFPB Regulation F",
        plain: "Caps collector calls at 7 per debt per week and regulates electronic contact.",
        excerpt:
          "A debt collector must not place a telephone call to a particular person in connection with the collection of a particular debt more than seven times within seven consecutive days.",
      },
    ],
    connections: [
      { from: "fdcpa-1692c", to: "fdcpa-1692e", label: "paired with" },
      { from: "fdcpa-1692c", to: "ecfr-1006", label: "operationalized by" },
      { from: "fdcpa-1692e", to: "fcra-1681i", label: "errors challenged via" },
      { from: "ucc-3-104", to: "fdcpa-1692c", label: "creates the debt regulated by" },
    ],
    glossary: [
      { term: "FDCPA", meaning: "Fair Debt Collection Practices Act — the rulebook for third-party collectors." },
      { term: "Reinvestigation", meaning: "The credit bureau's required review when you dispute an entry." },
    ],
    related: ["junk-fees", "tenant-rights"],
  },
  {
    slug: "workplace-rights",
    title: "Wages, Hours & Workplace Rights",
    emoji: "🛠️",
    question: "Am I getting what I'm legally owed at work?",
    oneLiner: "The FLSA sets the minimum floor on pay, hours, and overtime — states can go higher.",
    story:
      "The Fair Labor Standards Act is the spine of U.S. wage law: minimum wage, overtime above 40 hours per week, recordkeeping, and child-labor limits. Whether you're 'exempt' from overtime depends on your job duties and salary, not just your title.\n\nMisclassification — calling an employee a 'contractor' to avoid taxes and overtime — is one of the most common violations. The IRS uses its own multi-factor test, which often disagrees with the company's paperwork.",
    citations: [
      {
        id: "flsa-206",
        agency: "ecfr",
        ref: "29 USC § 206",
        title: "Federal minimum wage",
        plain: "The federal floor is $7.25/hr; many states and cities set it higher.",
        excerpt:
          "Every employer shall pay to each of his employees who in any workweek is engaged in commerce wages at the following rates: not less than $7.25 an hour.",
      },
      {
        id: "flsa-207",
        agency: "ecfr",
        ref: "29 USC § 207",
        title: "Overtime pay",
        plain: "Non-exempt workers get 1.5× pay for hours over 40 in a week.",
        excerpt:
          "No employer shall employ any of his employees for a workweek longer than forty hours unless such employee receives compensation at a rate not less than one and one-half times the regular rate.",
      },
      {
        id: "irm-4-23-class",
        agency: "irm",
        ref: "IRM 4.23.5",
        title: "Worker classification",
        plain: "How the IRS decides if you're really an employee or a contractor.",
        excerpt:
          "The determination of whether a worker is an employee or independent contractor is based on common-law factors regarding behavioral control, financial control, and the relationship of the parties.",
      },
      {
        id: "ecfr-541",
        agency: "ecfr",
        ref: "29 CFR Part 541",
        title: "White-collar exemptions",
        plain: "Defines who actually qualifies as an 'exempt' executive, professional, or administrator.",
        excerpt:
          "An employee shall be deemed employed in a bona fide executive capacity only if the employee is compensated on a salary basis at a rate of not less than the applicable threshold.",
      },
    ],
    connections: [
      { from: "flsa-206", to: "flsa-207", label: "minimum-wage base for" },
      { from: "flsa-207", to: "ecfr-541", label: "exemption rules in" },
      { from: "flsa-207", to: "irm-4-23-class", label: "depends on classification under" },
    ],
    glossary: [
      { term: "Exempt employee", meaning: "Workers excluded from overtime pay, usually salaried managers/professionals." },
      { term: "Misclassification", meaning: "Treating an employee as a contractor to avoid taxes and protections." },
    ],
    related: ["side-hustle-taxes", "selling-online"],
  },
];

export function getTopic(slug: string) {
  return TOPICS.find((t) => t.slug === slug);
}

export type SearchHit = {
  topicSlug: string;
  topicTitle: string;
  topicEmoji: string;
  kind: "topic" | "citation" | "term";
  label: string;
  detail: string;
  agency?: keyof typeof AGENCIES;
  citationId?: string;
  score: number;
};

function scoreField(field: string, q: string): number {
  const f = field.toLowerCase();
  const i = f.indexOf(q);
  if (i === -1) return 0;
  if (f === q) return 100;
  if (i === 0) return 60;
  return 30;
}

export function searchAll(query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];

  for (const t of TOPICS) {
    const titleScore = scoreField(t.title, q) * 1.5;
    const oneLinerScore = scoreField(t.oneLiner, q);
    const questionScore = scoreField(t.question, q);
    const storyScore = t.story.toLowerCase().includes(q) ? 15 : 0;
    const topScore = titleScore + oneLinerScore + questionScore + storyScore;
    if (topScore > 0) {
      hits.push({
        topicSlug: t.slug,
        topicTitle: t.title,
        topicEmoji: t.emoji,
        kind: "topic",
        label: t.title,
        detail: t.oneLiner,
        score: topScore + 5,
      });
    }

    for (const c of t.citations) {
      const s =
        scoreField(c.title, q) * 1.2 +
        scoreField(c.ref, q) * 1.4 +
        scoreField(c.plain, q) +
        (c.excerpt.toLowerCase().includes(q) ? 18 : 0);
      if (s > 0) {
        hits.push({
          topicSlug: t.slug,
          topicTitle: t.title,
          topicEmoji: t.emoji,
          kind: "citation",
          label: `${c.ref} — ${c.title}`,
          detail: c.plain,
          agency: c.agency,
          citationId: c.id,
          score: s,
        });
      }
    }

    for (const g of t.glossary) {
      const s = scoreField(g.term, q) * 1.3 + scoreField(g.meaning, q);
      if (s > 0) {
        hits.push({
          topicSlug: t.slug,
          topicTitle: t.title,
          topicEmoji: t.emoji,
          kind: "term",
          label: g.term,
          detail: g.meaning,
          score: s,
        });
      }
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 40);
}