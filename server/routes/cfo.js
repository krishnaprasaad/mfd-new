import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { connectDB } from '../db.js';
import User from '../models/User.js';
import Investment from '../models/Investment.js';
import CfoConversation from '../models/CfoConversation.js';
import { buildCfoReply } from '../services/cfoAssistant.js';
import { buildCfoConversionContext } from '../services/cfoMarketing.js';
import {
    createCfoAgent,
    getCfoFailureMessage,
    getConfiguredProvider,
    isCfoProviderError,
    isSafeBuiltinFallbackQuestion,
    streamCfoAnswer
} from '../services/cfoAgent.js';
import { openMintoMcp } from '../services/mintoMcp.js';

const router = express.Router();
const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTEXT_MESSAGES = 20;
const MAX_STORED_MESSAGES = 100;

const sendEvent = (res, event) => {
    if (!res.destroyed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
};

router.get('/history', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        const conversation = await CfoConversation.findOne({ userId: req.userId })
            .select('messages updatedAt')
            .lean();
        return res.json({
            messages: (conversation?.messages || []).slice(-MAX_STORED_MESSAGES).map(message => ({
                role: message.role,
                content: message.content,
                createdAt: message.createdAt
            })),
            updatedAt: conversation?.updatedAt || null
        });
    } catch (error) {
        console.error('Loading CFO conversation failed:', error.name || 'UnknownError');
        return res.status(500).json({ error: 'Unable to load your AI CFO conversation.' });
    }
});

router.delete('/history', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        await CfoConversation.deleteOne({ userId: req.userId });
        return res.status(204).end();
    } catch (error) {
        console.error('Deleting CFO conversation failed:', error.name || 'UnknownError');
        return res.status(500).json({ error: 'Unable to clear your AI CFO conversation.' });
    }
});

router.post('/chat', authMiddleware, async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: 'Enter a message of up to 500 characters.' });
    }

    res.status(200);
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();

    const abortController = new AbortController();
    res.on('close', () => {
        if (!res.writableEnded) abortController.abort();
    });

    let mcpClient;
    let configuredProvider;
    try {
        await connectDB();
        const user = await User.findById(req.userId).select('name').lean();
        if (!user) {
            sendEvent(res, { type: 'error', message: 'Your account could not be verified. Please sign in again.' });
            return res.end();
        }
        const [holdings, conversation] = await Promise.all([
            Investment.find({ userId: req.userId })
                .select('fundName category investedAmount currentValue updatedAt')
                .lean(),
            CfoConversation.findOneAndUpdate(
                { userId: req.userId },
                { $setOnInsert: { userId: req.userId, messages: [] } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            )
        ]);

        const storedHistory = conversation.messages
            .slice(-MAX_CONTEXT_MESSAGES)
            .map(item => ({ role: item.role, content: item.content }));
        let conversion = buildCfoConversionContext(message, storedHistory, {
            hasAi: Boolean(getConfiguredProvider())
        });
        configuredProvider = getConfiguredProvider();
        let reply;
        let provider = 'builtin';

        sendEvent(res, { type: 'status', message: 'Understanding your question' });

        if (configuredProvider) {
            try {
                mcpClient = await openMintoMcp();
            } catch (error) {
                console.error('Public fund MCP unavailable:', error.name || 'UnknownError');
                sendEvent(res, {
                    type: 'status',
                    message: 'Public fund research is unavailable; portfolio analysis tools remain available'
                });
            }

            conversion = buildCfoConversionContext(message, storedHistory, {
                hasAi: true,
                hasPublicResearch: Boolean(mcpClient)
            });
            const { agent, tools } = createCfoAgent({
                userId: req.userId,
                userName: user.name,
                mcpClient,
                question: message,
                marketingIntent: conversion.intent
            });
            provider = configuredProvider.name;
            let streamedProviderTokens = false;
            try {
                reply = await streamCfoAnswer({
                    agent,
                    tools,
                    history: storedHistory,
                    question: message,
                    signal: abortController.signal,
                    onEvent: event => {
                        if (event.type === 'token') streamedProviderTokens = true;
                        sendEvent(res, event);
                    }
                });
            } catch (error) {
                if (!isCfoProviderError(error) || !isSafeBuiltinFallbackQuestion(message) ||
                    streamedProviderTokens || abortController.signal.aborted) throw error;

                conversion = buildCfoConversionContext(message, storedHistory, {
                    hasAi: false,
                    hasPublicResearch: false
                });
                sendEvent(res, {
                    type: 'status',
                    message: 'The language model is unavailable; answering with built-in, non-live guidance'
                });
                reply = buildCfoReply({
                    message,
                    history: storedHistory,
                    investments: holdings,
                    userName: user.name
                });
                provider = 'builtin-fallback';
                for (let index = 0; index < reply.length; index += 48) {
                    if (abortController.signal.aborted) return;
                    sendEvent(res, { type: 'token', text: reply.slice(index, index + 48) });
                }
            }
        } else {
            sendEvent(res, {
                type: 'status',
                message: 'Using the built-in assistant; configure AI_PROVIDER and an API key for LangChain tools'
            });
            reply = buildCfoReply({
                message,
                history: storedHistory,
                investments: holdings,
                userName: user.name
            });
            for (let index = 0; index < reply.length; index += 48) {
                if (abortController.signal.aborted) return;
                sendEvent(res, { type: 'token', text: reply.slice(index, index + 48) });
            }
        }

        if (abortController.signal.aborted || res.destroyed) return;
        const messages = [
            { role: 'user', content: message, createdAt: new Date() },
            { role: 'assistant', content: reply, createdAt: new Date() }
        ];
        await CfoConversation.updateOne(
            { userId: req.userId },
            { $push: { messages: { $each: messages, $slice: -MAX_STORED_MESSAGES } } }
        );
        sendEvent(res, {
            type: 'done',
            provider,
            reply,
            intent: conversion.intent,
            actions: conversion.actions
        });
        return res.end();
    } catch (error) {
        if (!abortController.signal.aborted) {
            console.error('AI CFO chat failed:', {
                name: error.name || 'UnknownError',
                code: error.code || error.cause?.code || undefined,
                status: error.status || error.statusCode || error.response?.status || error.cause?.status || undefined,
                provider: configuredProvider?.name || 'builtin'
            });
            sendEvent(res, {
                type: 'error',
                message: getCfoFailureMessage(error)
            });
            return res.end();
        }
    } finally {
        if (mcpClient) {
            try {
                await mcpClient.close();
            } catch (error) {
                console.error('Closing public fund MCP client failed:', error.name || 'UnknownError');
            }
        }
    }
});

export default router;
