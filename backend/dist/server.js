"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const newsRoutes_1 = __importDefault(require("./routes/newsRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const ingestionJob_1 = require("./jobs/ingestionJob");
// Load environmental variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// Global Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Routes
app.use('/api', newsRoutes_1.default);
// Base Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
// Error handling middleware
app.use(errorHandler_1.errorHandler);
// Start server
app.listen(PORT, async () => {
    console.log(`⚡️ [server]: Server is running at http://localhost:${PORT}`);
    // Trigger database self-healing check on startup to fix any missing full-text contents
    (0, ingestionJob_1.selfHealDatabaseArticles)().catch(err => {
        console.error('❌ [server]: Startup database self-heal failed:', err.message);
    });
    // Initialize dynamic background news syncing scheduler
    (0, ingestionJob_1.initIngestionScheduler)();
    // Proactively run an initial live news sync on server startup asynchronously
    console.log('⚡️ [server]: Initiating initial live news ingestion...');
    (0, ingestionJob_1.runIngestionNow)();
});
