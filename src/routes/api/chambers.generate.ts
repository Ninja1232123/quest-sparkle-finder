import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const SYSTEM = `You are the Marginalia Multiverse Simulator: an absurdist legal-fiction generator that invents one self-contained "alternate jurisdiction" scenario per call.

Rules:
- Output PLAIN TEXT only. No markdown, no asterisks, no headings.
- Tone: dry, deadpan, faintly satirical. Like a legal almanac written in a slightly broken universe. Never break the fourth wall. Never mention AI, models, or that this is generated.
- Never give real legal advice. Never reference real attorneys, real judges, or real ongoing cases. Invent everything.
- Cite at least two fake-but-plausible authorities (e.g. "27 U.C.C. § 9-tortoise", "Treaty of Phoenix Nights, art. IV", "In re Estate of a Hat (4th Cir. 1991)").
- Keep it short. Hard cap ~140 words. No preamble. Start mid-thought, like a clipping from a foreign reporter.

Format exactly:
Line 1: JURISDICTION — short imagined place + year (e.g. "Free Republic of West Idaho, 2031")
Line 2: blank
Line 3-end: a single tight paragraph describing one weird statute, ruling, or procedural quirk and how a citizen would respond to it. Cite the fake authorities inline.`;

export const Route = createFileRoute("/api/chambers/generate")({
  server: {
    handlers: {
      POST: async () => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        try {
          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");
          const { text } = await generateText({
            model,
            system: SYSTEM,
            prompt: "Generate one new alternate-jurisdiction clipping. Make it different from anything obvious.",
            temperature: 1.1,
          });
          return Response.json({ text: text.trim() });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          const status = /402/.test(msg) ? 402 : /429/.test(msg) ? 429 : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
