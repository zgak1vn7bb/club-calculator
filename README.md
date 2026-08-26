# 俱乐部大玩家 · 价值计算器（Vercel版）

带卡密验证的游戏价值计算器，支持一卡一机绑定。

## 功能
- 卡密验证（限时卡/永久卡）
- 一卡一机绑定（设备指纹）
- 卡密管理后台（生成/查看/删除）
- 5张地图数值计算
- 车身池选择
- 预期成交/利润计算

## 部署步骤

### 第一步：注册Upstash（免费Redis数据库）
1. 打开 https://upstash.com，用GitHub账号登录
2. 点击 "Create Database"
3. 名字随便填，区域选 "Washington, D.C." 或就近的
4. 创建后，在详情页找到 "REST API" 部分
5. 复制 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`，后面要用

### 第二步：把代码推到GitHub
1. 在GitHub新建一个仓库（比如叫 club-calculator-v2）
2. 把本目录所有文件上传到仓库

### 第三步：部署到Vercel
1. 打开 https://vercel.com，用GitHub账号登录
2. 点击 "Add New..." → "Project"
3. 选择你刚创建的GitHub仓库，点击 "Import"
4. 配置页面：
   - Framework Preset：选 "Other"
   - Build Command：留空
   - Output Directory：留空
5. 点击 "Environment Variables"，添加3个变量：
   - `UPSTASH_REDIS_REST_URL` = 你从Upstash复制的URL
   - `UPSTASH_REDIS_REST_TOKEN` = 你从Upstash复制的Token
   - `ADMIN_PASSWORD` = 你自己设的管理员密码（比如 abc123）
6. 点击 "Deploy"，等待部署完成

### 第四步：生成卡密
1. 部署完成后，访问 `你的域名/admin.html`
2. 输入你设置的管理员密码
3. 选择卡密类型和数量，点击"生成卡密"
4. 复制生成的明文卡密，发给用户

### 第五步：用户使用
1. 用户访问 `你的域名/`
2. 输入卡密激活
3. 一张卡密只能在一台设备上使用

## 文件说明
- `index.html` - 主页面（计算器+卡密验证）
- `admin.html` - 卡密管理后台
- `api/verify.js` - 卡密验证API
- `api/check.js` - 激活状态检查API
- `api/admin.js` - 管理员操作API
- `lib/redis.js` - Redis连接工具
- `bg.png` - 登录页背景图
