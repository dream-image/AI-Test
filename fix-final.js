#!/usr/bin/env node

// 精确替换 readResponse 函数

const fs = require('fs');

const file = 'node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/dist/transformers.web.js';

console.log('📖 读取文件...');
let content = fs.readFileSync(file, 'utf8');

// 精确的旧函数代码
const oldFunction = `async function readResponse(response, progress_callback) {

    const contentLength = response.headers.get('Content-Length');
    if (contentLength === null) {
        console.warn('Unable to determine content-length from response headers. Will expand buffer when needed.')
    }
    let total = parseInt(contentLength ?? '0');
    let buffer = new Uint8Array(total);
    let loaded = 0;

    const reader = response.body.getReader();
    async function read() {
        const { done, value } = await reader.read();
        if (done) return;

        const newLoaded = loaded + value.length;
        if (newLoaded > total) {
            total = newLoaded;

            // Adding the new data will overflow buffer.
            // In this case, we extend the buffer
            const newBuffer = new Uint8Array(total);

            // copy contents
            newBuffer.set(buffer);

            buffer = newBuffer;
        }
        buffer.set(value, loaded);
        loaded = newLoaded;

        const progress = (loaded / total) * 100;

        // Call your function here
        progress_callback({ progress, loaded, total });

        return read();
    }

    // Actually read
    await read();

    return buffer;
}`;

// 新函数代码
const newFunction = `async function readResponse(response, progress_callback) {
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

if (content.includes(oldFunction)) {
    console.log('✂️  替换函数...');
    content = content.replace(oldFunction, newFunction);
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ 修复成功！');
} else {
    console.log('⚠️  未找到精确匹配的旧函数');
    console.log('尝试查找函数位置...');
    const funcPos = content.indexOf('async function readResponse(response, progress_callback)');
    if (funcPos !== -1) {
        console.log(`找到函数在位置 ${funcPos}，请手动检查`);
    }
}

console.log('');
console.log('📋 下一步:');
console.log('rm -rf node_modules/.vite && pnpm dev');
