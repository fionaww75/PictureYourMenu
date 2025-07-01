import express from 'express';
import multer from 'multer';
import { extractDishesFromImage } from '../func.js';
import { searchGoogleImage } from '../func.js';
import fs from 'fs';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

console.log('[Backend] /api/dishes hit');
router.post('/dishes', upload.single('image'), async (req, res) => {
  const imagePath = req.file.path;

  try {
    const dishes = await extractDishesFromImage(imagePath);
    const results = {};

    for (const [i, dish] of dishes.entries()) {
      console.log('[Backend] Searching for image of number', i, '–', dish);
      const image = await searchGoogleImage(dish);
      results[dish] = image;
    }

    fs.unlinkSync(imagePath); // cleanup
    res.json(results);
  } catch (err) {
    console.error('[Backend Error]', err.stack || err.message || err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;