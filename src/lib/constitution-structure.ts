// Static editorial structure for the U.S. Constitution.
//
// The corpus stores the Constitution as 35 flat documents (preamble + 7
// articles + 27 amendments) keyed by identifier, e.g. /us/const/article/1.
// The operative text is authoritative; these labels are the *editorial*
// layer — the plain-English nicknames a reader scans by ("The Legislative
// Branch", "Freedom of speech…"). The Constitution doesn't change, so this is
// stable reference data, not something to fetch.

export type ConstKind = "preamble" | "article" | "amendment";

export type ConstRef = { kind: ConstKind; num: number };

// Parse a const reader identifier into {kind, num}. Tolerates the leading
// slash and the /us/const/ prefix.
export function parseConstIdentifier(identifier: string): ConstRef | null {
  const s = identifier.replace(/^\//, "");
  if (/(^|\/)const\/preamble$/.test(s)) return { kind: "preamble", num: 0 };
  const a = s.match(/(^|\/)const\/article\/(\d+)$/);
  if (a) return { kind: "article", num: Number(a[2]) };
  const m = s.match(/(^|\/)const\/amendment\/(\d+)$/);
  if (m) return { kind: "amendment", num: Number(m[2]) };
  return null;
}

// Article → plain-English name, the branch/topic it establishes, and its
// section count (fixed; matches the parsed source — Articles V–VII are single
// undivided passages, so 0 means "no numbered sections").
export const ARTICLE_NAMES: Record<number, { title: string; gist: string; sections: number }> = {
  1: { title: "The Legislative Branch", gist: "Congress — its powers and limits", sections: 10 },
  2: { title: "The Executive Branch", gist: "The President and the executive power", sections: 4 },
  3: { title: "The Judicial Branch", gist: "The Supreme Court and treason", sections: 3 },
  4: { title: "The States", gist: "Full faith & credit, new states, federalism", sections: 4 },
  5: { title: "Amendment Process", gist: "How the Constitution is changed", sections: 0 },
  6: { title: "Supreme Law of the Land", gist: "Debts, supremacy, and oaths", sections: 0 },
  7: { title: "Ratification", gist: "How the Constitution was adopted", sections: 0 },
};

// Amendment → short plain-English subject. Used on the amendment chips.
export const AMENDMENT_NAMES: Record<number, string> = {
  1: "Speech, religion, press & assembly",
  2: "Right to bear arms",
  3: "Quartering of soldiers",
  4: "Search & seizure",
  5: "Due process & self-incrimination",
  6: "Right to a speedy, fair trial",
  7: "Civil trial by jury",
  8: "No cruel & unusual punishment",
  9: "Rights retained by the people",
  10: "Powers reserved to the states",
  11: "Suits against the states",
  12: "Electing the President & VP",
  13: "Abolition of slavery",
  14: "Citizenship, due process & equal protection",
  15: "The right to vote — race",
  16: "Federal income tax",
  17: "Direct election of Senators",
  18: "Prohibition of liquor",
  19: "Women's right to vote",
  20: "Terms of office — the “lame duck”",
  21: "Repeal of Prohibition",
  22: "Presidential term limits",
  23: "Electors for Washington, D.C.",
  24: "Abolition of the poll tax",
  25: "Presidential succession & disability",
  26: "The voting age — eighteen",
  27: "Congressional pay raises",
};

export function romanForAmendment(n: number): string {
  const map = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ] as const;
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

// The Bill of Rights is amendments I–X; everything after is "later".
export const BILL_OF_RIGHTS = Array.from({ length: 10 }, (_, i) => i + 1);
export const LATER_AMENDMENTS = Array.from({ length: 17 }, (_, i) => i + 11);
