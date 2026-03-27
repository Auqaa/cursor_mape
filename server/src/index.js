import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connect } from './config/db.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api', routes);
app.use(errorHandler);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

connect()
  .then(() => {
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });

