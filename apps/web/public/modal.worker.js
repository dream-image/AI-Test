// 这是一个位于 public/modal.worker.js 的专用 Worker 文件
// 它绕过了 Vite 的构建过程，以避免与 MediaPipe 内部的加载机制发生语法或路径冲突

// 模拟 CommonJS 环境（Shim）
self.exports = {};
self.module = { exports: self.exports };

// 模拟 DOM 环境（由于 MediaPipe SDK 内部会进行类型检查，但在 Worker 中这些类不存在）
self.HTMLImageElement = self.HTMLImageElement || class { };
self.HTMLCanvasElement = self.HTMLCanvasElement || class { };
self.HTMLVideoElement = self.HTMLVideoElement || class { };

importScripts('/lib/mediapipe/genai_bundle.js');

// 从 module.exports 中提取
const { FilesetResolver, LlmInference } = self.module.exports;


let llmInference;
let isAudioSupported = false;
let isImageSupported = false;

// 辅助函数：判断对象是否符合 AudioChunk 接口结构
// AudioChunk 是 MediaPipe LLM Inference API 预期的音频输入格式
function instanceOfAudioChunk(object) {
    return (
        object &&
        'audioSampleRateHz' in object &&
        'audioSamples' in object &&
        object.audioSamples instanceof Float32Array
    );
}

/**
 * 将各种格式的音频源转换为模型可接受的 AudioChunk 格式
 * 
 * @param {string | Blob | AudioChunk | Object} audio - 音频源，可以是：
 *   1. URL 字符串 (将被 fetch 并解码)
 *   2. Blob 对象 (如录音产生的 Blob)
 *   3. 已经符合 AudioChunk 结构的对象
 *   4.包含 samples (Float32Array) 和 sampleRate 的普通对象
 *   5. AudioBuffer 类似对象
 * @returns {Promise<AudioChunk>} 返回符合模型输入的音频数据块
 */
async function getAudioFromSource(audio) {
    let arrayBuffer;

    // 情况 1: 输入是 URL 字符串
    if (typeof audio === 'string') {
        const response = await fetch(audio);
        if (!response.ok) {
            throw new Error(
                `音频获取失败: ${audio}, 状态码: ${response.status}`,
            );
        }
        arrayBuffer = await response.arrayBuffer();
    }
    // 情况 2: 输入是 Blob 对象（例如来自录音）
    else if (audio instanceof Blob) {
        arrayBuffer = await audio.arrayBuffer();
    }
    // 情况 3: 已经是 AudioChunk 格式，直接返回
    else if (instanceOfAudioChunk(audio)) {
        return audio;
    }
    // 情况 4: 类似序列化的音频对象 (包含 samples 和 sampleRate)
    else if (audio.samples && audio.sampleRate) {
        return {
            audioSamples: audio.samples instanceof Float32Array ? audio.samples : new Float32Array(audio.samples),
            audioSampleRateHz: audio.sampleRate
        };
    }
    // 情况 5: 类似 AudioBuffer 的对象
    else if (audio.getChannelData) {
        return {
            audioSamples: audio.getChannelData(0),
            audioSampleRateHz: audio.sampleRate,
        };
    }

    // 如果有了 ArrayBuffer (来自 URL 或 Blob)，则需要解码为 PCM 数据
    if (arrayBuffer) {
        // 在 Worker 环境中，首选 OfflineAudioContext 进行解码
        // 兼容性处理：部分浏览器可能在 Worker 中只支持标准的 AudioContext 或 webkitAudioContext
        const AudioContextCls = self.OfflineAudioContext || self.AudioContext || self.webkitAudioContext;
        if (!AudioContextCls) {
            throw new Error('当前环境不支持 Web Audio API，无法解码音频');
        }

        let audioContext;
        // OfflineAudioContext 需要参数：通道数、长度、采样率
        // 这里长度设为 1 只是为了实例化，decodeAudioData 会处理实际数据
        if (self.OfflineAudioContext) {
            audioContext = new OfflineAudioContext(1, 1, 16000);
        } else {
            audioContext = new AudioContext({ sampleRate: 16000 });
        }

        // 解码音频数据
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return {
            audioSamples: audioBuffer.getChannelData(0), // 获取单声道数据
            audioSampleRateHz: audioBuffer.sampleRate,
        };
    }

    throw new Error('不支持的音频格式');
}


const MODEL_URL = 'https://p4-ec.eckwai.com/kcdn/cdn-kcdn112411/llm/gemma-3n-E2B-it-int4-Web.litertlm';
const CACHE_NAME = 'models';
const CACHE_KEY = 'gemma-3n-E2B-it-int4-Web.litertlm';

// 从缓存加载或下载模型
async function loadModel() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(CACHE_KEY);

        if (cachedResponse) {
            console.log('Worker: 从缓存中发现模型文件');
            const blob = await cachedResponse.blob();
            return { url: URL.createObjectURL(blob), size: blob.size };
        }

        console.log('Worker: 未发现缓存，开始下载模型...');
        const response = await fetch(MODEL_URL);

        if (!response.ok) {
            throw new Error(`模型下载失败，状态码: ${response.status}`);
        }

        const contentLength = response.headers.get('content-length');
        if (!contentLength) {
            console.warn('Worker: 无法获取内容长度，进度将不可用');
        }

        const total = parseInt(contentLength, 10);
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            loaded += value.length;

            if (total) {
                const progress = (loaded / total) * 100;
                // 每隔一定进度发送一次消息，避免过于频繁
                self.postMessage({
                    type: 'init-progress',
                    progress: progress.toFixed(1),
                    loaded,
                    total
                });
            }
        }

        console.log('Worker: 模型下载完成，正在组装 Blob...');
        const blob = new Blob(chunks);

        // 存入缓存
        try {
            console.log('Worker: 正在写入缓存...');
            await cache.put(CACHE_KEY, new Response(blob));
            console.log('Worker: 缓存写入成功');
        } catch (cacheErr) {
            console.error('Worker: 缓存写入失败 (非致命错误)', cacheErr);
        }

        return { url: URL.createObjectURL(blob), size: blob.size };
    } catch (err) {
        throw new Error(`加载模型失败: ${err.message}`);
    }
}

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'init') {
        try {
            console.log('Worker: 开始初始化...');

            // 加载模型文件
            const { url: modelUrl, size: modelSize } = await loadModel();

            const genaiFileset = await FilesetResolver.forGenAiTasks(
                '/lib/mediapipe/wasm'
            );
            // console.log('modelBuffer', modelBuffer); // This line is commented out as modelBuffer is no longer used

            // 尝试开启全功能多模态（语音+视觉）
            try {
                llmInference = await LlmInference.createFromOptions(genaiFileset, {
                    baseOptions: {
                        modelAssetPath: modelUrl,
                        delegate: 'GPU'
                    },
                    temperature: 0.4,
                    topK: 30,
                    maxTokens: 1024,
                    maxNumImages: 5,
                    supportAudio: true
                });
                isAudioSupported = true;
                isImageSupported = true;
                console.log('Worker: 多模态模型（语音+视觉）加载成功');
            } catch (innerErr) {
                console.error('Worker: 多模态加载失败，尝试纯文本模式...', innerErr);
                // 降级重试：使用相同的 buffer
                llmInference = await LlmInference.createFromOptions(genaiFileset, {
                    baseOptions: {
                        modelAssetPath: modelUrl,
                        delegate: 'GPU'
                    },
                    temperature: 0.4,
                    topK: 30,
                    maxTokens: 1024
                });
                isAudioSupported = false;
                isImageSupported = false;
                console.log('Worker: 纯文本模型加载完成');
            }

            self.postMessage({
                type: 'init-complete',
                capabilities: { audio: isAudioSupported, image: isImageSupported },
                modelSize,
                modelName: CACHE_KEY
            });
        } catch (err) {
            console.error('Worker 初始化致命错误:', err);
            self.postMessage({ type: 'error', error: err.message || '初始化失败' });
        }
    } else if (type === 'ask') {
        if (!llmInference) {
            self.postMessage({ type: 'error', error: '模型尚未初始化' });
            return;
        }
        try {
            const { messages } = payload;
            const inputPayload = [];

            for (const msg of messages) {
                const { role, content } = msg;
                inputPayload.push(`<start_of_turn>${role}\n`);

                if (typeof content === 'string') {
                    inputPayload.push(content);
                } else if (Array.isArray(content)) {
                    for (const item of content) {
                        if (item.type === 'text') {
                            inputPayload.push(item.text);
                        } else if (item.type === 'image' && isImageSupported) {
                            const blob = new Blob([item.image]);
                            const imageBitmap = await createImageBitmap(blob);
                            inputPayload.push("<img>\n");
                            inputPayload.push({ imageSource: imageBitmap });
                        } else if (item.type === 'audio' && isAudioSupported) {
                            try {
                                const audioChunk = await getAudioFromSource(item.audio);
                                inputPayload.push("<u>\n"); // Gemma 模型特定的音频起始标记
                                inputPayload.push({ audioSource: audioChunk });
                            } catch (e) {
                                console.error('Worker: 处理音频源失败', e);
                            }
                        }
                    }
                }
                inputPayload.push(`<end_of_turn>\n`);
            }

            // 添加模型回复的起始标记
            inputPayload.push(`<start_of_turn>model\n`);

            // 日志确认
            // 构建日志负载，避免打印过大的二进制对象
            const logPayload = inputPayload.map(item => {
                if (typeof item === 'string') return item;
                if (item.imageSource) return `[图片位图 ${item.imageSource.width}x${item.imageSource.height}]`;
                if (item.audioSource) return `[该音频包含 ${item.audioSource.audioSamples.length} 个采样点 @ ${item.audioSource.audioSampleRateHz}Hz]`;
                return '[未知对象]';
            });
            console.log('Worker: 发送推理请求 (Payload 详情):', logPayload);

            let text = '';
            llmInference.generateResponse(inputPayload, (partialResults, complete) => {
                if (partialResults) {
                    text += partialResults;
                    self.postMessage({ type: 'ask-partial', text: partialResults });
                }

                if (complete) {
                    console.log('Worker: 推理完成。生成的文本长度:', text.length);
                    if (!text) {
                        text = isAudioSupported ? '模型未返回结果' : '模型未返回结果（注意：如果包含图片/音频，可能是因为当前加载的模型版本不支持多模态）';
                    }
                    self.postMessage({ type: 'ask-complete', text });
                }
            });
        } catch (err) {
            console.error('Worker 推理错误:', err);
            self.postMessage({ type: 'error', error: err.message || '推理失败' });
        }
    }
};
