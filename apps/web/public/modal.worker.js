// 这是一个位于 public/modal.worker.js 的经典 Worker
// 它绕过了 Vite 的打包器，以避免与 MediaPipe 的语法冲突

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

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'init') {
        try {
            console.log('Worker: 开始初始化...');
            const genaiFileset = await FilesetResolver.forGenAiTasks(
                '/lib/mediapipe/wasm'
            );

            // 尝试开启全功能多模态（语音+视觉）
            try {
                llmInference = await LlmInference.createFromOptions(genaiFileset, {
                    baseOptions: { modelAssetPath: './gemma-3n-E2B-it-int4-Web.litertlm' },
                    temperature: 0.4,
                    topK: 30,
                    maxTokens: 1024,
                    maxNumImages: 1,
                    supportAudio: true
                });
                isAudioSupported = true;
                isImageSupported = true;
                console.log('Worker: 多模态模型（语音+视觉）加载成功');
            } catch (innerErr) {
                // 如果报错 "model_data is nullptr"，说明权重文件太小，不支持多模态
                if (innerErr.message && innerErr.message.includes('model_data is nullptr')) {
                    console.warn('Worker: 当前权重文件不支持多模态功能，正在尝试以降级模式（仅限文本）启动...');
                    llmInference = await LlmInference.createFromOptions(genaiFileset, {
                        baseOptions: { modelAssetPath: './weights.bin' },
                        temperature: 0.4,
                        topK: 30,
                        maxTokens: 1024
                    });
                    isAudioSupported = false;
                    isImageSupported = false;
                    console.log('Worker: 纯文本模型加载完成');
                } else {
                    throw innerErr;
                }
            }

            self.postMessage({
                type: 'init-complete',
                capabilities: { audio: isAudioSupported, image: isImageSupported }
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
                            const samples = new Float32Array(item.audio.samples);
                            inputPayload.push("<u>\n");
                            inputPayload.push({
                                audioSource: {
                                    audioSamples: samples,
                                    audioSampleRateHz: item.audio.sampleRate
                                }
                            });
                        }
                    }
                }
                inputPayload.push(`<end_of_turn>\n`);
            }

            // 添加模型回复的起始标记
            inputPayload.push(`<start_of_turn>model\n`);

            // 日志确认
            const logPayload = inputPayload.map(item => {
                if (typeof item === 'string') return item;
                if (item.imageSource) return `[ImageBitmap ${item.imageSource.width}x${item.imageSource.height}]`;
                if (item.audioSource) return `[AudioSource ${item.audioSource.audioSamples.length} samples @ ${item.audioSource.audioSampleRateHz}Hz]`;
                return '[Unknown Object]';
            });
            console.log('Worker: 发送推理请求 (Payload 详情):', logPayload);

            let text = '';
            llmInference.generateResponse(inputPayload, (partialResults, complete) => {
                if (partialResults) {
                    text += partialResults;
                    self.postMessage({ type: 'ask-partial', text: partialResults });
                }

                if (complete) {
                    console.log('Worker: 推理完成。结果长度:', text.length);
                    if (!text) {
                        text = isAudioSupported ? '结果为空' : '结果为空（注意：模型由于能力限制跳过了附件）';
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
