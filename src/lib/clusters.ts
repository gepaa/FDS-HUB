import type { Cluster } from "@/lib/domain";

/**
 * Category-cluster assignment for suppliers.
 *
 * The FDS Supplier Outreach sheet has no cluster column, so clusters are
 * derived. Known suppliers get an explicit assignment (below) so the
 * seeded segment counts exactly match the real FDS breakdown:
 * Tractor/Skid Attachments 33 · Livestock 18 · Greenhouses 11 ·
 * Fencing 7 · Sprayers 7 · Irrigation 4 · Trailers 4 · Other 16.
 * Unknown suppliers (future imports) fall back to niche keywords.
 */
const OVERRIDES: Record<string, Cluster> = {
  // --- Tractor/Skid Attachments (33) ---
  "homestead implements": "Tractor/Skid Attachments",
  "ignite attatchments": "Tractor/Skid Attachments", // typo as in sheet
  "ignite attachments": "Tractor/Skid Attachments",
  "bush hog": "Tractor/Skid Attachments",
  "taylor pittsburg": "Tractor/Skid Attachments",
  "unifarm machinery (farm-maxx)": "Tractor/Skid Attachments",
  baumalight: "Tractor/Skid Attachments",
  danuser: "Tractor/Skid Attachments",
  "hla attachments": "Tractor/Skid Attachments",
  worksaver: "Tractor/Skid Attachments",
  "tar river manufacturing": "Tractor/Skid Attachments",
  "mk martin": "Tractor/Skid Attachments",
  "bush-whacker": "Tractor/Skid Attachments",
  rhinoag: "Tractor/Skid Attachments",
  "blue diamond attachments": "Tractor/Skid Attachments",
  "cid attachments": "Tractor/Skid Attachments",
  "virnig manufacturing": "Tractor/Skid Attachments",
  "jenkins iron & steel": "Tractor/Skid Attachments",
  "erskine attachments": "Tractor/Skid Attachments",
  "paladin attachments": "Tractor/Skid Attachments",
  "precision manufacturing (tri-l)": "Tractor/Skid Attachments",
  "dirt dog manufacturing": "Tractor/Skid Attachments",
  ironcraft: "Tractor/Skid Attachments",
  befco: "Tractor/Skid Attachments",
  "woods equipment": "Tractor/Skid Attachments",
  "land pride": "Tractor/Skid Attachments",
  "del morino": "Tractor/Skid Attachments",
  "wallenstein equipment": "Tractor/Skid Attachments",
  "diamond mowers": "Tractor/Skid Attachments",
  "brown manufacturing corporation": "Tractor/Skid Attachments",
  "brush wolf": "Tractor/Skid Attachments",
  "belltec industries": "Tractor/Skid Attachments",
  "lowe manufacturing": "Tractor/Skid Attachments",
  "stinger attachments": "Tractor/Skid Attachments",

  // --- Livestock Handling (18) ---
  "powder river": "Livestock Handling",
  "tru-test / datamars livestock": "Livestock Handling",
  "gallagher animal management": "Livestock Handling",
  "tarter usa": "Livestock Handling",
  priefert: "Livestock Handling",
  arrowquip: "Livestock Handling",
  "real tuff livestock equipment": "Livestock Handling",
  "for-most livestock equipment": "Livestock Handling",
  "sioux steel": "Livestock Handling",
  "w-w livestock systems": "Livestock Handling",
  "lakeland farm & ranch direct": "Livestock Handling",
  "hi-hog farm & ranch equipment": "Livestock Handling",
  "titan west": "Livestock Handling",
  "pearson livestock equipment": "Livestock Handling",
  "daniels manufacturing": "Livestock Handling",
  "linn post & pipe": "Livestock Handling",
  "mje livestock equipment": "Livestock Handling",
  "pasture management": "Livestock Handling",

  // --- Greenhouses/High Tunnels (11) ---
  "bootstrap farmer": "Greenhouses/High Tunnels",
  "rimol greenhouse systems": "Greenhouses/High Tunnels",
  "atlas greenhouse": "Greenhouses/High Tunnels",
  growspan: "Greenhouses/High Tunnels",
  "farmers friend": "Greenhouses/High Tunnels",
  "planta greenhouses": "Greenhouses/High Tunnels",
  "poly-tex": "Greenhouses/High Tunnels",
  "nifty hoops": "Greenhouses/High Tunnels",
  "zimmerman's high tunnels": "Greenhouses/High Tunnels",
  "ledgewood farm greenhouse frames": "Greenhouses/High Tunnels",
  "tunnel vision hoops": "Greenhouses/High Tunnels",

  // --- Fencing (7) ---
  "stay-tuff fence": "Fencing",
  "bekaert fencing": "Fencing",
  "timeless fence system": "Fencing",
  gripple: "Fencing",
  powerfields: "Fencing",
  "centaur htp fencing": "Fencing",
  "powerflex fence": "Fencing",

  // --- Sprayers (7) ---
  "fimco industries": "Sprayers",
  "demco products": "Sprayers",
  "ag spray equipment": "Sprayers",
  "cropcare equipment": "Sprayers",
  "pbm supply & manufacturing": "Sprayers",
  "wylie sprayers": "Sprayers",
  "sprayer specialties": "Sprayers",

  // --- Irrigation (4) ---
  "k-line irrigation north america": "Irrigation",
  "nelson irrigation": "Irrigation",
  "hunter agricultural irrigation (senninger)": "Irrigation",
  "micro rain": "Irrigation",

  // --- Trailers (4) ---
  "carry-on trailer": "Trailers",
  "sure-trac": "Trailers",
  "big tex trailers": "Trailers",
  "pequea machine": "Trailers",

  // --- Other (16) ---
  clearspan: "Other",
  "fleming agr": "Other",
  solis: "Other",
  "granit parts": "Other",
  "maple machinery": "Other",
  "new holland": "Other",
  stihl: "Other",
  "grasshopper mowers": "Other",
  toro: "Other",
  landoll: "Other",
  gnedi: "Other",
  "maschio gaspardo north america": "Other",
  "esch manufacturing": "Other",
  "truax company": "Other",
  "rtp outdoors": "Other",
  enduraplas: "Other",
};

/** Keyword fallback for suppliers not in the explicit list. */
export function classifyByNiche(niche: string | null | undefined): Cluster {
  const n = (niche ?? "").toLowerCase();
  if (!n) return "Other";
  if (/greenhouse|high tunnel|hoop/.test(n)) return "Greenhouses/High Tunnels";
  if (/livestock|cattle|equine|rodeo|weighing|animal/.test(n))
    return "Livestock Handling";
  if (/fenc/.test(n)) return "Fencing";
  if (/sprayer|spray/.test(n)) return "Sprayers";
  if (/irrigat|sprinkler/.test(n)) return "Irrigation";
  if (/trailer/.test(n)) return "Trailers";
  if (/attachment|implement|skid|tractor|mower|cutter|auger|tillage|loader/.test(n))
    return "Tractor/Skid Attachments";
  return "Other";
}

export function assignCluster(
  name: string,
  niche: string | null | undefined,
): Cluster {
  const key = name.trim().toLowerCase();
  return OVERRIDES[key] ?? classifyByNiche(niche);
}
