#!/usr/bin/env node

// 最终优化：直接组装 Uint8Array，完全避免 Blob

const fs = require('fs');

const file = 'node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/dist/transformers.web.js';

console.log('📖 读取文件...');
let content = fs.readFileSync(file, 'utf8');

// 当前的函数（第二版）
const currentFunction = `async function readResponse(response, progress_callback) {
    // 🔥 修复大文件内存分配：使用分块下载
    const contentLength = response.headers.get('Content-Length');
    const total = parseInt(contentLength ?? '0');
    
    const chunks = [];
    const reader = response.body.getReader();
    let loaded = 0;
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        // 报告进度
        if (progress_callback) {
            const progress = total > 0 ? (loaded / total) * 100 : 0;
            progress_callback({ progress, loaded, total });
        }
    }
    
    // 使用 Blob 组装，避免单次大内存分配
    const blob = new Blob(chunks);
    const buffer = new Uint8Array(await blob.arrayBuffer());
    
    return buffer;
}`;

// 最终版本：直接组装 Uint8Array，避免 Blob.arrayBuffer()
const finalFunction = `async function readResponse(response, progress_callback) {
    // 🔥 修复大文件内存分配：分块读取 + 手动组装
    const contentLength = response.headers.get('Content-Length');
    const total = parseInt(contentLength ?? '0');
    
    const chunks = [];
    const reader = response.body.getReader();
    let loaded = 0;
    
    // 第一步：收集所有块
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        // 报告进度
        if (progress_callback) {
            const progress = total > 0 ? (loaded / total) * 100 : 0;
            progress_callback({ progress, loaded, total });
        }
    }
    
    // 第二步：手动组装 Uint8Array（避免 Blob.arrayBuffer()）
    const buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
    }
    
    return buffer;
}`;

if (content.includes(currentFunction)) {
    console.log('✂️  优化 readResponse 函数...');
    content = content.replace(currentFunction, finalFunction);
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ 优化成功！');
    console.log('');
    console.log('💡 改进点：');
    console.log('- 避免了 Blob.arrayBuffer() 调用');
    console.log('- 直接手动组装 Uint8Array');
    console.log('- 内存使用更可控');
} else {
    console.log('⚠️  未找到当前版本的函数');
}

console.log('');
console.log('📋 下一步:');
console.log('1. rm -rf node_modules/.vite');
console.log('2. 重启开发服务器');
console.log('3. 测试加载');
