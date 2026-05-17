# 黑名单系统

一个可在 Windows 和 Linux 上快速部署的黑名单网站，默认同时开放两个端口：

- 公开页：`http://127.0.0.1:8080`
- 后台管理页：`http://127.0.0.1:8081`

公开页包含三个功能：

- 举报：提交平台、账号 ID、威胁程度、描述、证据
- 查询：按平台和账号名检索黑名单
- 申诉：提交平台、账号 ID、描述、证据

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
