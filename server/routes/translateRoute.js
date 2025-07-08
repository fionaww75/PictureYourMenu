import express from 'express';
import { translateDishNames } from '../func.js';

const router = express.Router();
router.post('/translate', async (req, res) => {
    const { dishes } = req.body;
  
    if (!Array.isArray(dishes) || dishes.length === 0) {
      return res.status(400).json({ error: 'No dishes provided' });
    }
  
    try {
      const translations = await translateDishNames(dishes);
      res.json(translations); // returns flat array
    } catch (err) {
      console.error('[Translation Error]', err.message);
      res.status(500).json({ error: 'Translation failed' });
    }
  });

  export default router;