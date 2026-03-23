const pool = require('../config/db');
const bcrypt = require('bcrypt');


function isAdmin(req) {
    return req.user && req.user.role === 'admin';
}

// Lấy danh sách tài khoản
async function getListUsers(req,res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({status: 'error',message:'Access denied'});
        }
        const result = await pool.query(`SELECT id, username, email, role, phone_number FROM users ORDER BY id DESC`);
        return res.status(200).json({status: 'success', data: result.rows});
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Lấy thông tin tài khoản theo id
async function getUserById(req, res) {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({status: 'error',message:'Access denied'});
        }
        const userId = req.params.id;
        const result = await pool.query(`SELECT id, username, email, role, phone_number FROM users WHERE id = $1`, [userId]);
        if (!result.rows.length) {
            return res.status(404).json({status: 'error', message: 'User not found'});
        }
        return res.status(200).json({status: 'success', data: result.rows[0]});
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Thêm tài khoản
async function addUser(req, res){
    try {
        if (!isAdmin(req)){
            return res.status(403).json({status: 'error', message: 'Access denied'});
        }
        const { username, email, password, role, phone_number } = req.body;
        if(!username || !email || !password || !role){
            return res.status(400).json({status: 'error', message: 'Missing required fields'});
        }
        const existingUser = await pool.query(`SELECT 1 FROM users WHERE username = $1 OR email = $2`, [username.trim(), email.trim()]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({status: 'error', message: 'Username or email already exists'});
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(`INSERT INTO users (username, email, password, role, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [username.trim(), email.trim(), hashedPassword, role, phone_number]);
        return res.status(201).json({status: 'success', message: 'User added successfully', data: result.rows[0].id});
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Sửa tài khoản
async function updateUser(req, res){
    try {
        if (!isAdmin(req)){
            return res.status(403).json({status: 'error', message: 'Access denied'});
        }
        const userId = req.params.id;
        const{username, email, role, phone_number} = req.body;
        // Kiểm tra xem tài khoản có tồn tại hay không

        const userCheck = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
        if(!userCheck.rows.length){
            return res.status(404).json({status: 'error', message: 'User not found'});
        }
        if(username || email){
            const existingUser = await pool.query(`SELECT 1 FROM users WHERE (username = $1 OR email = $2) AND id != $3`, [username.trim(), email.trim(), userId]);
            if(existingUser.rows.length){
                return res.status(400).json({status: 'error', message: 'Username or email already exists'});
            }
        }

        await pool.query(`UPDATE users SET username = $1, email = $2, role = $3, phone_number = $4 WHERE id = $5`, [username, email, role, phone_number, userId]);
        return res.status(200).json({status: 'success', message: 'User updated successfully'});

    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Xóa tài khoản
async function deleteUser(req, res){
    try {
        if (!isAdmin(req)){
            return res.status(403).json({status: 'error', message: 'Access denied'});
        }
        const userId = req.params.id;
        await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
        return res.status(200).json({status: 'success', message: 'User deleted successfully'});
    } catch (error) {
        return res.status(500).json({status: 'error', message: error.message});
    }
}

module.exports = {
    getListUsers,
    getUserById,
    addUser,
    updateUser,
    deleteUser
}