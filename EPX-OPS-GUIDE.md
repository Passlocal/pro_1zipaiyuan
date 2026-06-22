# 易拍选 (EpicShot) V1.2.0 运维部署文档

## 部署架构

```
互联网
  │
  ├─ Nginx (反向代理 + SSL)
  │    ├─ /api/*    → localhost:3000 (Express后端)
  │    ├─ /ws       → localhost:3000 (WebSocket)
  │    └─ /*        → dist/ (Vue前端静态文件)
  │
  ├─ Express.js (端口3000)
  │    └─ SQLite (data/epicshot.db)
  │
  └─ 外部服务
       ├─ 阿里云百炼/腾讯混元 (AI)
       ├─ 微信公众号 (OAuth)
       └─ SMTP (邮件)
```

## 环境要求

| 依赖 | 最低版本 |
|------|----------|
| Node.js | 18.x |
| npm | 9.x |
| Nginx | 1.24+ |
| 系统 | Ubuntu 22.04+ / CentOS 8+ |

## 生产部署步骤

### 1. 服务器准备

```bash
# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# 创建应用目录
sudo mkdir -p /opt/epicshot
sudo chown -R $USER:$USER /opt/epicshot
```

### 2. 部署后端

```bash
cd /opt/epicshot
cp -r /workspace/epicshot-backend .

# 安装依赖
cd epicshot-backend
npm install --production

# 配置环境变量
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
JWT_SECRET=<生成随机64位密钥>
DB_PATH=data/epicshot.db
UPLOAD_DIR=uploads
LOG_LEVEL=INFO

# 可选：外部服务
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_REDIRECT_URI=https://your-domain.com/v1/auth/wechat/callback
AI_PROVIDER=aliyun
AI_API_KEY=
AI_API_ENDPOINT=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EOF

# 启动（使用 pm2）
npm install -g pm2
pm2 start server.js --name epicshot-backend
pm2 save
pm2 startup
```

### 3. 部署前端

```bash
cd /opt/epicshot/epicshot-frontend

# 构建
npm install
npm run build

# 复制到 Nginx 目录
sudo cp -r dist/* /var/www/epicshot/
```

### 4. 配置 Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    root /var/www/epicshot;
    index index.html;

    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 上传文件限制
    client_max_body_size 50m;

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5. SSL 证书

```bash
# 使用 Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 6. 数据库备份

```bash
# 每日备份脚本
#!/bin/bash
BACKUP_DIR=/opt/epicshot/backups
mkdir -p $BACKUP_DIR
cp /opt/epicshot/epicshot-backend/data/epicshot.db \
   $BACKUP_DIR/epicshot_$(date +%Y%m%d_%H%M%S).db

# 保留最近7天
find $BACKUP_DIR -name "*.db" -mtime +7 -delete

# 添加到 crontab
# 0 2 * * * /opt/epicshot/backup.sh
```

## 监控

### 健康检查

```bash
curl https://your-domain.com/health
# 预期输出: {"status":"ok","db":"connected","version":"1.2.0"}
```

### 日志

后端日志输出到 stdout，通过 pm2 管理：

```bash
pm2 logs epicshot-backend
pm2 status
pm2 monit
```

### 关键指标

| 指标 | 监控方式 |
|------|---------|
| 服务可用性 | /health 端点 |
| 数据库连接 | /health 返回 db:connected |
| 内存使用 | pm2 monit / top |
| API 响应时间 | Nginx access log |
| 错误率 | 后端日志 ERROR 级别 |

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| NODE_ENV | 否 | development | 环境模式 |
| PORT | 否 | 3000 | 后端端口 |
| JWT_SECRET | 生产必填 | - | JWT签名密钥 |
| DB_PATH | 否 | data/epicshot.db | 数据库路径 |
| UPLOAD_DIR | 否 | uploads | 上传目录 |
| LOG_LEVEL | 否 | DEBUG | 日志级别 |
| RATE_LIMIT_WINDOW_MS | 否 | 900000 | 限流窗口 |
| RATE_LIMIT_MAX | 否 | 100 | 限流最大请求数 |
| WECHAT_APP_ID | 否 | - | 微信AppID |
| WECHAT_APP_SECRET | 否 | - | 微信AppSecret |
| AI_PROVIDER | 否 | - | AI服务商 |
| AI_API_KEY | 否 | - | AI API密钥 |
| AI_API_ENDPOINT | 否 | - | AI API地址 |
| SMTP_HOST | 否 | - | 邮件服务器 |
| SMTP_PORT | 否 | 587 | 邮件端口 |
| SMTP_USER | 否 | - | 邮件账号 |
| SMTP_PASS | 否 | - | 邮件密码 |

## 故障排查

### 服务无法启动
```bash
# 检查端口占用
lsof -i :3000

# 检查 Node.js 版本
node -v  # 需要 >= 18

# 检查依赖
cd epicshot-backend && npm install
```

### 数据库损坏
```bash
# 恢复备份
cp backups/epicshot_YYYYMMDD.db data/epicshot.db

# 重建数据库（清空所有数据）
rm data/epicshot.db
pm2 restart epicshot-backend  # 启动时自动创建新库+种子数据
```

### 上传失败
```bash
# 检查上传目录权限
ls -la uploads/
# 确保 Node.js 进程有写入权限
chmod 755 uploads/
```