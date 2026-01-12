# 浏览器端 LLM 方案完整对比 (2026年1月)

## 📊 WebGPU 支持情况总结

### 硬件要求

| 平台 | GPU 要求 | 支持率 |
|------|---------|--------|
| **Windows** | NVIDIA GTX 900+ (2014+)<br/>AMD RX 400+ (2016+)<br/>Intel HD 5th Gen+ (2015+) | ~85% |
| **macOS** | Metal 支持 (2012+ Mac)<br/>M1/M2/M3 最佳 | ~95% |
| **Linux** | Vulkan 1.3+ 支持 | ~70% |
| **Android** | Adreno 6xx+, Mali G7x+ (2019+) | ~60% |
| **iOS** | 实验性，不稳定 | ~10% |

### 浏览器支持

| 浏览器 | 版本要求 | 市场份额 | 状态 |
|--------|---------|---------|------|
| **Chrome** | 113+ | ~65% | ✅ 完全支持 |
| **Edge** | 113+ | ~10% | ✅ 完全支持 |
| **Safari** | 17+ | ~20% | ⚠️ macOS 实验性<br/>❌ iOS 不稳定 |
| **Firefox** | 需手动启用 | ~3% | ⚠️ 默认禁用 |
| **其他** | - | ~2% | ❌ 不支持 |

### 用户覆盖估算

```
✅ 支持 WebGPU: ~65%
  - Chrome/Edge (桌面) ~60%
  - Safari (macOS) ~5%

⚠️ 有 WebGL/WASM 但无 WebGPU: ~28%
  - 老版本 Chrome/Safari ~20%
  - Firefox ~3%
  - 其他 ~5%

❌ 完全不支持: ~7%
  - 老旧设备
```

---

## 🔍 四大方案完整对比

### 1. TensorFlow.js

**定位**: 通用机器学习框架（底层）

#### 技术规格
- **模型格式**: `.tfjs` / `.tflite`
- **运行时**: TensorFlow.js Runtime
- **后端**: CPU (WASM) / WebGL / WebGPU
- **最大模型**: ~1B (理论，但不推荐用于 LLM)

#### 优势 ✅
- ⭐⭐⭐⭐⭐ **兼容性最佳** - 三层降级 (WebGPU → WebGL → CPU)
- ⭐⭐⭐⭐⭐ **生态最丰富** - CV、NLP、Audio 全覆盖
- ⭐⭐⭐⭐⭐ **文档完善** - Google 官方维护
- ⭐⭐⭐⭐ **灵活性高** - 可运行任何 TensorFlow 模型

#### 劣势 ❌
- ❌ **无 LLM 专用 API** - 需手动实现 Transformer
- ❌ **学习曲线陡** - 底层 API 复杂
- ❌ **LLM 性能一般** - 无针对性优化
- ❌ **模型转换复杂** - PyTorch → TF → TF.js

#### 适用场景
```javascript
// ✅ 计算机视觉
const model = await mobilenet.load();

// ✅ 音频处理
const audioModel = await tf.loadGraphModel('audio.json');

// ❌ 不适合 LLM
// 除非你是 ML 专家且有大量时间
```

#### 推荐指数
- **LLM 任务**: ⭐ (1/5) - 不推荐
- **其他 ML 任务**: ⭐⭐⭐⭐⭐ (5/5) - 首选

---

### 2. Transformers.js

**定位**: Hugging Face Transformers 的 JS 版本（专注 NLP/LLM）

#### 技术规格
- **模型格式**: `.onnx` (多文件)
- **运行时**: ONNX Runtime Web
- **后端**: CPU (WASM) / WebGPU
- **最大模型**: ~1B (实际限制，受浏览器内存约束)

#### 优势 ✅
- ⭐⭐⭐⭐⭐ **兼容性极佳** - WASM 降级，几乎所有设备
- ⭐⭐⭐⭐⭐ **使用最简单** - 一行代码即可使用
- ⭐⭐⭐⭐⭐ **模型库丰富** - 10万+ Hugging Face 模型
- ⭐⭐⭐⭐⭐ **自动转换** - 模型格式自动处理
- ⭐⭐⭐⭐ **生态成熟** - 社区活跃，文档完善

#### 劣势 ❌
- ❌ **大模型不支持** - 浏览器内存限制 (<1B)
- ❌ **内存占用高** - ONNX 需全部加载到 JS heap
- ⚠️ **性能中等** - WASM 模式较慢

#### 适用场景
```javascript
// ✅ 小模型文本生成
const generator = await pipeline('text-generation', 'Xenova/gpt2');

// ✅ 情感分析、翻译等
const classifier = await pipeline('sentiment-analysis');

// ✅ 快速原型
// ✅ C端产品（兼容性第一）
```

#### 推荐指数
- **小模型 LLM (<1B)**: ⭐⭐⭐⭐⭐ (5/5) - 首选
- **大模型 LLM (>1B)**: ⭐ (1/5) - 不支持

#### 为什么选择小模型的 Transformers.js？

**1. 模型库最丰富**
| 方案 | 可用模型数量 |
|------|-------------|
| Transformers.js | 10万+ (Hugging Face 自动转换) |
| WebLLM | ~100 (需 MLC 预编译) |
| MediaPipe | ~10 (仅 Google 官方) |

**2. 任务类型最全面**
| 任务 | Transformers.js | WebLLM | MediaPipe |
|------|:---------------:|:------:|:---------:|
| 情感分析 | ✅ | ❌ | ❌ |
| 命名实体识别 | ✅ | ❌ | ❌ |
| 填空(MLM) | ✅ | ❌ | ❌ |
| 问答抽取 | ✅ | ❌ | ❌ |
| Whisper 语音 | ✅ | ❌ | ✅ |
| Embedding | ✅ | ❌ | ❌ |

**3. 开发体验最简单**
```javascript
// Transformers.js - 一行代码
const classifier = await pipeline('sentiment-analysis');

// WebLLM - 需配置模型
const engine = await CreateMLCEngine("model-id", { ... });

// MediaPipe - 需配置 Fileset
const llm = await LlmInference.createFromOptions(genaiFileset, { ... });
```

**4. 适用场景**
- ✅ 情感分析、文本分类、NER 等专用任务
- ✅ Whisper 语音识别（tiny/small 模型效果好）
- ✅ Embedding 生成（RAG/语义搜索）
- ✅ 快速原型验证
- ❌ 不适合复杂推理、多轮对话

---

### 3. WebLLM (MLC-LLM)

**定位**: 专为浏览器端大语言模型设计

#### 技术规格
- **模型格式**: `.wasm` + `.params` (MLC 编译)
- **运行时**: TVM (编译优化)
- **后端**: WebGPU (主) / WASM (CPU 降级)
- **最大模型**: 7B+ (WebGPU) / ~3B (WASM 降级)

#### 优势 ✅
- ⭐⭐⭐⭐⭐ **大模型支持** - 7B 模型可流畅运行
- ⭐⭐⭐⭐⭐ **性能最强** - MLC 编译优化
- ⭐⭐⭐⭐⭐ **内存映射** - Blob URL 直接 GPU 加载
- ⭐⭐⭐⭐ **可定制** - 任何模型都可转换
- ⭐⭐⭐⭐ **WebGPU 优化** - 充分利用 GPU

#### 劣势 ❌
- ⚠️ **WebGPU 性能最佳** - WASM 降级可用但较慢
- ❌ **模型需预转换** - MLC 编译过程复杂
- ❌ **模型库有限** - 需自己转换或等社区
- ⚠️ **学习曲线中等** - 概念较新

#### 适用场景
```javascript
// ✅ 大模型对话
const engine = await CreateMLCEngine("Llama-3.2-7B");

// ✅ 代码生成
const coder = await CreateMLCEngine("CodeLlama-7B");

// ✅ B端产品（可控设备）
// ✅ 追求极致性能
```

#### 推荐指数
- **大模型 LLM (3B-7B)**: ⭐⭐⭐⭐⭐ (5/5) - 最佳选择
- **小模型 LLM (<1B)**: ⭐⭐⭐ (3/5) - 可用但不必要
- **C端广泛兼容**: ⭐⭐⭐ (3/5) - 有 WASM 降级

---

### 4. MediaPipe (Gemini API)

**定位**: Google 官方端侧 AI 解决方案

#### 技术规格
- **模型格式**: `.task` / `.tflite` (高度优化)
- **运行时**: MediaPipe Tasks (基于 TFLite)
- **后端**: WebGPU (主) / WASM (CPU 降级)
- **最大模型**: 7B (Gemini Nano)

#### 优势 ✅
- ⭐⭐⭐⭐⭐ **性能顶级** - Google 深度优化
- ⭐⭐⭐⭐⭐ **内存映射** - Blob URL 加载，不占 JS heap
- ⭐⭐⭐⭐⭐ **多模态** - 文本、音频、图像、视频统一
- ⭐⭐⭐⭐⭐ **质量保证** - Google 官方模型
- ⭐⭐⭐⭐ **企业级** - 稳定可靠

#### 劣势 ❌
- ❌ **模型限制** - 仅 Google 模型（Gemini、Gemma）
- ❌ **无法自定义** - 不能转换其他模型
- ❌ **生态封闭** - 依赖 Google 基础设施
- ⚠️ **WebGPU 性能最佳** - WASM 降级可用但较慢

#### 适用场景
```javascript
// ✅ Google 模型足够
const llm = await LlmInference.createFromOptions(genaiFileset, {
    baseOptions: { modelAssetPath: modelUrl }
});

// ✅ 多模态应用（音频+图像+文本）
// ✅ 企业级应用
// ✅ 追求稳定性
```

#### 推荐指数
- **Google 模型满足需求**: ⭐⭐⭐⭐⭐ (5/5) - 最佳
- **需要其他模型**: ⭐ (1/5) - 无法使用
- **C端广泛兼容**: ⭐⭐⭐ (3/5) - 有 WASM 降级

---

## 🔀 WebLLM vs MediaPipe 详细对比

### 核心区别

| 维度 | WebLLM (MLC-LLM) | MediaPipe (Gemini API) |
|-----|------------------|------------------------|
| **模型灵活性** | ✅ 任意开源模型 (Llama, Mistral, Qwen...) | ❌ 仅 Google 模型 (Gemini Nano, Gemma) |
| **多模态** | ❌ 主要是文本 | ✅ 文本 + 图像 + 音频 + 视频 |
| **集成复杂度** | 中等 (需配置模型) | 低 (开箱即用) |
| **模型质量** | 取决于你选的模型 | Google 官方优化，质量稳定 |
| **模型转换** | ❌ 需要 MLC 编译 | ✅ 无需转换 |
| **中文支持** | ✅ 可选中文优化模型 (Qwen, Yi) | ✅ Gemma 原生支持中文 |

### 选择 MediaPipe 的场景

```
✅ 需要 多模态 能力（音频识别、图像理解、视频分析）
✅ Gemini Nano / Gemma 模型能满足需求
✅ 希望 快速集成，不想折腾模型转换
✅ 需要 Google 级别的模型质量保证
✅ 应用是 通用对话、摘要、翻译 等常见任务
```

**典型场景**: 语音助手、图片问答、企业级产品

### 选择 WebLLM 的场景

```
✅ 需要 特定的开源模型（如 CodeLlama、DeepSeek Coder）
✅ 需要 微调过的自定义模型
✅ 不需要多模态，只做文本生成
✅ 对模型选择有特殊要求（特定领域模型）
✅ 愿意花时间进行 MLC 模型编译
```

**典型场景**: 代码生成、特定领域（法律/医疗微调模型）

### 决策流程图

```
需要多模态（音频/图像/视频）?
  └─ 是 → MediaPipe ✅
  └─ 否 ↓

需要特定开源模型/自定义微调模型？
  └─ 是 → WebLLM ✅
  └─ 否 ↓

Google 模型够用 → MediaPipe ✅（更简单）
```

---

## 📋 快速决策表

### 按需求选择

| 需求 | 最佳方案 | 备选方案 |
|------|---------|---------|
| **小模型 (<1B) + 最大兼容性** | Transformers.js | - |
| **大模型 (3B-7B) + 自定义** | WebLLM | - |
| **Google 模型 + 多模态** | MediaPipe | - |
| **计算机视觉/音频** | TensorFlow.js | - |
| **快速原型** | Transformers.js | MediaPipe |
| **生产级大模型** | WebLLM | MediaPipe |
| **C端产品** | Transformers.js | TF.js降级 |
| **B端产品** | MediaPipe | WebLLM |

### 按设备覆盖率选择

| 目标覆盖率 | 推荐方案 | 说明 |
|-----------|---------|------|
| >90% | 任意方案 (均支持 WASM 降级) | 所有方案都支持降级 |
| 最佳性能 | MediaPipe / WebLLM (WebGPU) | ~65% 设备支持 WebGPU |
| 特定设备 | 任意方案 | 100% |

---

## 💡 实际建议

### 内存加载方式对比

| 方案 | 加载方式 | 内存占用 | 最大模型 |
|------|---------|---------|----------|
| **Transformers.js** | ArrayBuffer → JS heap | 高（完整加载） | ~1B |
| **WebLLM** | Blob URL → GPU 内存映射 | 低 | 7B+ |
| **MediaPipe** | Blob URL → GPU 内存映射 | 低 | 7B+ |

> ⚠️ **重要**: Transformers.js 需要将模型完整加载到 JS heap，这是它只能支持小模型的根本原因。WebLLM 和 MediaPipe 通过 Blob URL 直接映射到 GPU，绕过了 JS 内存限制。

### 混合策略（最佳实践）

```javascript
// 检测并选择最佳方案
async function selectBestEngine(taskType, modelSize) {
    const hasWebGPU = 'gpu' in navigator;
    
    // 大模型需求 (>1B)
    if (modelSize > 1000000000) {
        // Google 模型 + 多模态
        if (taskType === 'multimodal' || taskType === 'google-model') {
            return { 
                engine: 'MediaPipe', 
                backend: hasWebGPU ? 'WebGPU' : 'WASM',
                note: hasWebGPU ? '最佳性能' : 'CPU 降级模式'
            };
        }
        // 自定义开源模型
        return { 
            engine: 'WebLLM', 
            backend: hasWebGPU ? 'WebGPU' : 'WASM',
            note: hasWebGPU ? '最佳性能' : 'CPU 降级模式'
        };
    }
    
    // 小模型需求 (<1B)
    return { 
        engine: 'Transformers.js', 
        backend: hasWebGPU ? 'WebGPU' : 'WASM',
        note: '兼容性最佳'
    };
}
```

---

## 🎯 最终总结

### 一句话评价

- **TensorFlow.js**: 通用 ML 框架，LLM 不推荐
- **Transformers.js**: 小模型之王，兼容性最佳
- **WebLLM**: 大模型专家，性能最强
- **MediaPipe**: Google 模型首选，多模态最佳

### 推荐组合

**方案 A - 最大兼容**:
```
Transformers.js (主) + API 后端 (大任务)
覆盖率: 93%
```

**方案 B - 最佳性能** (您的方案):
```
MediaPipe (主) + Transformers.js (降级)
覆盖率: 93%
```

**方案 C - 最大灵活**:
```
WebLLM (主) + Transformers.js (降级)
覆盖率: 93%
```

---

*文档生成时间: 2026-01-13*
*WebGPU 支持率随时间推移会持续提升*
