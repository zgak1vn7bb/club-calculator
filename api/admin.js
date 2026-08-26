import { createHash } from 'crypto';
import redis from '../lib/redis.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 3) key += '-';
  }
  return key;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, msg: '方法不允许' });

  const { action, password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ success: false, msg: '管理员密码错误' });
  }

  try {
    if (action === 'generate') {
      const { type = 'days', days = 1, count = 10 } = req.body;
      const keys = [];
      for (let i = 0; i < count; i++) {
        const key = generateKey();
        const hash = createHash('sha256').update(key).digest('hex');
        const cardData = { type, days: type === 'days' ? days : 0, device: '', activatedAt: 0 };
        await redis.set(`card:${hash}`, JSON.stringify(cardData));
        keys.push({ key, hash, type, days });
      }
      return res.json({ success: true, keys });
    }

    if (action === 'list') {
      // 列出所有卡密（扫描key）
      const keys = [];
      let cursor = 0;
      do {
        const [nextCursor, batch] = await redis.scan(cursor, { match: 'card:*', count: 100 });
        for (const k of batch) {
          const data = await redis.get(k);
          if (data) {
            const card = typeof data === 'string' ? JSON.parse(data) : data;
            keys.push({ hash: k.replace('card:', ''), type: card.type, days: card.days, device: card.device ? '已激活' : '未激活', activatedAt: card.activatedAt });
          }
        }
        cursor = nextCursor;
      } while (cursor !== 0);
      return res.json({ success: true, cards: keys, total: keys.length });
    }

    if (action === 'delete') {
      const { hash } = req.body;
      await redis.del(`card:${hash}`);
      return res.json({ success: true, msg: '已删除' });
    }

    return res.status(400).json({ success: false, msg: '未知操作' });
  } catch (err) {
    console.error('管理操作出错:', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
}
