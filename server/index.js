import express from 'express';
import dotenv from 'dotenv';
import dishRoute from './routes/dishRoute.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import translateRoute from './routes/translateRoute.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url} from ${req.ip}`);
  next();
});
app.use(express.static('public'));
app.use(cors());
app.use(express.json());
app.use('/api', dishRoute);
app.use('/api', translateRoute);

app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});