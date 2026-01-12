# 浏览器端中文文本生成模型推荐

## 🎯 当前使用模型

**Xenova/Qwen1.5-0.5B-Chat**

- **开发商**: 阿里巴巴（Alibaba Cloud）
- **转换方**: Xenova（Transformers.js 官方）
- **参数量**: 500M
- **中文支持**: ⭐⭐⭐⭐⭐ (专为中文设计)
- **内存占用**: 约 300-500MB
- **浏览器兼容性**: ✅ 优秀
- **许可证**: Apache 2.0

### 为什么选择 Xenova 版本？

⚠️ **重要发现**：`onnx-community/Qwen2.5-0.5B-Instruct` 可能存在以下问题：
- ❌ 输出乱码（疑似数据集污染或 ONNX 转换问题）
- ❌ 即使使用正确的对话模板，仍输出无意义内容
- ❌ 示例输出：`horizontally בכתב Mohammed obviously Z paralle...`

✅ **Xenova 版本优势**：
- ✅ 官方 Transformers.js 团队转换和验证
- ✅ 经过充分测试，输出稳定
- ✅ 不需要特殊的对话模板
- ✅ 权重文件完整，无污染

---

## 📊 其他可选中文模型对比

### 1️⃣ **Qwen2.5-1.5B-Instruct** (进阶选项)

```typescript
static model = 'onnx-community/Qwen2.5-1.5B-Instruct';
```

- **参数量**: 1.5B
- **中文支持**: ⭐⭐⭐⭐⭐
- **内存占用**: 约 900MB - 1.5GB
- **效果**: 比 0.5B 更好，但可能遇到浏览器内存限制
- **建议**: 仅在内存充足时使用

---

### 2️⃣ **SmolLM2 系列** (非中文专用)

```typescript
// SmolLM2-360M (最小)
static model = 'HuggingFaceTB/SmolLM2-360M-Instruct';

// SmolLM2-1.7B (原使用模型，会触发内存错误)
static model = 'HuggingFaceTB/SmolLM2-1.7B-Instruct';
```

- **开发商**: HuggingFace
- **中文支持**: ⭐⭐ (主要为英文优化)
- **问题**: 
  - ❌ 360M 版本中文效果较差
  - ❌ 1.7B 版本在浏览器中会触发内存分配错误
  - ⚠️ 缺少官方 ONNX q8 量化版本

---

### 3️⃣ **Phi-3.5-mini** (Microsoft)

```typescript
static model = 'onnx-community/Phi-3.5-mini-instruct';
```

- **参数量**: 3.8B
- **中文支持**: ⭐⭐⭐ (多语言，中文一般)
- **内存占用**: 约 2-3GB
- **问题**: ❌ 太大，浏览器难以运行

---

## ⚙️ 配置建议

### ⚠️ 重要：必须使用 apply_chat_template

**Xenova/Qwen1.5-0.5B-Chat 模型必须使用 `apply_chat_template` 方法**，这是官方文档要求！

#### ✅ 正确用法（来自官方文档）

```typescript
// 1. 构建消息数组
const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: '请写一首诗' }
];

// 2. 应用聊天模板
const formattedText = generator.tokenizer.apply_chat_template(messages, {
    tokenize: false,
    add_generation_prompt: true,
});

// 3. 生成文本
const output = await generator(formattedText, {
    max_new_tokens: 256,
    temperature: 0.7,
    do_sample: true,
    return_full_text: false,  // 只返回生成部分
});
```

#### ❌ 错误用法（会导致乱码）

```typescript
// 直接传入用户输入 - 这会导致乱码！
const output = await generator("请写一首诗", { ... });

// 或使用自定义模板 - 也会乱码！
const prompt = `<|im_start|>user\n${text}<|im_end|>`;
const output = await generator(prompt, { ... });
```

**为什么会乱码？**
- ❌ 模型训练时使用的是 `apply_chat_template` 生成的特定格式
- ❌ 直接输入或手动模板不符合训练格式，模型无法理解
- ❌ 导致输出随机 token，看起来像多语言乱码

---

### 最佳配置 (当前使用)

```typescript
this.instance = pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat', {
    // 使用默认配置即可，模型已经过优化
});
```

### 如果仍遇到内存问题

```typescript
this.instance = pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct', {
    dtype: 'q4',      // int4 量化，更小的内存占用
    device: 'wasm',   // 强制使用 WASM（更兼容）
});
```

### 如果需要更好的性能

```typescript
this.instance = pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct', {
    dtype: 'fp16',    // 半精度浮点，效果更好但内存更大
    device: 'webgpu', // 强制使用 WebGPU（需要浏览器支持）
});
```

---

## 🔥 生成参数优化 (中文场景)

```typescript
const output = await generator(prompt, {
    max_new_tokens: 256,       // 中文字符密度高，可适当增加
    temperature: 0.7,          // 0.6-0.8 适合中文创作
    top_k: 40,                 // 40-50 平衡质量和多样性
    top_p: 0.9,                // nucleus sampling
    repetition_penalty: 1.1,   // 防止重复（中文重要）
    do_sample: true,           // 启用采样，增加多样性
});
```

---

## 📚 相关资源

- [Qwen2.5 官方文档](https://qwenlm.github.io/)
- [Transformers.js 文档](https://huggingface.co/docs/transformers.js)
- [ONNX Community Models](https://huggingface.co/onnx-community)

---

## ⚠️ 已知问题

### SmolLM2-1.7B 内存分配错误

```
RangeError: Array buffer allocation failed
    at new ArrayBuffer (<anonymous>)
```

**原因**: 模型量化后仍超过 1.5GB，超出浏览器 ArrayBuffer 限制

**解决方案**: 
1. ✅ 使用 Qwen2.5-0.5B (推荐)
2. ⚠️ 使用 SmolLM2-360M (中文效果差)
3. ❌ 增加浏览器内存限制 (不可靠)

---

## 🎨 测试提示词

### 中文诗歌
```
请写一首关于程序员的现代诗
```

### 文案创作
```
为一款AI编程助手写一段宣传文案，强调智能和高效
```

### 代码解释
```
用简单的话解释什么是递归
```

### 对话场景
```
作为一个友好的AI助手,回答用户的问题: 如何学习编程?
```
