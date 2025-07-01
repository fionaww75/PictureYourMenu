import { extractDishesFromImage } from './server/func.js';
import dotenv from 'dotenv';
dotenv.config();

const imagePath = './test_menu/menu_2.jpeg'; // ← Replace with your image path

(async () => {
  try {
    console.log('Extracting dishes from image...');
    const dishes = await extractDishesFromImage(imagePath);
    console.log('\n✅ Extracted Dishes:', dishes);
  } catch (err) {
    console.error('❌ Gemini test failed:', err);
  }
})();