import { searchGoogleImage } from './server/func.js';
import dotenv from 'dotenv';
dotenv.config();

const testDishes =[
  'Hure de tête de veau gratinée, sauce ravigote',
  "Huitres bio de l'île d'Oléron, nées en pleine mer, N°3 fines de claires",
  'Tête de veau et ses légumes, sauce gribiche',
  "Rognon de veau sauce moutarde à l'ancienne, purée maison",
  'Blanquette de veau, riz pilaf',
  'Filet de bœuf bio aux poivres',
  'Sélection de fromages des fermes du Puy-de-Dôme',
  'Café gourmand',
  'La Côte de bœuf BIO à partager',
  "L'Entrecôte BIO à partager...ou pas"
];

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