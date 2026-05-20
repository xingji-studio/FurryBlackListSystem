# 黑名单系统

一个可在 Windows 和 Linux 上快速部署的黑名单网站，默认同时开放两个端口：

- 公开页：`http://127.0.0.1:8080`
- 后台管理页：`http://127.0.0.1:8081`

公开页包含三个功能：

- 举报：提交平台、账号 ID、威胁程度、描述、证据
- 查询：按平台和账号名检索黑名单
- 申诉：提交平台、账号 ID、描述、证据
- API 查询：外部程序可直接调用公开接口查询黑名单

后台页需要账号密码登录，可以：

- 审核举报，审核通过后自动将信息写入黑名单
- 审核申诉，审核通过后自动将对应账号从黑名单删除
- 查看当前黑名单

## 一键启动

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

`ADMIN_PASSWORD_HASH` 优先级高于 `ADMIN_PASSWORD`，值为 SHA-256 十六进制字符串。

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
- `start_servers.py`：同时拉起两个服务

## 黑名单查询 API

公开页提供只读查询接口，默认地址：

```text
GET http://127.0.0.1:8080/api/blacklist/search
```

支持跨域调用，适合网页前端、机器人或其他后端服务直接接入。

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
