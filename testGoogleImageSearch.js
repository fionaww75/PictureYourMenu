import { searchGoogleImage } from './server/googleImageSearch.js';
import dotenv from 'dotenv';
dotenv.config();

const testDish = 'Margherita Pizza';

searchGoogleImage(testDish)
  .then(url => {
    console.log(`✅ Image URL for "${testDish}":\n`, url);
  })
  .catch(err => {
    console.error('❌ Google Image Search test failed:', err);
  });