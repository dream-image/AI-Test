#!/usr/bin/env node

// 修正 Transformers.js 补丁 - 完整替换 readResponse 函数

const fs = require('fs');
const path = require('path');

const file = 'node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/dist/transformers.web.js';

if (!fs.existsSync(file)) {
    console.error('❌ 找不到文件:', file);
    process.exit(1);
}

console.log('📖 读取文件...');
let content = fs.readFileSync(file, 'utf8');

// 先恢复备份（如果之前的补丁有问题）
const backupFile = file + '.backup';
if (fs.existsSync(backupFile)) {
    console.log('🔄 从备份恢复...');
    content = fs.readFileSync(backupFile, 'utf8');
}

// 找到并替换整个 readResponse 函数
// 查找函数开始
const functionStart = 'async function readResponse(response, progress_callback = null) {';
const startIndex = content.indexOf(functionStart);

if (startIndex === -1) {
    console.error('❌ 找不到 readResponse 函数');
    process.exit(1);
}

// 找到函数结束（匹配括号）
let braceCount = 0;
let inFunction = false;
let endIndex = startIndex;

for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
        braceCount++;
        inFunction = true;
    } else if (content[i] === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) {
            endIndex = i + 1;
            break;
        }
    }
}

console.log('✂️  找到函数范围:', startIndex, '-', endIndex);

// 新的函数实现（完全替换）
const newFunction = `async function readResponse(response, progress_callback = null) {
    const contentLength = response.headers.get('Content-Length');
    const total = parseInt(contentLength ?? '0');
    
    // 🔥 修复：使用分块下载避免大内存分配
    const chunks = [];
    const reader = response.body.getReader();
    let loaded = 0;
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        // 报告进度
        if (progress_callback && total > 0) {
            progress_callback({
                status: 'progress',
                loaded,
                total,
                progress: (loaded / total) * 100
            });
        }
    }
    
    // 使用 Blob 组装，避免单次大内存分配
    const blob = new Blob(chunks);
    const buffer = new Uint8Array(await blob.arrayBuffer());
    
    return buffer;
}`;

// 替换
const before = content.substring(0, startIndex);
const after = content.substring(endIndex);
const newContent = before + newFunction + after;

// 备份原文件
if (!fs.existsSync(backupFile)) {
    console.log('💾 备份原文件...');
    fs.writeFileSync(backupFile, fs.readFileSync(file));
}

// 写入新内容
console.log('✍️  写入修正后的代码...');
fs.writeFileSync(file, newContent, 'utf8');

console.log('✅ 修复成功！');
console.log('');
console.log('📋 下一步:');
console.log('1. rm -rf node_modules/.vite');
console.log('2. 重启开发服务器');
console.log('3. 浏览器强制刷新 (Cmd+Shift+R)');
