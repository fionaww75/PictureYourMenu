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
    console.log('[Backend] Extracting dishes from image');
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

    if (geminiError) {
      console.warn('[Gemini Error]', geminiError);
    }

    const imagePromises = dishNames.map(async (dish, i) => {
      try {
        console.log('[Backend] Searching for image of number', i, '–', dish);
        const imageResult = await searchGoogleImages(dish);
    
        const imageArray = Array.isArray(imageResult)
          ? imageResult
          : imageResult?.images || [];
    
        const result = {
          images: imageArray
        };
    
        if (imageArray.length === 0) {
          result.error = 'No suitable image found.';
        }
    
        return { dish, result };
      } catch (err) {
        console.error(`[Image Search Error for "${dish}"]`, err.message);
        return {
          dish,
          result: {
            images: [],
            error: 'Image search failed. Possibly due to API limits.'
          }
        };
      }
    });
    
    const resolvedImages = await Promise.all(imagePromises);
    
    // Merge into `results` object
    const results = {};
    for (const { dish, result } of resolvedImages) {
      results[dish] = result;
    }

    if (geminiError && dishNames.length === 0) {
      return res.status(200).json({
        'Menu Parsing Error': {
          images: [],
          error: geminiError
        }
      });
    }
    console.log('[✔️ Final response to frontend]');
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

