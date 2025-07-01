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

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(dish + ' dish')}&cx=${GOOGLE_CX}&key=${GOOGLE_API_KEY}&searchType=image&num=1`;
  console.log(`[1] Fetching image for dish: "${dish}"`);
  console.log(`[2] Request URL: ${url}`);

  try {
    const res = await fetch(url);
    console.log('[3] Got response from Google Images API.');

    const data = await res.json();
    const image = data.items?.[0]?.link || null;

    if (image) {
      console.log(`[4] Found image for "${dish}": ${image}`);
    } else {
      console.warn(`[4] No image found for "${dish}".`);
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
Extract dish names only from this menu image and return a valid JSON array.

Guidelines:
- No descriptions, categories, or explanations
- Just a clean JSON array of dish names
- If the menu is bilingual, keep only the dish names in the **first-listed language**.
- If the menu includes section names(e.g. "Appetizers", "Main Courses", "Desserts"), ignore them.
- Keep the output short and within model limits
- Do not include Markdown formatting like \`\`\`

Example:
["Dish 1", "Dish 2", "Dish 3"]
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