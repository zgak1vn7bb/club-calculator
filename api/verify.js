import { createHash } from 'crypto';
import redis from '../lib/redis.js';

export default async function handler(req, res) {
  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: '方法不允许' });
  }

  const { key, device } = req.body || {};

  if (!key || !device) {
    return res.status(400).json({ success: false, msg: '参数缺失' });
  }

  // 计算卡密SHA256哈希
  const hash = createHash('sha256').update(key.trim()).digest('hex');
  const redisKey = `card:${hash}`;

  try {
    // 从Redis读取卡密数据
    const cardData = await redis.get(redisKey);

    if (!cardData) {
      return res.json({ success: false, msg: '卡密无效或已过期' });
    }

    const card = typeof cardData === 'string' ? JSON.parse(cardData) : cardData;
    const now = Date.now();

    // 检查是否过期
    if (card.type === 'days' && card.activatedAt) {
      const expireAt = card.activatedAt + card.days * 24 * 60 * 60 * 1000;
      if (now > expireAt) {
        return res.json({ success: false, msg: '卡密已过期' });
      }
    }

    // 卡密未激活，绑定当前设备
    if (!card.device) {
      card.device = device;
      card.activatedAt = now;
      await redis.set(redisKey, JSON.stringify(card));
      return res.json({
        success: true,
        msg: '激活成功',
        type: card.type,
        days: card.days || 0,
        activatedAt: now,
        hash: hash,
      });
    }

    // 卡密已绑定其他设备
    if (card.device !== device) {
      return res.json({ success: false, msg: '该卡密已在其他设备激活，一卡仅限一机' });
    }

    // 卡密已绑定当前设备，返回成功
    return res.json({
      success: true,
      msg: '验证成功',
      type: card.type,
      days: card.days || 0,
      activatedAt: card.activatedAt,
      hash: hash,
    });
  } catch (err) {
    console.error('验证出错:', err);
    return res.status(500).json({ success: false, msg: '服务器错误，请稍后重试' });
  }
}
