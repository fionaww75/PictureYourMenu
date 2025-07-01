import { searchGoogleImage } from './server/func.js';
import dotenv from 'dotenv';
dotenv.config();

const testDishes = ['EMPANADA HUMITA & ALBAHACA', 'Accras de haddock fumé, mayonnaise au curry, gingembre et citron vert', 'طاجين السمك بالبصل و الزبيب'];

async function testMultipleDishes() {
  for (const dish of testDishes) {
    try {
      const url = await searchGoogleImage(dish);
      console.log(`✅ Image URL for "${dish}":\n${url}\n`);
    } catch (err) {
      console.error(`❌ Failed to fetch image for "${dish}":`, err);
    }
  }
}

testMultipleDishes();