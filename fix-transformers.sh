#!/bin/bash

# 修复 Transformers.js 大模型内存分配问题的脚本

FILE="node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/dist/transformers.web.js"

if [ ! -f "$FILE" ]; then
    echo "错误：找不到 transformers.web.js 文件"
    exit 1
fi

echo "正在备份原文件..."
cp "$FILE" "${FILE}.backup"

echo "正在应用补丁..."

# 使用 sed 替换问题代码
# 注意：这是一个简化版本，实际可能需要手动调整

cat > /tmp/fix_transformer.js << 'EOF'
// Node.js 脚本来修复 transformers.js
const fs = require('fs');

const file = 'node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/dist/transformers.web.js';

let content = fs.readFileSync(file, 'utf8');

// 查找并替换问题代码
const oldCode = 'let buffer = new Uint8Array(total);';
const newCode = `
// 修复大文件内存分配：使用分块下载 (patch by user)
const chunks_temp = [];
const reader_temp = response.body.getReader();
while (true) {
    const { done, value } = await reader_temp.read();
    if (done) break;
    chunks_temp.push(value);
}
const blob_temp = new Blob(chunks_temp);
let buffer = new Uint8Array(await blob_temp.arrayBuffer());
`.trim();

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ 修复成功！已应用分块下载补丁。');
} else {
    console.log('⚠️  未找到目标代码，可能已经修复或版本不同。');
}
EOF

node /tmp/fix_transformer.js

echo "完成！请重启开发服务器。"
