# 修复 Transformers.js 大模型内存分配问题

## 问题根源

**Transformers.js** 在 `readResponse` 函数中直接分配大 ArrayBuffer：
```javascript
// transformers.web.js:33052
let buffer = new Uint8Array(total);  // ❌ 一次性分配，触发 RangeError
```

**modal.worker.js** 使用分块下载 + Blob：
```javascript
// ✅ 分块读取，每次只分配小块内存
const chunks = [];
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);  // 小块累积
}
const blob = new Blob(chunks);  // Blob 不受 ArrayBuffer 限制
```

---

## 解决方案：修改 Transformers.js 源码

### 步骤 1：找到文件

```bash
# 文件位置（根据错误堆栈）
node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/dist/transformers.web.js
```

### 步骤 2：找到问题代码

在 `transformers.web.js` 第 33052 行附近查找：

```javascript
async function readResponse(response) {
    const contentLength = response.headers.get('Content-Length');
    const total = parseInt(contentLength, 10);
    
    // ❌ 问题行：一次性分配大内存
    let buffer = new Uint8Array(total);
    
    const reader = response.body.getReader();
    let position = 0;
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer.set(value, position);
        position += value.length;
    }
    
    return buffer;
}
```

### 步骤 3：替换为分块方式

```javascript
async function readResponse(response) {
    const reader = response.body.getReader();
    const chunks = [];  // ✅ 使用数组累积小块
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);  // ✅ 每次只是添加引用，不分配大内存
    }
    
    // ✅ 使用 Blob 组装（Blob 内部优化更好）
    const blob = new Blob(chunks);
    const buffer = new Uint8Array(await blob.arrayBuffer());
    
    return buffer;
}
```

---

## 手动修改步骤

### 1. 打开文件

```bash
cd /Users/throusanddream/代码/project/LangGraphTest
code node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/dist/transformers.web.js
```

### 2. 搜索并替换

**搜索**（Cmd+F）:
```
let buffer = new Uint8Array(total)
```

**替换为**:
```javascript
// 修复大文件内存分配问题：使用分块 + Blob 方式
const chunks = [];
const reader = response.body.getReader();

while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
}

const blob = new Blob(chunks);
let buffer = new Uint8Array(await blob.arrayBuffer());
```

### 3. 注意事项

- 修改后需要重启开发服务器
- 每次 `npm install` 都会覆盖修改，需要重新修改
- 建议创建一个 patch 文件保存修改

---

## 创建持久化 Patch

使用 `patch-package` 保存修改：

```bash
# 1. 安装 patch-package
pnpm add -D patch-package

# 2. 修改完源码后，生成 patch
npx patch-package @huggingface/transformers

# 3. 在 package.json 添加 postinstall 脚本
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

这样每次安装依赖后都会自动应用 patch。

---

## 验证修改

修改后刷新浏览器，应该能成功加载 SmolLM3-3B-Base 模型。

### 预期结果

✅ 模型下载进度正常显示
✅ 不再出现 `RangeError: Array buffer allocation failed`
✅ 模型加载成功，可以开始生成文本
