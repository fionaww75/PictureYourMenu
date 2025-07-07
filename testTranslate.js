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
  const testDishes_long = [
    "Entrecôte",
    "Tiramisu",
    "Côtes de Provence Rosé",
    "Pappardelle Maison",
    "Soupe de Poissons de Roche",
    "Tarte aux pommes",
    "Ratatouille",
    "Confit de canard",
    "Foie gras",
    "Bouillabaisse",
    "Croque Monsieur",
    "Crème brûlée",
    "Salade niçoise",
    "Cassoulet",
    "Boeuf bourguignon",
    "Quiche Lorraine",
    "Moules frites",
    "Poulet basquaise",
    "Gratin dauphinois",
    "Steak tartare",
    "Camembert rôti",
    "Pain perdu",
    "Choucroute garnie",
    "Magret de canard",
    "Gâteau au chocolat"
  ];

  const translations = await translateDishNames(testDishes_long);
  console.log('\n🈶 Translations:\n');
  testDishes_long.forEach((dish, i) => {
    console.log(`${dish} ➜ ${translations[i] || '[No translation]'}`);
  });
})();