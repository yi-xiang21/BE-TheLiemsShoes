const jwt = require('jsonwebtoken');

function getTokenFromHeader(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.split(' ')[1];
}

function authenticateToken(req, res, next) {
    const token = getTokenFromHeader(req);

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized. Missing or invalid token.' });
    }

    if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
        return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired.' });
        }

        return res.status(401).json({ message: 'Invalid token.' });
    }
}

function requireAdmin(req, res, next) {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Access denied' });
    }

    return next();
}

module.exports = {
    authenticateToken,
    requireAdmin
};
