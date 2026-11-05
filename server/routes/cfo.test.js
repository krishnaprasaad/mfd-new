import assert from 'node:assert/strict';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import cfoRoutes from './cfo.js';
import portfolioRoutes from './portfolio.js';

const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/cfo', cfoRoutes);
    app.use('/api/portfolio', portfolioRoutes);
    return app;
};

test('CFO conversation and portfolio transaction endpoints reject unauthenticated access', async () => {
    const app = createTestApp();
    await request(app).get('/api/cfo/history').expect(401);
    await request(app).post('/api/cfo/chat').send({ message: 'Summarize my portfolio' }).expect(401);
    await request(app).get('/api/portfolio/transactions').expect(401);
    await request(app).post('/api/portfolio/transactions').send({}).expect(401);
});
