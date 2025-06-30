import { extractDishesFromImage } from './server/geminiDishExtractor.js';

const testImage = './test_menu/Restaurant-Menu-Template-edit-online.png'; // replace with your image path

extractDishesFromImage(testImage)
  .then(dishes => {
    console.log('✅ Gemini dish names:\n', dishes);
  })
  .catch(err => {
    console.error('❌ Gemini test failed:', err);
  });