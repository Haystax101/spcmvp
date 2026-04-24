export const C = {
  bg: "#FFFEFC",
  card: "#FFFEFC",
  cardWarm: "#FAF5E8",
  cardTinted: "#F9F6EE",
  border: "rgba(0,0,0,0.12)",
  borderStrong: "#1A1A1A",
  text: "#1A1A1A",
  secondary: "#9E9B95",
  muted: "#B0ADA8",
  chevron: "#C0BDB7",
  pill: "#F0ECE4",
  amber: "#F59E0B",
  accentGreen: "#4CAF50",
  greenBg: "#EAF3E0",
  greenText: "#3A7D2B",
  redBg: "#FDEAEA",
  redText: "#C0392B",
  luminaryBg: "#FFF3E0",
  luminaryText: "#B45309",
  zenithBg: "#EDE9FE",
  zenithText: "#5B21B6",
  helpRed: "#E53935",
  inputBg: "#F5F2EA",
  inputBorder: "rgba(0,0,0,0.14)",
};

export const SERIF = "Georgia, 'Times New Roman', serif";
export const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

export const getBonusVoltz = (baseVoltz) => Math.floor(baseVoltz * 0.05);

export const PLANS = {
  spark: {
    id: "spark",
    name: "Spark",
    price: 8.99,
    voltzPerMonth: 300,
    voltzLabel: "300 voltz / month",
    context: "≈ 30 AI searches / month",
    features: [
      "Up to 100 AI searches / month",
      "Priority matching",
      "Message analytics",
      "Advanced compatibility scoring",
    ],
  },
  zenith: {
    id: "zenith",
    name: "Zenith",
    price: 19.99,
    voltzPerMonth: 1000,
    voltzLabel: "1,000 voltz / month",
    context: "≈ unlimited feel",
    features: [
      "Unlimited AI searches",
      "External web search",
      "Advanced compatibility scoring",
      "Early access features",
      "Priority support",
    ],
  },
};

const CONFETTI_COLORS = ["#4CAF50", "#F59E0B", "#5B21B6", "#E53935", "#1A1A1A"];
export const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => {
  const x = (i * 17 + 7) % 100;
  const delay = ((i * 53) % 120) / 100;
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
  const isSquare = i % 3 === 0;
  const width = isSquare ? 6 : 8;
  const height = isSquare ? 6 : 3;
  const rotation = (i * 37) % 360;
  const duration = 2.2 + ((i * 13) % 10) / 10;
  return { x, delay, color, width, height, rotation, duration };
});
