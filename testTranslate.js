import { translateDishNames } from './server/func.js'; // or the appropriate path
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  const testDishes = [
    "Entrecôte",
    "Tiramisu",
    "Côtes de Provence Rosé",
    "Pappardelle Maison",
    "Soupe de Poissons de Roche"
  ];

  const translations = await translateDishNames(testDishes);
  console.log('\n🈶 Translations:\n');
  testDishes.forEach((dish, i) => {
    console.log(`${dish} ➜ ${translations[i] || '[No translation]'}`);
  });
})();