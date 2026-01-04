
import Toastify from 'toastify-js'

const worker = new Worker('/modal.worker.js');
let useBuiltIn = false;

// @ts-ignore
let initResolver: ((info: { size: number, name: string }) => void) | null = null;
let initProgressCallback: ((progress: number, loaded: number, total: number) => void) | null = null;
let askResolver: ((text: any) => void) | null = null;
let partialResolver: ((text: string) => void) | null = null;

export type ContentItem =
    | { type: 'text', text: string }
    | { type: 'image', image: Blob | ArrayBuffer }
    | { type: 'audio', audio: Blob | ArrayBuffer };

export type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string | ContentItem[];
};

// 检测是否为 Google Chrome 浏览器
const isChromeBrowser = () => {
    try {
        // @ts-ignore
        const uaData = navigator.userAgentData;
        if (uaData && uaData.brands) {
            // @ts-ignore
            return uaData.brands.some((b: any) => b.brand === 'Google Chrome');
        }
        // 降级使用 userAgent 字符串检测
        const ua = navigator.userAgent;
        // Chrome 的 UA 通常包含 'Chrome' 且不包含 'Edg' (Edge)
        return ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR');
    } catch (e) {
        return false;
    }
};

// 监听 Worker 消息（主要用于降级方案）
worker.onmessage = (e) => {
    // 如果启用了内置模型，忽略 Worker 消息
    if (useBuiltIn) return;

    const { type, text, error, progress, loaded, total, modelSize, modelName } = e.data;
    if (type === 'init-complete') {
        const caps = e.data.capabilities;
        let statusText = "大模型加载完毕 (纯文本模式)";
        if (caps?.audio && caps?.image) {
            statusText = "全功能多模态模型加载完毕 (语音+视觉)";
        } else if (caps?.image) {
            statusText = "多模态模型加载完毕 (仅视觉)";
        }

        Toastify({
            text: statusText,
            duration: 3000,
            gravity: "top",
            position: "center",
            style: {
                background: caps?.audio ? "#4CAF50" : "#FF9800",
            }
        }).showToast();
        initResolver?.({ size: modelSize, name: modelName });
        initResolver = null;
        initProgressCallback = null;
    } else if (type === 'init-progress') {
        if (initProgressCallback) {
            initProgressCallback(Number(progress), loaded, total);
        }
    } else if (type === 'ask-partial') {
        partialResolver?.(text);
    } else if (type === 'ask-complete') {
        askResolver?.(text);
        askResolver = null;
        partialResolver = null;
    } else if (type === 'error') {
        console.error('Worker 错误:', error);
        initResolver = null;
        initProgressCallback = null;
        askResolver = null;
        partialResolver = null;
        alert('加载或推理出错: ' + error);
    }
};

// 初始化函数
export const init = async (onProgress?: (progress: number, loaded: number, total: number) => void) => {
    // 尝试使用 Chrome 内置 AI
    try {
        const isChrome = isChromeBrowser();
        // @ts-ignore
        if (isChrome && 'LanguageModel' in self) {
            // @ts-ignore
            const availability = await self.LanguageModel.availability();

            console.log(`内置模型可用性: ${availability}`);

            if (availability !== 'unavailable') {
                // 模型可用或可下载
                let modelNewlyDownloaded = false;
                if (availability !== 'available') {
                    modelNewlyDownloaded = true;
                    // 如果需要下载，我们调用 onProgress 通知用户
                    console.log('内置模型需要下载...');
                }

                const options: any = {
                    expectedInputs: [
                        { type: "text" },
                        { type: "audio" },
                        { type: "image" },
                    ],
                    monitor(m: any) {
                        m.addEventListener('downloadprogress', (e: any) => {
                            const loaded = e.loaded;
                            // 假设 total 为 0 或者未知时，给一个默认进度处理
                            const total = e.total || 1000000000;

                            if (modelNewlyDownloaded && loaded === 1) {
                                console.log('模型下载完成，正在加载...');
                            }

                            if (onProgress) {
                                // 估算一个进度百分比，如果不知道 Total，就只传 loaded
                                const progressVal = e.total ? (loaded / e.total) * 100 : 0;
                                onProgress(progressVal, loaded, total);
                            }
                        });
                    }
                };

                // 创建会话以触发下载（如果需要）
                // @ts-ignore
                const session = await self.LanguageModel.create(options);

                // 成功创建会话，说明模型已就绪
                useBuiltIn = true;
                console.log('内置模型初始化成功。');

                // 显示成功 Toast
                Toastify({
                    text: "Chrome 内置 AI 模型加载完毕",
                    duration: 3000,
                    gravity: "top",
                    position: "center",
                    style: { background: "#2196F3" }
                }).showToast();

                // 销毁测试会话
                session.destroy();

                return { size: 0, name: 'Chrome Built-in AI' };
            }
        } else {
            if (!isChrome) {
                // @ts-ignore
                if ('LanguageModel' in self) {
                    console.log('检测到 LanguageModel API，但检测非 Chrome 浏览器，主动跳过内置模型。');
                } else {
                    console.log('非 Chrome 浏览器，且不支持 LanguageModel。');
                }
            } else {
                console.log('Chrome 浏览器，但不支持 LanguageModel API。');
            }
        }
    } catch (e) {
        console.error('尝试初始化内置模型失败，将降级:', e);
    }

    // 降级方案：使用 Worker
    return new Promise<{ size: number, name: string }>((resolve) => {
        initResolver = resolve;
        initProgressCallback = onProgress || null;
        worker.postMessage({ type: 'init' });
    });
}

/**
 * 发送问题、图片及音频数据给模型
 * @param options 输入参数及可选的流式回调
 */
export const ask = async (options: {
    messages: Message[],
    onPartial?: (token: string) => void
}) => {
    const { messages, onPartial } = options;

    // 如果使用内置模型
    if (useBuiltIn) {
        return new Promise<string>(async (resolve, reject) => {
            try {
                // 准备历史上下文 (Initial Prompts)
                const history = messages.slice(0, -1);
                const currentMsg = messages[messages.length - 1];

                const mapContent = async (msg: Message) => {
                    if (typeof msg.content === 'string') {
                        return msg.content;
                    }
                    // 多模态内容转换
                    const contentParts = [];
                    for (const item of msg.content) {
                        if (item.type === 'text') {
                            contentParts.push({ type: 'text', value: item.text });
                        } else if (item.type === 'image') {
                            let val = item.image;
                            // 即使 API 文档说支持 Blob/ImageBitmap，为了最大兼容性，转为 ArrayBuffer
                            if (val instanceof Blob) {
                                val = await val.arrayBuffer();
                            }
                            // 如果已经是 ArrayBuffer 则保持

                            contentParts.push({ type: 'image', value: val });
                        } else if (item.type === 'audio') {
                            let val = item.audio;
                            if (val instanceof Blob) {
                                val = await val.arrayBuffer();
                            }
                            contentParts.push({ type: 'audio', value: val });
                        }
                    }
                    return contentParts;
                };

                const initialPrompts = await Promise.all(history.map(async (m) => ({
                    role: m.role,
                    content: await mapContent(m)
                })));

                // 创建包含上下文的新会话
                // @ts-ignore
                const session = await self.LanguageModel.create({
                    initialPrompts: initialPrompts,
                    expectedInputs: [
                        { type: "text" },
                        { type: "audio" },
                        { type: "image" },
                    ],
                });

                const promptContent = await mapContent(currentMsg);
                console.log('@@@@@@,', typeof promptContent === 'string'
                    ? promptContent
                    : [{ role: currentMsg.role, content: promptContent }]);

                // 提示模型并流式接收结果
                const stream = session.promptStreaming(
                    typeof promptContent === 'string'
                        ? promptContent
                        : [{ role: currentMsg.role, content: promptContent }]
                );

                let fullText = '';
                for await (const chunk of stream) {
                    fullText += chunk;
                    if (onPartial) {
                        onPartial(chunk);
                    }
                }

                resolve(fullText);
                session.destroy();

            } catch (e) {
                console.error("内置模型推理失败:", e);
                reject(e);
            }
        });
    }

    // 降级方案：使用 Worker
    return new Promise<string>(async (resolve) => {
        askResolver = resolve;
        partialResolver = onPartial || null;

        const processedMessages: any[] = [];
        const transfers: Transferable[] = [];

        for (const msg of messages) {
            const newMsg = { ...msg };
            if (Array.isArray(msg.content)) {
                const newContent: any[] = [];
                for (const item of msg.content) {
                    if (item.type === 'image') {
                        const buffer = item.image instanceof Blob ? await item.image.arrayBuffer() : item.image;
                        newContent.push({ type: 'image', image: buffer });
                        if (buffer instanceof ArrayBuffer) transfers.push(buffer);
                    } else if (item.type === 'audio') {
                        try {
                            const audioBlob = item.audio instanceof Blob ? item.audio : new Blob([item.audio]);
                            const audioUrl = URL.createObjectURL(audioBlob);

                            newContent.push({
                                type: 'audio',
                                audio: audioUrl
                            });
                        } catch (e) {
                            console.error('音频URL转换失败:', e);
                        }
                    } else {
                        newContent.push(item);
                    }
                }
                newMsg.content = newContent;
            }
            processedMessages.push(newMsg);
        }

        worker.postMessage({ type: 'ask', payload: { messages: processedMessages } }, transfers);
    });
}