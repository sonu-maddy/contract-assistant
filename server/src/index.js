import express from 'express';
import { logger } from './logger.js';
import healthRouter from './routes/health.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use('/health', healthRouter);

app.listen(port, () => {
  logger.info({ port }, 'Contract Assistant server started');
});
