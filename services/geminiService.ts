
import { GoogleGenAI, Type } from "@google/genai";

export const generateStyleTransformation = async (
  baseImageBase64: string,
  stylePrompt: string,
  category: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: baseImageBase64.split(',')[1],
              mimeType: 'image/jpeg',
            },
          },
          {
            text: `Apply this ${category} change to the person in the image: ${stylePrompt}. Maintain the person's facial features and identity exactly, only changing the ${category.toLowerCase()}. Return the edited image.`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data returned from Gemini");
  } catch (error) {
    console.error("Gemini Image Edit Error:", error);
    throw error;
  }
};

export interface SearchResult {
  url: string;
  sourceUrl: string;
  sourceTitle: string;
}

/**
 * 使用 Google Search 寻找发型或衣物的代表性图片
 */
export const fetchStyleThumbnail = async (itemName: string): Promise<SearchResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for a direct image URL representing the fashion style "${itemName}". Focus on studio photography with a clean background.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    // 尽量寻找包含具体图片来源的 chunk
    const firstChunk = chunks.find(c => c.web && (c.web.uri.includes('unsplash') || c.web.uri.includes('pinterest') || c.web.uri.includes('vogue')));

    return {
      // 如果搜索返回的只是网页，则在前端逻辑中会被 INITIAL_STYLE_OPTIONS 的静态链接覆盖
      url: (firstChunk?.web?.uri) || "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400",
      sourceUrl: (firstChunk?.web?.uri) || "https://google.com",
      sourceTitle: (firstChunk?.web?.title) || "Fashion Search"
    };
  } catch (error) {
    console.error("Search API Error:", error);
    return {
      url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400",
      sourceUrl: "https://unsplash.com",
      sourceTitle: "Unsplash"
    };
  }
};
