const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

function getJwtConfigError() {
    if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
        return 'Server configuration error: JWT_SECRET is missing.';
    }

    return null;
}

function getUserFromAuthHeader(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Unauthorized. Missing or invalid token.' };
    }

    const token = authHeader.split(' ')[1];

    const jwtConfigError = getJwtConfigError();
    if (jwtConfigError) {
        return { error: jwtConfigError };
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return { user: decoded };
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { error: 'Token has expired.' };
        }

        return { error: 'Invalid token.' };
    }
}

// Đăng ký người dùng mới
const register = async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            role,
            phone_number
        } = req.body;

        const normalizedPhone = (phone_number || '').toString().trim();
        const requestedRole = (role || 'customer').toString().trim().toLowerCase();

        if (!username || !email || !password || !normalizedPhone) {
            return res.status(400).json({ message: 'Please provide all required fields.' });
        }

        // Public signup must create customer accounts only.
        if (requestedRole !== 'customer') {
            return res.status(400).json({ message: 'Invalid role for self-registration.' });
        }

        // Validate username
        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
            // Kiểm tra nếu username chứa khoảng trắng
            if (/\s/.test(trimmedUsername)) {
                return res.status(400).json({ message: 'Username must not contain spaces.' });
            }
            return res.status(400).json({ message: 'Username must be between 3 and 20 characters.' });
        }

        // Kiểm tra trùng lặp username và email
        const existingUsernameResult = await pool.query('SELECT id FROM users WHERE username = $1', [trimmedUsername]);
        if (existingUsernameResult.rows.length > 0) {
            return res.status(400).json({ message: 'Username already exists.' });
        }

        // Kiểm tra định dạng email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format.' });
        }

        // Kiểm tra trùng lặp email
        const existingEmailResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingEmailResult.rows.length > 0) {
            return res.status(400).json({ message: 'Email already exists.' });
        }

        // Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);

        // Thêm mới người dùng vào cơ sở dữ liệu
        await pool.query(
            'INSERT INTO users (username, email, password, role, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [trimmedUsername, email, hashedPassword, 'customer', normalizedPhone]
        );

        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        if (error.code === '23505') {
            if (error.constraint && error.constraint.includes('username')) {
                return res.status(400).json({ message: 'Username already exists.' });
            }
            if (error.constraint && error.constraint.includes('email')) {
                return res.status(400).json({ message: 'Email already exists.' });
            }
            return res.status(400).json({ message: 'Duplicate value violates a unique constraint.' });
        }

        res.status(500).json({ message: 'Internal server error.' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide both email and password.' });
        }

        // Kiểm tra xem email có tồn tại trong cơ sở dữ liệu hay không
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Email not found.' });
        }

        // So sánh mật khẩu đã nhập với mật khẩu đã mã hóa trong cơ sở dữ liệu
        const user = userResult.rows[0];
        if (!user.password) {
            return res.status(400).json({ message: 'Account password data is invalid. Please reset password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect password.' });
        }

        const jwtConfigError = getJwtConfigError();
        if (jwtConfigError) {
            return res.status(500).json({ message: jwtConfigError });
        }

        // Tạo token JWT
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
        res.status(200).json({ message: 'Login successful.', token });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

const logout = async (req, res) => {
    try {
        const { error } = getUserFromAuthHeader(req);
        if (error) {
            return res.status(401).json({ message: error });
        }

        return res.status(200).json({ message: 'Logout successful.' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error.' });
    }
};

// Lấy thông tin profile của người dùng đã đăng nhập
const getProfile = async (req, res) => {
    try {
        const auth = getUserFromAuthHeader(req);
        if (auth.error) {
            return res.status(401).json({ message: auth.error });
        }

        const userId = auth.user.id;
        const userResult = await pool.query(
            'SELECT id, username, email, role, phone_number FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        return res.status(200).json({
            message: 'Profile retrieved successfully.',
            user: userResult.rows[0]
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error.' });
    }
};

module.exports = {
    register,
    login,
    logout,
    getProfile
};