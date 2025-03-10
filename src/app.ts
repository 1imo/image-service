import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mediaRoutes from './routes/mediaRoutes';

/**
 * Image Service Application
 * 
 * Handles media file uploads, storage, and retrieval for the PapStore system.
 * Features:
 * - File upload with size and type validation
 * - In-memory caching with 2-hour TTL
 * - Service-to-service authentication
 * - Company-based access control
 */

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3006;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/media', mediaRoutes);

/**
 * Health check endpoint
 * @route GET /health
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

/**
 * Global error handler
 */
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Image service listening on port ${port}`);
});

export default app; 