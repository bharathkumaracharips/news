import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import newsRoutes from './routes/newsRoutes';
import { errorHandler } from './middleware/errorHandler';
import { initIngestionScheduler, runIngestionNow, selfHealDatabaseArticles } from './jobs/ingestionJob';

// Load environmental variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Global Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', newsRoutes);

// Base Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  console.log(`⚡️ [server]: Server is running at http://localhost:${PORT}`);
  
  // Trigger database self-healing check on startup to fix any missing full-text contents
  selfHealDatabaseArticles().catch(err => {
    console.error('❌ [server]: Startup database self-heal failed:', err.message);
  });

  // Initialize dynamic background news syncing scheduler
  initIngestionScheduler();

  // Proactively run an initial live news sync on server startup asynchronously
  console.log('⚡️ [server]: Initiating initial live news ingestion...');
  runIngestionNow();
});
