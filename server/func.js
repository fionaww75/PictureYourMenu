import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';

const { GOOGLE_API_KEY, GOOGLE_CX, GCP_LOCATION, GCP_PROJECT_ID, GOOGLE_SERVICE_ACCOUNT } = process.env;

const imageCache = {};
const location = GCP_LOCATION;
const projectId = GCP_PROJECT_ID;
const keyFile = path.join('./service-account.json');

// ✅ Step 1: Write the service account key from env var if needed
if (GOOGLE_SERVICE_ACCOUNT && !fs.existsSync(keyFile)) {
  console.log('[Init] Writing service-account.json from environment variable...');
  fs.writeFileSync(keyFile, Buffer.from(GOOGLE_SERVICE_ACCOUNT, 'base64'));
}

export async function searchGoogleImages(dish) {
  if (imageCache[dish]) {
    console.log(`[Cache Hit] Returning cached images for: ${dish}`);
    return imageCache[dish];
  }

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(dish + ' dish')}&cx=${GOOGLE_CX}&key=${GOOGLE_API_KEY}&searchType=image&num=10`;

  try {
    const res = await fetch(url);
    const resClone = res.clone();

    const data = await res.json();

    // ❗ Move this check here — after parsing JSON
    if (data.error?.errors?.[0]?.reason === 'dailyLimitExceeded') {
      console.error('🚫 Google API quota exceeded.');
      return {
        images: [],
        error: 'Google API usage limit reached today. Try again tomorrow!',
      };
    }

    if (!res.ok) {
      const errorText = await resClone.text();
      console.error(`❌ HTTP ${res.status}`, errorText);
      return { images: [], error: 'Failed to fetch images.' };
    }

    const blockedDomains = [
      'lookaside.', 'instagram.com', 'tiktok.com',
      'facebook.com', 'pinterest.com', 'twitter.com'
    ];

    const cleanImages = (data.items || [])
      .map(item => item.link)
      .filter(link => link && !blockedDomains.some(domain => link.includes(domain)));

    let selectedImages = cleanImages.slice(0, 3);

    if (selectedImages.length === 0 && data.items?.length) {
      console.warn(`⚠️ No clean image found. Using fallback(s).`);
      selectedImages = data.items.slice(0, 3).map(item => item.link);
    }

    if (selectedImages.length) {
      console.log(`✅ Selected images for "${dish}":`, selectedImages);
    } else {
      console.error(`❌ No image found for "${dish}".`);
    }

    imageCache[dish] = selectedImages;
    return { images: selectedImages };
  } catch (err) {
    console.error(`[X] Failed to fetch images for "${dish}":`, err);
    return {
      images: [],
      error: 'Image search failed. Note that you need a out-of-china IP address to use this service.',
    };
  }
}

export async function extractDishesFromImage(imagePath) {
  console.log('🧠 Extracting dishes from image...');
  const auth = new GoogleAuth({
    keyFile,
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  console.log('GCP project:', projectId);
  console.log('Location:', location);

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: { mimeType: 'image/jpeg', data: imageBase64 },
          },
          {
            text: `
You are a smart assistant helping extract clean, searchable dish names from a restaurant menu image.

Instructions:
- Return only a JSON array of dish names.
- Dish names should be **short, generic, and commonly recognizable**.
- Remove text like:
  - Descriptions (“BIO”, “à partager... ou pas”)
  - Portion sizes or marketing words
  - Special formatting or emojis
- Prefer names that would yield **reliable search results** (e.g., “Entrecôte”, “Tiramisu”).

Example:
["Entrecôte", "La Côte de bœuf", "Risotto aux champignons"]
`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  console.log('📩 Got response from Gemini API.');
  const rawText = await res.text();
  
  if (!res.ok) {
    console.error(`❌ Gemini error: ${res.status} - ${rawText}`);

    // Handle known quota errors
    if (res.status === 429 || rawText.includes('quota')) {
      return {
        dishes: [],
        error: 'API usage limit reached today. Try again tomorrow!',
      };
    }

    return {
      dishes: [],
      error: 'Gemini API returned an error. Try again later.',
    };
  }

  let rawResult;
  try {
    rawResult = JSON.parse(rawText);
  } catch (err) {
    console.error('❌ Failed to parse Gemini API response JSON:', rawText);
    return {
      dishes: [],
      error: 'Gemini response was invalid. Please try with a clearer image.',
    };
  }

  const finishReason = rawResult.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    console.warn('⚠️ Gemini stopped early due to token limit. Output may be incomplete.');
  }

  let content = rawResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('📦 Gemini raw text output:\n', content);

  // Clean the response
  content = content
    .replace(/```json|```/g, '')
    .replace(/\n/g, '')
    .replace(/\\"/g, "'")
    .replace(/""/g, '"')
    .replace(/"([^"]*)"\s*"/g, '"$1 ')
    .trim();

  if (!content.trim().startsWith('[')) {
    return {
      dishes: [],
      error: 'Could not extract dish names — Can you upload a simpler or higher quality image?',
    };
  }

  if (!content.endsWith(']')) {
    content = content.replace(/,\s*$/, '');
    content += ']';
  }

  try {
    const parsed = JSON.parse(content);
    if (!parsed.length) {
      return {
        dishes: [],
        error: 'Can you upload a simpler or higher quality image?',
      };
    }

    console.log('✅ Extracted dish names:', parsed);
    return { dishes: parsed };
  } catch (err) {
    console.error('❌ Final parse failed:', content);
    return {
      dishes: [],
      error: 'Can you upload a simpler or higher quality image?',
    };
  }
}