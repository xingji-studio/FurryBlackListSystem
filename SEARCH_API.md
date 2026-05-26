# 极端福瑞/反福瑞行为档案库 API

本文档说明黑名单查询接口的调用方法。

## 接口地址

```text
GET /api/blacklist/search
POST /api/blacklist/search
```

```text
https://furry.report/api/blacklist/search
```

## 校验规则

调用查询接口时，必须提供 `check_code` 参数。

- `check_code` 必须是数字
- `check_code` 必须与校验码完全一致
- 不一致时接口会返回错误，无法查询

## 请求参数

### 通用参数

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | string | 是 | 平台名称 |
| `account_id` | string | 是 | 账号名或账号 ID |
| `check_code` | string | 是 | 查询校验码，必须与根目录 `cpwd.txt` 一致 |

### `platform` 可选值

- `QQ`
- `微信`
- `B站`
- `快手`
- `抖音`
- `Discord`

## GET 调用示例

### curl

```bash
curl "https://your-domain.com/api/blacklist/search?platform=QQ&account_id=user_12345&check_code=123456"
```

### JavaScript

```js
const params = new URLSearchParams({
  platform: 'QQ',
  account_id: 'user_12345',
  check_code: '123456'
})

const response = await fetch(`https://your-domain.com/api/blacklist/search?${params}`, {
  headers: { Accept: 'application/json' }
})

const data = await response.json()
console.log(data)
```

## POST 调用示例

### curl

```bash
curl -X POST "https://furry.report/api/blacklist/search" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "QQ",
    "account_id": "user_12345",
    "check_code": "123456"
  }'
```

### JavaScript

```js
const response = await fetch('https://your-domain.com/api/blacklist/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  body: JSON.stringify({
    platform: 'QQ',
    account_id: 'user_12345',
    check_code: '123456'
  })
})

const data = await response.json()
console.log(data)
```

## 成功响应示例

### 命中黑名单

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
    "description": "示例描述",
    "created_at": "2026-05-26 12:00:00",
    "updated_at": "2026-05-26 12:30:00",
    "images": [
      {
        "id": 10,
        "filename": "evidence.png",
        "mime_type": "image/png",
        "url": "https://your-domain.com/api/public-images/10"
      }
    ]
  }
}
```

### 未命中黑名单

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

## 失败响应示例

### 校验码错误

```json
{
  "success": false,
  "error": "校验码错误。"
}
```

### 其他常见错误

- `校验码不能为空。`
- `校验码格式无效。`
- `平台选项无效。`
- `账号 ID 不能为空。`
- `账号 ID 只能包含 ASCII 字符。`
- `请求过于频繁，请稍后再试。`

## 说明

- 查询接口允许跨域调用
- `GET` 适合普通查询
- `POST` 适合服务端或程序内部封装调用
