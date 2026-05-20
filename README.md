# 黑名单系统

一个可在 Windows 和 Linux 上快速部署的黑名单网站，默认同时开放两个端口：

- 公开页：`http://127.0.0.1:8080`
- 后台管理页：`http://127.0.0.1:8081`

公开页包含三个功能：

- 举报：提交平台、账号 ID、威胁程度、描述、证据
- 查询：按平台和账号名检索黑名单
- 申诉：提交平台、账号 ID、描述、证据
- API 查询：外部程序可直接调用公开接口查询黑名单

## 生产抗压更新

本项目现在已经补上以下抗压与防攻击能力：

- 支持 Gunicorn 多 worker / 多线程部署，能利用多核 CPU，而不是只跑 Flask 开发服务器
- SQLite 已启用 `WAL`、`busy_timeout` 和查询索引，降低高并发下的数据库阻塞
- 限流已改为 SQLite 共享限流，多进程下仍然统一生效
- 已移除公开浏览全部黑名单数据的页面，只保留按条件查询
- 图片接口和只读查询接口已增加缓存头，减轻源站压力
- 支持通过 `ProxyFix` 正确识别反向代理后的真实客户端 IP
- 提供 Nginx 限流配置模板，可直接在公网前置反向代理层拦截大部分恶意流量

后台页需要账号密码登录，可以：

- 审核举报，审核通过后自动将信息写入黑名单
- 审核申诉，审核通过后自动将对应账号从黑名单删除
- 查看当前黑名单

## 一键启动

以下脚本仅适合本地开发或内网测试，不建议直接暴露到公网。

### Linux

```bash
chmod +x start.sh
./start.sh
```

### Windows

双击运行 `start.bat`，或在命令行执行：

```bat
start.bat
```

脚本会自动：

1. 创建虚拟环境 `.venv`
2. 安装依赖
3. 同时启动公开页和后台页

## 生产环境一键启动

### Linux

```bash
chmod +x start_production.sh stop_production.sh
./start_production.sh
```

### Windows

```bat
start_production.bat
```

脚本会自动：

1. 创建虚拟环境 `.venv`
2. 安装依赖
3. 用 Gunicorn 启动公开站和后台站
4. 将 PID 写入 `data/run/`
5. 将日志写入 `data/logs/`

停止生产进程：

```bash
./stop_production.sh
```

## 生产部署

公网部署不要继续使用 `python app.run()`。建议结构：

1. Cloudflare 或其他 CDN / 高防
2. Nginx 反向代理与限流
3. Gunicorn 多 worker 运行公开站与后台站

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动公开站

```bash
PUBLIC_PORT=8080 \
WEB_CONCURRENCY=4 \
GUNICORN_THREADS=8 \
gunicorn -c gunicorn.conf.py wsgi:public_app
```

### 启动后台站

后台建议单独子域或单独站点监听另一个端口，例如：

```bash
GUNICORN_BIND=0.0.0.0:8081 \
WEB_CONCURRENCY=2 \
GUNICORN_THREADS=4 \
gunicorn -c gunicorn.conf.py wsgi:admin_app
```

### Nginx 防护模板

项目已提供示例配置：

- [deploy/nginx-furryblacklist.conf](/mnt/c/Users/GuoqiFish/Desktop/Develop/FurryBlackListSystem/deploy/nginx-furryblacklist.conf)

模板包含：

- 单 IP 请求速率限制
- 单 IP 连接数限制
- 上传体积限制
- API、页面、图片的分级限速
- 公开站与后台站分域反代
- 转发真实 IP 与协议头

如果你使用 Cloudflare，请同时打开：

- `Under Attack Mode`
- WAF 托管规则
- Rate Limiting Rules
- Cache Rules（缓存图片和公开只读查询）

## 默认后台账号

- 账号：`admin`
- 密码：`admin123456`

正式部署前必须修改，至少要设置 `SECRET_KEY` 和后台密码。

## 自定义配置

可以在项目根目录新建 `.env` 文件，内容参考 [.env.example](/mnt/c/Users/GuoqiFish/Desktop/Develop/FurryBlackListSystem/.env.example)，也可以直接在启动前设置环境变量：

- `SECRET_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_PASSWORD_HASH`
- `PUBLIC_PORT`
- `ADMIN_PORT`
- `WEB_CONCURRENCY`
- `GUNICORN_THREADS`
- `TRUSTED_PROXY_COUNT`
- `MAX_CONTENT_LENGTH`
- `RATE_LIMIT_MAX_ENTRIES`
- `RATE_LIMIT_BACKEND`

`ADMIN_PASSWORD_HASH` 优先级高于 `ADMIN_PASSWORD`，值为 SHA-256 十六进制字符串。

新增参数说明：

- `TRUSTED_PROXY_COUNT`：前置反向代理层数，默认 `0`
- `MAX_CONTENT_LENGTH`：请求体上限，默认 `6291456` 字节
- `RATE_LIMIT_MAX_ENTRIES`：限流表保留上限，默认 `20000`
- `RATE_LIMIT_BACKEND`：限流存储后端，默认 `memory`，可选 `sqlite`
- `WEB_CONCURRENCY`：Gunicorn worker 数，默认约为 `CPU * 2`
- `GUNICORN_THREADS`：每个 worker 的线程数，默认 `8`

当前 SQLite 默认使用 `WAL + synchronous=FULL`，更适合电源和主机不稳定的环境，但写入性能会比 `NORMAL` 略低。

生成哈希示例：

```bash
python3 - <<'PY'
import hashlib
print(hashlib.sha256(b"your-password").hexdigest())
PY
```

Linux 示例：

```bash
export ADMIN_USERNAME=myadmin
export ADMIN_PASSWORD=strong-password
export PUBLIC_PORT=9000
export ADMIN_PORT=9001
./start.sh
```

Windows 示例：

```bat
set ADMIN_USERNAME=myadmin
set ADMIN_PASSWORD=strong-password
set PUBLIC_PORT=9000
set ADMIN_PORT=9001
start.bat
```

## 目录说明

- `blacklist_site/`：应用代码、模板和样式
- `data/`：运行时自动生成的 SQLite 数据库
- `start.sh` / `start.bat`：一键部署脚本
- `start_production.sh` / `start_production.bat`：生产环境 Gunicorn 一键启动脚本
- `stop_production.sh`：停止生产环境 Gunicorn 进程
- `start_servers.py`：同时拉起两个服务

## 黑名单查询 API

公开页提供只读查询接口，默认地址：

```text
GET http://127.0.0.1:8080/api/blacklist/search
```

支持跨域调用，适合网页前端、机器人或其他后端服务直接接入。

公开查询接口对 `GET` 请求会返回短时缓存头，便于 CDN 或反向代理缓存。

### 请求参数

- `platform`：平台名称，必须是站点允许的平台之一，例如 `QQ`
- `account_id`：要查询的账号 ID 或账号名

### GET 调用示例

```bash
curl "http://127.0.0.1:8080/api/blacklist/search?platform=QQ&account_id=user_12345"
```

### POST JSON 调用示例

```bash
curl -X POST "http://127.0.0.1:8080/api/blacklist/search" \
  -H "Content-Type: application/json" \
  -d '{"platform":"QQ","account_id":"user_12345"}'
```

### JavaScript 调用示例

```js
const response = await fetch("http://127.0.0.1:8080/api/blacklist/search?platform=QQ&account_id=user_12345");
const data = await response.json();

if (data.success && data.found) {
  console.log("命中黑名单", data.entry);
} else if (data.success) {
  console.log("未命中", data.query);
} else {
  console.error("查询失败", data.error);
}
```

### 返回示例

命中时：

```json
{
  "success": true,
  "found": true,
  "query": {
    "platform": "QQ",
    "account_id": "user_12345"
  },
  "entry": {
    "id": 1,
    "platform": "QQ",
    "account_id": "user_12345",
    "threat_level": "高",
    "description": "长期骚扰、发布仇恨言论。",
    "created_at": "2026-05-20 08:00:00",
    "updated_at": "2026-05-20 08:00:00",
    "images": [
      {
        "id": 2,
        "filename": "evidence-1.png",
        "mime_type": "image/png",
        "url": "http://127.0.0.1:8080/blacklist-images/2"
      }
    ]
  }
}
```

未命中时：

```json
{
  "success": true,
  "found": false,
  "query": {
    "platform": "QQ",
    "account_id": "user_12345"
  },
  "entry": null
}
```

参数错误或请求过快时：

```json
{
  "success": false,
  "error": "平台选项无效。"
}
```
