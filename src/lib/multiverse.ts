// Port of the Python multiverse explorer — seeded, deterministic.

export type BranchType =
  | "QUANTUM"
  | "CHOICE"
  | "COSMIC"
  | "HISTORICAL"
  | "PHYSICAL";

export const BRANCH_TYPE_LABEL: Record<BranchType, string> = {
  QUANTUM: "Quantum Decoherence",
  CHOICE: "Conscious Decision",
  COSMIC: "Cosmic Event",
  HISTORICAL: "Historical Divergence",
  PHYSICAL: "Physical Constants",
};

const DIVERGENCE: Record<BranchType, string[]> = {
  QUANTUM: [
    "Schrödinger's cat lived",
    "Schrödinger's cat died",
    "Photon went left at the double-slit",
    "Photon went right at the double-slit",
    "Electron tunneled through the barrier",
    "Electron reflected off the barrier",
    "Radioactive atom decayed 1 second earlier",
    "Quantum fluctuation created extra matter",
    "Vacuum state collapsed differently",
    "Measurement occurred 1 planck time later",
  ],
  CHOICE: [
    "You chose the other option",
    "That person said yes instead of no",
    "The coin landed on the other side",
    "A different sperm reached the egg",
    "The job interview went differently",
    "They didn't send that message",
    "The relationship continued",
    "They took a different path home",
    "A single neuron fired differently",
    "The dream was remembered",
  ],
  COSMIC: [
    "The asteroid missed Earth",
    "The asteroid hit Earth harder",
    "The Sun formed 2% larger",
    "The Moon never formed",
    "Jupiter migrated inward",
    "A nearby supernova sterilized Earth",
    "Dark matter clumped differently",
    "The Big Bang was slightly hotter",
    "Inflation lasted 0.0001 seconds longer",
    "Antimatter won over matter",
  ],
  HISTORICAL: [
    "Rome never fell",
    "The Library of Alexandria survived",
    "The printing press invented 500 years earlier",
    "World War I never happened",
    "The dinosaurs survived",
    "Neanderthals became dominant",
    "Agriculture developed in Australia first",
    "The Black Death killed 99%",
    "Electricity discovered in ancient Greece",
    "Humans evolved in the Americas",
  ],
  PHYSICAL: [
    "Gravity is 50% stronger",
    "Speed of light is doubled",
    "Electrons are heavier",
    "The weak force doesn't exist",
    "Protons decay in 10^10 years",
    "There are 4 spatial dimensions",
    "Time runs backwards",
    "Entropy decreases",
    "The universe has no dark energy",
    "Photons have mass",
  ],
};

const DOMINANT_LIFE = [
  "Carbon-based humanoids",
  "Silicon-based crystalline entities",
  "Plasma beings in stellar atmospheres",
  "Hive-mind fungal networks",
  "Machine consciousness",
  "Quantum probability clouds",
  "Magnetic field organisms",
  "Pure energy beings",
  "Aquatic super-intelligence",
  "Viral collective consciousness",
  "Plant-based sentience",
  "Gaseous neural networks",
];

const TECH_LEVELS = [
  "Type 0 — Pre-industrial",
  "Type 0.5 — Industrial",
  "Type 0.7 — Information Age (like us)",
  "Type I — Planetary civilization",
  "Type II — Stellar civilization",
  "Type III — Galactic civilization",
  "Type IV — Universal manipulation",
  "Type V — Multiverse travelers",
  "Type Ω — Reality programmers",
];

const FATES: [string, string][] = [
  ["Heat Death", "Eternal cold darkness"],
  ["Big Rip", "Space tears itself apart"],
  ["Big Crunch", "Collapse back to singularity"],
  ["Big Bounce", "Endless cycles of rebirth"],
  ["Vacuum Decay", "Physics rewrites itself"],
  ["Big Freeze", "Time itself stops"],
  ["Entropy Reversal", "Infinite complexity"],
  ["Dimensional Collapse", "Spacetime folds"],
  ["Consciousness Singularity", "Mind becomes reality"],
  ["Unknown", "Beyond prediction"],
];

const SPECIAL_NOTES = [
  "Humans never evolved here",
  "Earth is a gas giant here",
  "The Sun went supernova already",
  "Life evolved on Mars instead",
  "Dolphins became the dominant species",
  "AI achieved consciousness in 1956",
  "Nuclear war occurred in 1983",
  "First contact happened in 2019",
  "Faster-than-light travel was discovered",
  "Time travel is common here",
  "Death was cured 200 years ago",
  "Money was never invented",
  "All humans are telepathic",
  "Music was never discovered",
  "Mathematics works differently",
  "Dreams are a shared dimension",
  "Ghosts are scientifically verified",
  "The simulation was proven",
  "Nothing remarkable — eerily similar to yours",
];

// Mulberry32 — small, fast, deterministic
function makeRng(seed: number) {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min: number, max: number) {
      return min + this.next() * (max - min);
    },
    int(min: number, max: number) {
      return Math.floor(this.range(min, max + 1));
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
  };
}
type Rng = ReturnType<typeof makeRng>;

export type Physics = {
  gravity: number;
  lightSpeed: number;
  atomicBinding: number;
  darkEnergy: number;
  stable: boolean;
  lifePossible: boolean;
  intelligencePossible: boolean;
};

export type Branch = {
  branchId: string;
  seed: number;
  branchType: BranchType;
  divergencePoint: string;
  physics: Physics;
  ageBillionYears: number;
  galaxies: number;
  stars: number;
  habitableWorlds: number;
  lifeBearingWorlds: number;
  civilizations: number;
  fate: string;
  fateDescription: string;
  timeRemaining: number;
  dominantLifeForm: string;
  technologyLevel: string;
  hasContactedOtherBranches: boolean;
  specialNote: string;
};

function genPhysics(rng: Rng, type: BranchType): Physics {
  let gravity, lightSpeed, atomicBinding, darkEnergy: number;
  if (type === "PHYSICAL") {
    gravity = rng.range(0.1, 3.0);
    lightSpeed = rng.range(0.3, 3.0);
    atomicBinding = rng.range(0.2, 2.5);
    darkEnergy = rng.range(0.1, 5.0);
  } else {
    gravity = rng.range(0.9, 1.1);
    lightSpeed = rng.range(0.95, 1.05);
    atomicBinding = rng.range(0.9, 1.1);
    darkEnergy = rng.range(0.8, 1.2);
  }
  const stable =
    gravity > 0.3 && gravity < 2.5 && atomicBinding > 0.5 && atomicBinding < 1.8;
  const lifePossible = stable && atomicBinding > 0.6 && atomicBinding < 1.5;
  const intelligencePossible = lifePossible && gravity > 0.8 && gravity < 1.5;
  return { gravity, lightSpeed, atomicBinding, darkEnergy, stable, lifePossible, intelligencePossible };
}

function branchId(seed: number): string {
  // 8 hex chars from a hash-ish mix of the seed
  let x = seed >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x = (x ^ (x >>> 16)) >>> 0;
  const hex = x.toString(16).padStart(8, "0").toUpperCase();
  return `Ω-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export function generateBranch(seed?: number): Branch {
  const s = seed ?? Math.floor(Math.random() * 0xffffffff);
  const rng = makeRng(s);
  const type = rng.pick<BranchType>(["QUANTUM", "CHOICE", "COSMIC", "HISTORICAL", "PHYSICAL"]);
  const physics = genPhysics(rng, type);

  let age = 0,
    galaxies = 0,
    stars = 0,
    habitable = 0,
    life = 0,
    civs = 0,
    dominant = "None — unstable universe",
    tech = "N/A — No intelligence";

  if (!physics.stable) {
    age = rng.range(0, 0.001);
  } else {
    age = rng.range(5, 50);
    galaxies = Math.floor(age * 1e10 * physics.gravity);
    stars = galaxies * rng.int(100_000_000, 400_000_000_000);
    if (physics.lifePossible) {
      habitable = Math.floor(stars * 0.0001 * physics.atomicBinding);
      life = age > 2 ? Math.floor(habitable * rng.range(0.001, 0.1)) : 0;
      if (physics.intelligencePossible && life > 0 && age > 4) {
        civs = Math.floor(life * rng.range(0.00001, 0.01));
        dominant = rng.pick(DOMINANT_LIFE);
        tech = rng.pick(TECH_LEVELS);
      } else {
        dominant = rng.pick(["Microbial only", "Simple multicellular", "None yet"]);
      }
    } else {
      habitable = Math.floor(stars * 0.00001);
      dominant = "None — chemistry incompatible";
    }
  }

  const [fate, fateDesc] = rng.pick(FATES);
  const timeRemaining = physics.stable ? rng.range(age, age * 100) : 0;
  const special = rng.pick(SPECIAL_NOTES);
  const contacted = civs > 1000 && rng.next() < 0.1;

  return {
    branchId: branchId(s),
    seed: s,
    branchType: type,
    divergencePoint: rng.pick(DIVERGENCE[type]),
    physics,
    ageBillionYears: age,
    galaxies,
    stars,
    habitableWorlds: habitable,
    lifeBearingWorlds: life,
    civilizations: civs,
    fate,
    fateDescription: fateDesc,
    timeRemaining,
    dominantLifeForm: dominant,
    technologyLevel: tech,
    hasContactedOtherBranches: contacted,
    specialNote: special,
  };
}

export const HOME_BRANCH: Branch = {
  branchId: "Ω-HOME-0000",
  seed: 0,
  branchType: "QUANTUM",
  divergencePoint: "This is the branch you're reading from",
  physics: {
    gravity: 1, lightSpeed: 1, atomicBinding: 1, darkEnergy: 1,
    stable: true, lifePossible: true, intelligencePossible: true,
  },
  ageBillionYears: 13.8,
  galaxies: 200_000_000_000,
  stars: 7e22,
  habitableWorlds: 40_000_000_000,
  lifeBearingWorlds: 1,
  civilizations: 1,
  fate: "Heat Death",
  fateDescription: "Eternal cold darkness",
  timeRemaining: 1e14,
  dominantLifeForm: "Carbon-based humanoids",
  technologyLevel: "Type 0.7 — Information Age (like us)",
  hasContactedOtherBranches: false,
  specialNote: "This is your universe.",
};

export function formatBig(n: number): string {
  if (n === 0) return "0";
  if (n >= 1e21) return `${(n / 1e21).toFixed(1)} sextillion`;
  if (n >= 1e18) return `${(n / 1e18).toFixed(1)} quintillion`;
  if (n >= 1e15) return `${(n / 1e15).toFixed(1)} quadrillion`;
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)} trillion`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString();
}
