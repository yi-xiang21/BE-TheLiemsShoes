const pool = require('../config/db');
const bcrypt = require('bcrypt');


function isAdmin(req) {
    return req.user && req.user.role === 'admin';
}

// Lấy danh sách tài khoản
async function getListUsers(req,res) {
    try {
        // if (!isAdmin(req)) {
        //     return res.status(403).json({status: 'error',message:'Access denied'});
        // }
        const [rows] = await pool.execute(`SELECT id, username, email, role, phone_number FROM users ORDER BY id DESC`);
        return res.status(200).json({status: 'success', data: rows});
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Thêm tài khoản
async function addUser(req, res){
    try {
        // if(!isAdmin(req)){
        //     return res.status(403).json({status: 'error', message: 'Access denied'});
        // }
        const { username, email, password, role, phone_number } = req.body;
        if(!username || !email || !password || !role){
            return res.status(400).json({status: 'error', message: 'Missing required fields'});
        }
        const [existingUser] = await pool.execute(`SELECT 1 FROM users WHERE username = ? AND email = ?`, [username.trim(), email.trim()]);
        if (existingUser.length > 0) {
            return res.status(400).json({status: 'error', message: 'Username or email already exists'});
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(`INSERT INTO users (username, email, password, role, phone_number) VALUES (?, ?, ?, ?, ?)`, [username.trim(), email.trim(), hashedPassword, role, phone_number]);
        return res.status(201).json({status: 'success', message: 'User added successfully', data: result.insertId});
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Sửa tài khoản
async function updateUser(req, res){
    try {
        // if(!isAdmin(req)){
        //     return res.status(403).json({status: 'error', message: 'Access denied'});
        // }
        const userId = req.params.id;
        const{username, email, role, phone_number} = req.body;
        // Kiểm tra xem tài khoản có tồn tại hay không

        const [rows] = await pool.execute(`SELECT * FROM users WHERE id = ?`, [userId]);
        if(!rows.length){
            return res.status(404).json({status: 'error', message: 'User not found'});
        }
        if(username || email){
            const [existingUser] = await pool.execute(`SELECT 1 FROM users WHERE (username = ? OR email = ?) AND id = ?`, [username.trim(), email.trim(), userId]);
            if(existingUser.length){
                return res.status(400).json({status: 'error', message: 'Username or email already exists'});
            }
        }

        const [result] = await pool.execute(`UPDATE users SET username = ?, email = ?, role = ?, phone_number = ? WHERE id = ?`, [username, email, role, phone_number, userId]);
        return res.status(200).json({status: 'success', message: 'User updated successfully'});

    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}

// Xóa tài khoản
async function deleteUser(req, res){
    try {
        // if(!isAdmin(req)){
        //     return res.status(403).json({status: 'error', message: 'Access denied'});
        // }
        const userId = req.params.id;
        const [result] = await pool.execute(`DELETE FROM users WHERE id = ?`, [userId]);
        return res.status(200).json({status: 'success', message: 'User deleted successfully'});
    } catch (error) {
        return res.status(500).json({status: 'error', message: error.message});
    }
}

module.exports = {
    getListUsers,
    addUser,
    updateUser,
    deleteUser
}