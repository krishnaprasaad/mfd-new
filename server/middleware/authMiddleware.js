import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security.js';

export const authMiddleware = (req, res, next) => {
    try {
        const token = req.cookies.auth_token;

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, getJwtSecret());
        req.userId = decoded.userId;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
