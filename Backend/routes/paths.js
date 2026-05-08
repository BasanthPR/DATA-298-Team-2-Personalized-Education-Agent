const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Middleware mapping - ALL requests here require a valid token
router.use(requireAuth);

// GET /api/paths - Get all paths for the authenticated user
router.get('/', asyncRoute(async (req, res) => {
    const paths = await prisma.learningPath.findMany({
        where: { userId: req.user.userId },
        include: { milestones: true },
        orderBy: { createdAt: 'desc' }
    });
    // Convert topics JSON string back to array for the frontend
    const serializedPaths = paths.map(p => ({
        ...p,
        milestones: p.milestones.map(m => ({
            ...m,
            topics: JSON.parse(m.topics)
        }))
    }));
    res.json(serializedPaths);
}));

// POST /api/paths - Create a new path and its milestones
router.post('/', asyncRoute(async (req, res) => {
    const { topic, milestones, graphData } = req.body;
    
    if (!topic || !milestones) {
        return res.status(400).json({ error: 'Missing topic or milestones data' });
    }

    const newPath = await prisma.learningPath.create({
        data: {
            userId: req.user.userId,
            topic,
            graphData,
            milestones: {
                create: milestones.map((m, index) => ({
                    title: m.title,
                    topics: JSON.stringify(m.topics),
                    content: m.content || null,
                    progress: m.progress || 0,
                    locked: index === 0 ? false : true,
                    hasFinetuning: m.hasFinetuning || false
                }))
            }
        },
        include: { milestones: true }
    });

    const serializedPath = {
        ...newPath,
        milestones: newPath.milestones.map(m => ({ ...m, topics: JSON.parse(m.topics) }))
    };
    
    res.status(201).json(serializedPath);
}));

// PUT /api/paths/milestone/:id - Update milestone content (e.g. after generating detailed content)
router.put('/milestone/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { detailedContent, progress, completed, locked } = req.body;

    const dataToUpdate = {};
    if (detailedContent !== undefined) dataToUpdate.detailedContent = detailedContent;
    if (progress !== undefined) dataToUpdate.progress = progress;
    if (completed !== undefined) dataToUpdate.completed = completed;
    if (locked !== undefined) dataToUpdate.locked = locked;

    const updated = await prisma.milestone.update({
        where: { id },
        data: dataToUpdate
    });
    
    res.json({ ...updated, topics: JSON.parse(updated.topics) });
}));

// PUT /api/paths/:id - Update path (e.g. graphData scores)
router.put('/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { graphData } = req.body;

    const path = await prisma.learningPath.findUnique({ where: { id } });
    if (!path || path.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Not authorized to update this path' });
    }

    const updated = await prisma.learningPath.update({
        where: { id },
        data: { graphData }
    });
    
    res.json(updated);
}));

// DELETE /api/paths/:id - Delete a learning path and its milestones
router.delete('/:id', asyncRoute(async (req, res) => {
    const { id } = req.params;
    
    // Ensure the path belongs to the user
    const path = await prisma.learningPath.findUnique({ where: { id } });
    if (!path || path.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Not authorized to delete this path' });
    }

    // Delete milestones first due to foreign key constraints, then the path
    await prisma.milestone.deleteMany({ where: { pathId: id } });
    await prisma.learningPath.delete({ where: { id } });

    res.json({ message: 'Path deleted successfully' });
}));

module.exports = router;
