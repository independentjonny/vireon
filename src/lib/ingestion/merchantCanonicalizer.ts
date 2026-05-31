const MERCHANT_MAP: Record<string, string> = {
  woolworths: "Woolworths",
  woolies: "Woolworths",
  coles: "Coles",
  aldi: "Aldi",
  netflix: "Netflix",
  "netflix.com": "Netflix",
  spotify: "Spotify",
  "spotify ab": "Spotify",
  amazon: "Amazon",
  "amazon au": "Amazon",
  "amzn": "Amazon",
  apple: "Apple",
  "apple.com": "Apple",
  "itunes": "Apple",
  google: "Google",
  "google*": "Google",
  microsoft: "Microsoft",
  "msft": "Microsoft",
  uber: "Uber",
  "uber eats": "Uber Eats",
  shell: "Shell",
  "7-eleven": "7-Eleven",
  bp: "BP",
  medibank: "Medibank",
  bupa: "Bupa",
  ahm: "AHM",
  anz: "ANZ Bank",
  cba: "Commonwealth Bank",
  nab: "NAB",
  westpac: "Westpac",
  paypal: "PayPal",
  "paypal*": "PayPal",
};

const NOISE_PATTERNS = [
  /\s+\d{4,}/g,
  /\bref\s*#?\w+/gi,
  /\btxn\s*#?\w+/gi,
  /\bcard\s*\d+/gi,
  /\*+/g,
];

export function canonicalizeMerchant(raw: string): string {
  let cleaned = raw.trim().toLowerCase();

  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  for (const [key, canonical] of Object.entries(MERCHANT_MAP)) {
    if (cleaned.startsWith(key) || cleaned.includes(key)) {
      return canonical;
    }
  }

  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function getMerchantCategory(canonical: string): string {
  const CATEGORY_MAP: Record<string, string> = {
    Woolworths: "Groceries",
    Coles: "Groceries",
    Aldi: "Groceries",
    Netflix: "Entertainment",
    Spotify: "Entertainment",
    Amazon: "Shopping",
    Apple: "Technology",
    Google: "Technology",
    Microsoft: "Technology",
    Uber: "Transport",
    "Uber Eats": "Food & Dining",
    Shell: "Transport",
    BP: "Transport",
    Medibank: "Health",
    Bupa: "Health",
    AHM: "Health",
    PayPal: "Shopping",
  };
  return CATEGORY_MAP[canonical] || "Uncategorised";
}
