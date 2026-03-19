import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateLogo() {
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

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
