import { searchGoogleImage } from './server/func.js';
import dotenv from 'dotenv';
dotenv.config();

// const testDishes =[
//   'Hure de tête de veau',
//   'Huitres',
//   'Tête de veau',
//   'Rognon de veau',
//   'Blanquette de veau',
//   'Filet de bœuf',
//   'Sélection de fromages',
//   'Café gourmand',
//   'Thé',
//   'La Côte de bœuf',
//   "L'Entrecôte"
// ];
const testDishes = ['Hure de tête de veau gratinée', 'sauce ravigote']

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