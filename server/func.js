import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const imageCache = {};
const { GOOGLE_API_KEY, GOOGLE_CX } = process.env;

export async function searchGoogleImage(dish) {
  if (imageCache[dish]) return imageCache[dish];

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(dish + ' dish')}&cx=${GOOGLE_CX}&key=${GOOGLE_API_KEY}&searchType=image&num=1`;

  const res = await fetch(url);
  const data = await res.json();
  const image = data.items?.[0]?.link || null;
  imageCache[dish] = image;
  return image;
}