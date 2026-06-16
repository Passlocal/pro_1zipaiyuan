# 易拍选（EpicShot）备份策略 V1.2.0

---

## 1. 备份对象

| 数据 | 路径 | 重要性 | 备份频率 |
|------|------|--------|----------|
| SQLite 数据库 | `/data/epicshot.db` | 核心 | 每小时 |
| 上传图片 | `/uploads/` | 核心 | 每日 |
| 缩略图 | `/thumbnails/` | 可重建 | 每日 |
| 环境配置 | `.env` | 高 | 变更时 |

---

## 2. 数据库备份脚本

```bash
#!/bin/bash
# 每日备份：crontab: 0 2 * * * /opt/epicshot/backup.sh

BACKUP_DIR=/opt/epicshot/backups
DB_PATH=/opt/epicshot/data/epicshot.db
UPLOAD_DIR=/opt/epicshot/uploads
RETENTION_DAYS=30

DATE=$(date +%Y%m%d)
mkdir -p $BACKUP_DIR/$DATE

# SQLite 备份（在线备份，支持 WAL 模式）
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/$DATE/epicshot.db'"

# 上传文件增量备份
rsync -a $UPLOAD_DIR/ $BACKUP_DIR/$DATE/uploads/

# 打包
tar -czf $BACKUP_DIR/epicshot-backup-$DATE.tar.gz -C $BACKUP_DIR $DATE

# 清理旧备份
find $BACKUP_DIR -name "epicshot-backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -type d -mtime +$RETENTION_DAYS -delete
```

---

## 3. 异地备份

- 建议使用 AWS S3 / 阿里云 OSS 自动同步备份文件
- 命令示例：`aws s3 sync /opt/epicshot/backups/ s3://epicshot-backups/`

---

## 4. 恢复步骤

1. 停止服务
2. 解压备份：`tar -xzf epicshot-backup-YYYYMMDD.tar.gz`
3. 恢复数据库：`cp YYYYMMDD/epicshot.db /opt/epicshot/data/epicshot.db`
4. 恢复上传：`rsync -a YYYYMMDD/uploads/ /opt/epicshot/uploads/`
5. 启动服务
6. 验证：`curl http://localhost:3000/health`

---

## 5. 备份验证

每月执行一次恢复演练：在测试环境恢复最新备份，验证数据完整性。