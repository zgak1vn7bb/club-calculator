const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ===== 数据文件 =====
const DATA_FILE = path.join(__dirname, 'data', 'keys.json');

// 默认管理员密码（部署后请修改）
const DEFAULT_ADMIN_PASS = 'admin888';

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('读取数据文件失败:', e.message);
    }
    return { keys: [], adminPassword: DEFAULT_ADMIN_PASS };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('保存数据文件失败:', e.message);
    }
}

// 生成随机卡密: XXXX-XXXX-XXXX-XXXX
function generateKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易混淆的0O1I
    let key = '';
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars[Math.floor(Math.random() * chars.length)];
        }
        if (i < 3) key += '-';
    }
    return key;
}

// ===== 卡密验证API =====
app.post('/api/verify', (req, res) => {
    const { key, deviceId } = req.body;

    if (!key || !deviceId) {
        return res.json({ success: false, message: '参数不完整' });
    }

    const data = loadData();
    const keyUpper = key.trim().toUpperCase();
    const record = data.keys.find(k => k.key === keyUpper);

    if (!record) {
        return res.json({ success: false, message: '卡密不存在，请联系QQ：3676023445' });
    }

    if (record.status === 'banned') {
        return res.json({ success: false, message: '该卡密已被封禁' });
    }

    const now = new Date();

    if (record.status === 'unused') {
        // 首次激活，绑定设备
        record.status = 'active';
        record.deviceId = deviceId;
        record.activatedAt = now.toISOString();
        saveData(data);
        return res.json({
            success: true,
            message: '激活成功',
            expireAt: record.expireDays
                ? new Date(now.getTime() + record.expireDays * 86400000).toISOString()
                : null
        });
    }

    if (record.status === 'active') {
        // 检查设备绑定
        if (record.deviceId !== deviceId) {
            return res.json({ success: false, message: '该卡密已在其他设备激活，无法换机使用' });
        }

        // 检查过期
        if (record.expireDays && record.activatedAt) {
            const expireTime = new Date(record.activatedAt).getTime() + record.expireDays * 86400000;
            if (now.getTime() > expireTime) {
                return res.json({ success: false, message: '该卡密已过期，请联系QQ：3676023445续费' });
            }
            return res.json({
                success: true,
                message: '验证成功',
                expireAt: new Date(expireTime).toISOString()
            });
        }

        // 永久卡密
        return res.json({ success: true, message: '验证成功', expireAt: null });
    }

    return res.json({ success: false, message: '卡密状态异常' });
});

// ===== 管理后台API =====

// 管理员登录
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const data = loadData();
    if (password === data.adminPassword) {
        const token = crypto.randomBytes(32).toString('hex');
        data.adminToken = token;
        saveData(data);
        return res.json({ success: true, token });
    }
    res.json({ success: false, message: '密码错误' });
});

// 验证管理员token中间件
function authAdmin(req, res, next) {
    const token = req.headers['x-admin-token'];
    const data = loadData();
    if (token && token === data.adminToken) {
        next();
    } else {
        res.json({ success: false, message: '未授权，请先登录' });
    }
}

// 获取卡密列表
app.get('/api/admin/keys', authAdmin, (req, res) => {
    const data = loadData();
    const keys = data.keys.map(k => ({
        ...k,
        expireAt: k.activatedAt && k.expireDays
            ? new Date(new Date(k.activatedAt).getTime() + k.expireDays * 86400000).toISOString()
            : null
    }));
    res.json({ success: true, keys });
});

// 批量生成卡密
app.post('/api/admin/generate', authAdmin, (req, res) => {
    const { count, expireDays, note } = req.body;
    const num = Math.min(Math.max(parseInt(count) || 1, 1), 100);
    const days = parseInt(expireDays) || 0; // 0=永久

    const data = loadData();
    const newKeys = [];
    for (let i = 0; i < num; i++) {
        let key;
        do {
            key = generateKey();
        } while (data.keys.some(k => k.key === key));

        const record = {
            key,
            status: 'unused',
            deviceId: null,
            createdAt: new Date().toISOString(),
            activatedAt: null,
            expireDays: days,
            note: note || ''
        };
        data.keys.push(record);
        newKeys.push(record);
    }
    saveData(data);
    res.json({ success: true, keys: newKeys });
});

// 封禁/解封卡密
app.post('/api/admin/toggle-ban', authAdmin, (req, res) => {
    const { key } = req.body;
    const data = loadData();
    const record = data.keys.find(k => k.key === key);
    if (!record) {
        return res.json({ success: false, message: '卡密不存在' });
    }
    record.status = record.status === 'banned' ? 'active' : 'banned';
    saveData(data);
    res.json({ success: true, status: record.status });
});

// 删除卡密
app.post('/api/admin/delete', authAdmin, (req, res) => {
    const { key } = req.body;
    const data = loadData();
    const idx = data.keys.findIndex(k => k.key === key);
    if (idx === -1) {
        return res.json({ success: false, message: '卡密不存在' });
    }
    data.keys.splice(idx, 1);
    saveData(data);
    res.json({ success: true });
});

// 修改管理员密码
app.post('/api/admin/change-password', authAdmin, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const data = loadData();
    if (oldPassword !== data.adminPassword) {
        return res.json({ success: false, message: '原密码错误' });
    }
    if (!newPassword || newPassword.length < 4) {
        return res.json({ success: false, message: '新密码至少4位' });
    }
    data.adminPassword = newPassword;
    saveData(data);
    res.json({ success: true });
});

// 统计信息
app.get('/api/admin/stats', authAdmin, (req, res) => {
    const data = loadData();
    const stats = {
        total: data.keys.length,
        unused: data.keys.filter(k => k.status === 'unused').length,
        active: data.keys.filter(k => k.status === 'active').length,
        banned: data.keys.filter(k => k.status === 'banned').length
    };
    res.json({ success: true, stats });
});

app.listen(PORT, () => {
    console.log(`\n=================================`);
    console.log(`  俱乐部大玩家 · 卡密验证系统`);
    console.log(`  服务已启动: http://localhost:${PORT}`);
    console.log(`  管理后台: http://localhost:${PORT}/admin`);
    console.log(`  默认管理员密码: ${DEFAULT_ADMIN_PASS}`);
    console.log(`=================================\n`);
});
