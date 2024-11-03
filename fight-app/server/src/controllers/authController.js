const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authController = {
    // Register new user
    async register(req, res) {
        try {
            const { username, email, password } = req.body;
            
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            
            // Insert user into database
            const query = `
                INSERT INTO users (username, email, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id, username, email
            `;
            
            const result = await pool.query(query, [username, email, passwordHash]);
            
            // Create JWT token
            const token = jwt.sign(
                { id: result.rows[0].id },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                user: result.rows[0],
                token
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Login user
    async login(req, res) {
        try {
            const { email, password } = req.body;
            
            // Find user
            const query = `
                SELECT * FROM users
                WHERE email = $1
            `;
            
            const result = await pool.query(query, [email]);
            
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            const user = result.rows[0];
            
            // Verify password
            const validPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Create JWT token
            const token = jwt.sign(
                { id: user.id },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            // Update last login
            await pool.query(
                'UPDATE users SET last_login = NOW() WHERE id = $1',
                [user.id]
            );
            
            res.json({
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                },
                token
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = authController; 