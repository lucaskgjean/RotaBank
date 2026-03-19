import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing. Logo generation will be disabled.");
      return null;
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

const FALLBACK_LOGO = `data:image/svg+xml;base64,${btoa(`
<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="24" fill="#10B981"/>
  <path d="M30 70L50 30L70 70" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M40 55H60" stroke="white" stroke-width="8" stroke-linecap="round"/>
</svg>
`)}`;

const CACHE_KEY = "rotabank_logo_cache";

export async function generateLogo() {
  // Check cache first
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) return cached;

  const ai = getAiClient();
  if (!ai) return FALLBACK_LOGO;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: "A modern, minimalist logo symbol for a fintech app. The logo should be an abstract icon ONLY, with NO text or names. It should feature a symbol representing a path or growth that evokes financial security. Use a vibrant emerald green and slate grey color palette. Professional, clean lines, high resolution, vector style, isolated on a white background.",
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const logoData = `data:image/png;base64,${part.inlineData.data}`;
          localStorage.setItem(CACHE_KEY, logoData);
          return logoData;
        }
      }
    }
  } catch (error: any) {
    // Check if it's a quota error (429)
    if (error?.message?.includes("429") || error?.status === 429) {
      console.warn("Gemini API quota exceeded. Using fallback logo.");
    } else {
      console.error("Error generating logo:", error);
    }
  }
  
  return FALLBACK_LOGO;
}
