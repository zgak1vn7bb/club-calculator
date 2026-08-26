import redis from '../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: '方法不允许' });
  }

  const { hash, device } = req.body || {};

  if (!hash || !device) {
    return res.status(400).json({ success: false, msg: '参数缺失' });
  }

  const redisKey = `card:${hash}`;

  try {
    const cardData = await redis.get(redisKey);

    if (!cardData) {
      return res.json({ valid: false, msg: '卡密不存在' });
    }

    const card = typeof cardData === 'string' ? JSON.parse(cardData) : cardData;
    const now = Date.now();

    // 检查设备是否匹配
    if (card.device !== device) {
      return res.json({ valid: false, msg: '设备不匹配，请重新激活' });
    }

    // 检查是否过期
    if (card.type === 'days' && card.activatedAt) {
      const expireAt = card.activatedAt + card.days * 24 * 60 * 60 * 1000;
      if (now > expireAt) {
        return res.json({ valid: false, msg: '卡密已过期' });
      }
      const remainMs = expireAt - now;
      const remainHours = Math.ceil(remainMs / (1000 * 60 * 60));
      return res.json({
        valid: true,
        type: card.type,
        days: card.days,
        activatedAt: card.activatedAt,
        expireAt: expireAt,
        remainHours: remainHours,
      });
    }

    // 永久卡
    return res.json({
      valid: true,
      type: 'perm',
      activatedAt: card.activatedAt,
    });
  } catch (err) {
    console.error('检查出错:', err);
    return res.status(500).json({ valid: false, msg: '服务器错误' });
  }
}
