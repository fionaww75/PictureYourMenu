import express from 'express';
import multer from 'multer';
import { extractDishesFromImage } from '../func.js';
import { searchGoogleImages } from '../func.js';
import fs from 'fs';
import { translateDishNames } from '../func.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.post('/dishes', upload.single('image'), async (req, res) => {
  console.log('[Backend] /api/dishes hit');
  const imagePath = req.file.path;

  try {
    const extractionResult = await extractDishesFromImage(imagePath);
    let dishNames = [];
    let geminiError = null;

    // Support both { dishes: [], error: '...' } and raw [] from extractDishesFromImage
    if (Array.isArray(extractionResult)) {
      dishNames = extractionResult;
    } else if (typeof extractionResult === 'object') {
      dishNames = extractionResult.dishes || [];
      geminiError = extractionResult.error || null;
    }

    const translations = await translateDishNames(dishNames);
    const results = {};

    if (geminiError) {
      console.warn('[Gemini Error]', geminiError);
    }

    for (const [i, dish] of dishNames.entries()) {
      console.log('[Backend] Searching for image of number', i, '–', dish);

      try {
        const imageResult = await searchGoogleImages(dish); // could be array OR object
        const translation = translations[i] || '';
      
        // Normalize the image list
        const imageArray = Array.isArray(imageResult)
          ? imageResult
          : imageResult?.images || [];
      
        results[dish] = {
          translation,
          images: imageArray
        };
      
        if (imageArray.length === 0) {
          results[dish].error = 'No suitable image found.';
        }
      } catch (imageErr) {
        console.error(`[Image Search Error for "${dish}"]`, imageErr.message);
        results[dish] = {
          translation: translations[i] || '',
          images: [],
          error: 'Image search failed. Possibly due to API limits.'
        };
      }
    }

    if (geminiError && dishNames.length === 0) {
      return res.status(200).json({
        'Menu Parsing Error': {
          images: [],
          error: geminiError
        }
      });
    }
    console.log('[✔️ Final response to frontend]', results);
    res.json(results);
  } catch (err) {
    console.error('[Backend Error]', err.stack || err.message || err);
    res.status(500).json({ error: 'Something went wrong. Try again later.' });
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
});

export default router;

