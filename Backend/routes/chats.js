const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

// GET /api/chats/:milestoneId - Get chat history for a milestone
router.get('/:milestoneId', asyncRoute(async (req, res) => {
    const { milestoneId } = req.params;
    const chats = await prisma.chatMemory.findMany({
        where: { 
            userId: req.user.userId,
            contextRef: milestoneId 
        },
        orderBy: { createdAt: 'asc' }
    });
    res.json(chats);
}));

// GET /api/chats/:milestoneId/threads - Get grouped threads for modal chats
router.get('/:milestoneId/threads', asyncRoute(async (req, res) => {
    const { milestoneId } = req.params;
    const chats = await prisma.chatMemory.findMany({
        where: { 
            userId: req.user.userId,
            OR: [
                { contextRef: milestoneId },
                { contextRef: { startsWith: `${milestoneId}_selection_` } }
            ]
        },
        orderBy: { createdAt: 'asc' }
    });
    
    // Group them uniquely into threads
    const threads = {};
    chats.forEach(chat => {
        if (!threads[chat.contextRef]) {
            threads[chat.contextRef] = [];
        }
        threads[chat.contextRef].push(chat);
    });
    
    res.json(threads);
}));

// GET /api/chats/:milestoneId/visualize-threads - Get grouped visualize threads
router.get('/:milestoneId/visualize-threads', asyncRoute(async (req, res) => {
    const { milestoneId } = req.params;
    const chats = await prisma.chatMemory.findMany({
        where: { 
            userId: req.user.userId,
            contextRef: { startsWith: `${milestoneId}_visualize_` }
        },
        orderBy: { createdAt: 'asc' }
    });
    
    const threads = {};
    chats.forEach(chat => {
        if (!threads[chat.contextRef]) {
            threads[chat.contextRef] = [];
        }
        threads[chat.contextRef].push(chat);
    });
    
    res.json(threads);
}));

// POST /api/chats - Save a new chat message
router.post('/', asyncRoute(async (req, res) => {
    const { role, content, contextRef } = req.body;
    
    const newChat = await prisma.chatMemory.create({
        data: {
            userId: req.user.userId,
            role,
            content,
            contextRef
        }
    });
    
    res.status(201).json(newChat);
}));

module.exports = router;
