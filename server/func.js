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

export async function searchGoogleImage(dish) {
  if (imageCache[dish]) {
    console.log(`[Cache Hit] Returning cached image for: ${dish}`);
    return imageCache[dish];
  }

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(dish + ' dish')}&cx=${GOOGLE_CX}&key=${GOOGLE_API_KEY}&searchType=image&num=10`;

  try {
    const res = await fetch(url);
    const resClone = res.clone();

    if (!res.ok) {
      const errorText = await resClone.text();
      console.error(`❌ HTTP ${res.status}`, errorText);
      return null;
    }

    const data = await res.json();
    const fallbackImage = data.items?.[0]?.link || null;
    const blockedDomains = ['instagram.com', 'tiktok.com', 'facebook.com', 'pinterest.com', 'twitter.com'];
    const firstValid = data.items?.find(item =>
      !blockedDomains.some(domain => item.link.includes(domain))
    );

    const image = firstValid?.link || fallbackImage;

    if (firstValid) {
      console.log(`✅ Selected non-blocked image: ${firstValid.link}`);
    } else if (fallbackImage) {
      console.log('[Debug] All returned image URLs:', data.items?.map(i => i.link));
      console.warn(`⚠️ No clean image found. Using fallback: ${fallbackImage}`);
    } else {
      console.log('[Debug] All returned image URLs:', data.items?.map(i => i.link));
      console.error(`❌ No image found for: ${dish}`);
    }

    if (image) {
      console.log(`Found image for "${dish}": ${image}`);
    } else {
      console.warn(`No image found for "${dish}".`);
    }

    imageCache[dish] = image;
    return image;
  } catch (err) {
    console.error(`[X] Failed to fetch image for "${dish}":`, err);
    return null;
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
  let rawResult;

  try {
    rawResult = JSON.parse(rawText);
  } catch (err) {
    console.error('❌ Failed to parse Gemini API response JSON:', rawText);
    throw err;
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

  // Auto-close broken arrays
  if (!content.trim().startsWith('[')) {
    console.warn('⚠️ Gemini output was empty or not a JSON array. Returning empty dish list.');
    return {
      dishes: [],
      error: 'Gemini returned no usable output. Please try a smaller/clearer menu.'
    };  // graceful fallback instead of throwing
  }
  if (!content.endsWith(']')) {
    content = content.replace(/,\s*$/, '');
    content += ']';
  }

  try {
    const parsed = JSON.parse(content);
    if (finishReason === 'MAX_TOKENS') {
      console.warn(`⚠️ Parsed incomplete dish list (${parsed.length} items).`);
    }
    console.log('✅ Extracted dish names:', parsed);
    return parsed;
  } catch (err) {
    console.error('❌ Final parse failed:', content);
    throw err;
  }
}