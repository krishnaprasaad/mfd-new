import assert from 'node:assert/strict';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
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

test('CFO rejects OTP-bearing messages before invoking AI or storing conversation history', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret-with-more-than-32-characters';
    try {
        const token = jwt.sign({ userId: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
        const response = await request(createTestApp())
            .post('/api/cfo/chat')
            .set('Cookie', `auth_token=${token}`)
            .send({ message: 'My MF Central OTP is 123456' })
            .expect(400);

        assert.match(response.body.error, /never share an OTP/i);
    } finally {
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    }
});
