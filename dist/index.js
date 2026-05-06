import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({ status: 'Server is running ✅' });
});
// Simple test endpoint
app.post('/api/chat/message', (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    // Simple echo response for now
    res.json({
        message: message,
        response: `I received: "${message}"`,
        timestamp: new Date(),
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Error handler
app.use((err, _req, res, _next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});
// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📝 Try: curl -X POST http://localhost:${PORT}/api/chat/message -H "Content-Type: application/json" -d '{"message":"hello"}'`);
});
export default app;
//# sourceMappingURL=index.js.map