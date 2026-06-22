# 外部服务凭证获取指南

> 你需要提供以下信息，我来完成对接。按优先级排序，标注了"上手难度"和"预计耗时"。

---

## 一、你只需复制粘贴给我（3 项，零门槛）

### 1. JWT_SECRET

| 项目 | 内容 |
|------|------|
| **你需要提供** | 一串随机字符串（64 位十六进制） |
| **获取方式** | 在服务器上运行：`openssl rand -hex 64` |
| **格式** | `a1b2c3d4e5f6...`（128 个字符） |
| **你给我后** | 我填入 `.env` 的 `JWT_SECRET=` 字段，Token 签名即生效 |

### 2. CORS_ORIGINS

| 项目 | 内容 |
|------|------|
| **你需要提供** | 你的前端域名列表 |
| **获取方式** | 你自己决定的，比如 `https://epicshot.com` |
| **格式** | `https://epicshot.com,https://www.epicshot.com,https://admin.epicshot.com` |
| **你给我后** | 我填入 `.env` 的 `CORS_ORIGINS=` 字段 |

### 3. 前端域名（WebSocket 自动适配）

| 项目 | 内容 |
|------|------|
| **你需要提供** | 无（已自动适配） |
| **说明** | 上一轮改动已实现：开发环境自动 `ws://localhost:3000`，生产环境自动 `wss://你的域名/v1/ws` |

---

## 二、你注册服务后告诉我凭证（4 项，需注册开发者账号）

### 4. 微信 OAuth 登录

| 项目 | 内容 |
|------|------|
| **费用** | 300 元/年（企业认证费） |
| **耗时** | 1-3 个工作日（审核时间） |
| **你需要提供** | `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` |
| **获取步骤** | |

```
1. 打开 https://open.weixin.qq.com/
2. 点击「注册」→ 选择「网站应用」
3. 填写企业信息，上传营业执照（需企业资质）
4. 支付 300 元/年认证费
5. 审核通过后，进入「管理中心」→「网站应用」→「创建网站应用」
6. 填写应用信息：
   - 应用名称：易拍选
   - 应用简介：摄影工作室在线审片协作平台
   - 回调域：你的域名（如 api.epicshot.com）
7. 提交审核（1-3 天）
8. 审核通过后，在「应用详情」页获取：
   - AppID：wx开头的一串字符
   - AppSecret：一串32位十六进制字符
```

| 你给我 | 格式示例 | 我填入 |
|--------|----------|--------|
| AppID | `wx1234567890abcdef` | `WECHAT_APP_ID=wx1234567890abcdef` |
| AppSecret | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` | `WECHAT_APP_SECRET=a1b2c3...` |

> **代码已就绪**：配置后无需任何代码改动，`isRealWechat()` 自动返回 true，微信扫码登录即刻生效。

---

### 5. 邮件通知（SMTP）

| 项目 | 内容 |
|------|------|
| **费用** | 免费（200 封/天） |
| **耗时** | 10 分钟 |
| **推荐方案** | 阿里云邮件推送（国内）或 SendGrid（国际） |

#### 方案 A：阿里云邮件推送（推荐，国内用户）

```
1. 打开 https://dm.console.aliyun.com/
2. 点击「新建发信域名」
3. 输入你的域名（如 epicshot.com）
4. 按提示在 DNS 添加 TXT/SPF 验证记录（5 分钟）
5. 验证通过后，进入「发信地址」→「新建发信地址」
6. 设置发信地址：noreply@epicshot.com，回信地址留空
7. 设置 SMTP 密码（记下来！）
8. 获取以下信息：
```

| 你给我 | 在哪里找 | 格式示例 |
|--------|----------|----------|
| SMTP 地址 | 控制台显示 | `smtpdm.aliyun.com` |
| SMTP 端口 | 控制台显示 | `465`（SSL）或 `80`（非SSL） |
| SMTP 账号 | 控制台显示 | 发信地址，如 `noreply@epicshot.com` |
| SMTP 密码 | 创建时设置的那个 | 你设置的密码 |

#### 方案 B：SendGrid（国际用户或简单上手）

```
1. 打开 https://signup.sendgrid.com/
2. 注册账号（免费版 100 封/天）
3. 进入 Settings → API Keys → Create API Key
4. 选择 "Restricted Access" → 勾选 "Mail Send"
5. 复制生成的 API Key
```

| 你给我 | 格式示例 |
|--------|----------|
| API Key | `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

> **代码已就绪**：nodemailer 已集成，配置后任务指派、争议预警、客户申请修改、催稿提醒自动发送邮件。

---

### 6. Sentry 错误监控

| 项目 | 内容 |
|------|------|
| **费用** | 免费（5000 events/月） |
| **耗时** | 5 分钟 |

```
1. 打开 https://sentry.io/
2. 点击「Sign Up」注册（用 GitHub/Google 账号最快）
3. 创建项目：Platform 选「Node.js」→ 项目名填「epicshot-backend」
4. 进入 Settings → Projects → epicshot-backend → Client Keys (DSN)
5. 复制 DSN
```

| 你给我 | 格式示例 |
|--------|----------|
| DSN | `https://xxxxx@o123456.ingest.sentry.io/1234567` |

> **代码已就绪**：server.js 第 75-78 行已集成 Sentry.init()，配置后自动捕获所有未处理异常。

---

### 7. AI 服务（风格样片 + 巡检）

| 项目 | 内容 |
|------|------|
| **费用** | 按量付费（≈0.08-0.15 元/张） |
| **耗时** | 15 分钟 |
| **推荐方案** | 阿里云百炼（DashScope） |

```
1. 打开 https://dashscope.aliyun.com/
2. 用阿里云账号登录（没有的话先注册）
3. 进入「管理中心」→「API-KEY 管理」
4. 点击「创建 API-KEY」
5. 复制生成的 Key
```

| 你给我 | 格式示例 | 我填入 |
|--------|----------|--------|
| API Key | `sk-xxxxxxxxxxxxxxxxxxxxxxxx` | `AI_SERVICE_KEY=sk-xxxxx` |
| 服务地址 | 固定值 | `AI_SERVICE_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation` |

> **代码已就绪**：上一轮已实现真实 HTTP 调用，兼容阿里云百炼/腾讯混元/OpenAI 三种返回格式，含超时+重试。

---

## 三、你提供服务器信息后我帮你配置（3 项，需服务器操作）

### 8. SSL 证书（HTTPS）

| 项目 | 内容 |
|------|------|
| **费用** | 免费（Let's Encrypt） |
| **耗时** | 10 分钟 |

**方式一：Nginx 反向代理（推荐，无需改代码）**

```
在服务器上安装 certbot：
  apt install certbot python3-certbot-nginx
  certbot --nginx -d api.epicshot.com

证书自动续期：
  certbot renew --dry-run
```

**方式二：直接使用项目证书**

告诉我你的域名，我在服务器上运行 certbot 生成证书，自动放入 `certs/` 目录。

---

### 9. CDN / 对象存储

| 项目 | 内容 |
|------|------|
| **费用** | 免费额度（5GB 存储 + 5GB 流量/月） |
| **耗时** | 20 分钟 |
| **推荐方案** | 阿里云 OSS |

```
1. 打开 https://oss.console.aliyun.com/
2. 创建 Bucket：
   - 名称：epicshot-images
   - 地域：选择离用户最近的
   - 读写权限：私有
3. 进入「概览」→ 复制「外网访问域名」
4. 进入 AccessKey 管理 → 创建 AccessKey → 复制 AccessKey ID 和 Secret
```

| 你给我 | 在哪里找 | 格式示例 |
|--------|----------|----------|
| Bucket 名称 | OSS 控制台 | `epicshot-images` |
| 外网域名 | OSS 控制台 | `epicshot-images.oss-cn-shanghai.aliyuncs.com` |
| AccessKey ID | RAM 访问控制 | `LTAI5txxxxxxxxxxxxx` |
| AccessKey Secret | RAM 访问控制 | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| 地域 | OSS 控制台 | `oss-cn-shanghai` |

> **代码就绪度 70%**：签名 URL 框架已实现，需要我写 multer → OSS 上传适配器。

---

### 10. 数据库升级（SQLite → PostgreSQL）

| 项目 | 内容 |
|------|------|
| **费用** | 自建免费 / 云数据库 360 元/月 |
| **耗时** | 1-2 天开发 |
| **方案** | |

**自建 PostgreSQL（免费）：**

```
在服务器上运行：
  apt install postgresql
  sudo -u postgres createuser epicshot
  sudo -u postgres createdb epicshot
  sudo -u postgres psql -c "ALTER USER epicshot WITH PASSWORD '你的密码';"
```

| 你给我 | 格式示例 |
|--------|----------|
| 数据库地址 | `localhost` |
| 数据库端口 | `5432` |
| 数据库名 | `epicshot` |
| 用户名 | `epicshot` |
| 密码 | 你设置的密码 |

> **代码就绪度 30%**：需要大规模迁移 SQLite → PostgreSQL，约 400+ 处 SQL 调用需要改写。**建议 V1.20 或 V1.21 再做。**

---

## 四、汇总：你现在需要给我的

### 立即可给（决定域名后）

| 序号 | 我需要 | 你提供 | 格式 |
|:----:|--------|--------|------|
| ① | `JWT_SECRET` | 运行 `openssl rand -hex 64` 的输出 | 128 位十六进制 |
| ② | `CORS_ORIGINS` | 你的前端域名 | `https://epicshot.com,...` |

### 注册开发者账号后

| 序号 | 我需要 | 注册地址 | 耗时 |
|:----:|--------|----------|:----:|
| ③ | `WECHAT_APP_ID` + `WECHAT_APP_SECRET` | open.weixin.qq.com | 1-3 天 |
| ④ | SMTP 地址/端口/账号/密码 | dm.console.aliyun.com | 10 分钟 |
| ⑤ | `SENTRY_DSN` | sentry.io | 5 分钟 |
| ⑥ | `AI_SERVICE_KEY` | dashscope.aliyun.com | 15 分钟 |

### 服务器部署后

| 序号 | 我需要 | 说明 |
|:----:|--------|------|
| ⑦ | 服务器 SSH 信息 | 我来运行 certbot 配置 SSL |
| ⑧ | OSS AccessKey 等 | 我来写 OSS 上传适配器 |
| ⑨ | PostgreSQL 连接信息 | 我来写数据库迁移脚本 |

---

**优先级建议：先给 ①②④⑤⑥（5 分钟~15 分钟搞定），然后 ③ 微信认证（等审核），最后 ⑦⑧⑨ 服务器部署时处理。**