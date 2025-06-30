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
  if (imageCache[dish]) return imageCache[dish];

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(dish + ' dish')}&cx=${GOOGLE_CX}&key=${GOOGLE_API_KEY}&searchType=image&num=1`;

  const res = await fetch(url);
  const data = await res.json();
  const image = data.items?.[0]?.link || null;
  imageCache[dish] = image;
  return image;
}

export async function extractDishesFromImage(imagePath) {
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
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: 'Extract only dish names from this menu image. Respond as a JSON array.' }
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
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

  const rawText = await res.text();

  if (!res.ok) {
    console.error('[Gemini API Error]', res.status, rawText);
    throw new Error(`HTTP ${res.status}: ${rawText}`);
  }

  let content = JSON.parse(rawText).candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  content = content.replace(/```json|```/g, '').trim();

  return JSON.parse(content);
}