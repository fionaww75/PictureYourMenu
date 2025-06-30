import express from 'express';
import dotenv from 'dotenv';
import dishRoute from './routes/dishRoute.js';
import cors from 'cors';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api', dishRoute);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});