import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// SIGNUP
router.post('/signup', async (req, res) => {
    try {
        const { pan, name, email, dob } = req.body;

        if (!pan || !name || !email || !dob) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { pan } });
        if (existingUser) {
            return res.status(400).json({ error: 'An account with this PAN already exists.' });
        }

        // Generate password from DOB
        const dobParts = dob.split('-'); // [YYYY, MM, DD]
        if (dobParts.length !== 3) {
            return res.status(400).json({ error: 'Invalid Date of Birth format.' });
        }
        const generatedPassword = `${dobParts[2]}${dobParts[1]}${dobParts[0]}`;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(generatedPassword, salt);

        // Save user
        const newUser = await prisma.user.create({
            data: {
                pan,
                name,
                email,
                dob,
                passwordHash: hashedPassword
            }
        });

        res.status(201).json({ message: 'Account application received successfully.' });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // Find user by PAN or Email
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { pan: username },
                    { email: username }
                ]
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Set JWT in HTTP-only cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 3600000 // 1 hour
        });

        res.json({
            message: 'Login successful',
            user: {
                name: user.name,
                email: user.email,
                pan: user.pan
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// LOGOUT
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logged out successfully' });
});

// VERIFY SESSION
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { name: true, email: true, pan: true } // Don't send password hash
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;
