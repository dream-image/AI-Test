
import Toastify from 'toastify-js'

const worker = new Worker('/modal.worker.js');

let initResolver: (() => void) | null = null;
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

worker.onmessage = (e) => {
    const { type, text, error } = e.data;
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
        initResolver?.();
        initResolver = null;
    } else if (type === 'ask-partial') {
        partialResolver?.(text);
    } else if (type === 'ask-complete') {
        askResolver?.(text);
        askResolver = null;
        partialResolver = null;
    } else if (type === 'error') {
        console.error('Worker 错误:', error);
        initResolver = null;
        askResolver = null;
        partialResolver = null;
        alert('加载或推理出错: ' + error);
    }
};

export const init = async () => {
    return new Promise<void>((resolve) => {
        initResolver = resolve;
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
                            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                            const arrayBuffer = await audioBlob.arrayBuffer();
                            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                            const samples = audioBuffer.getChannelData(0);

                            newContent.push({
                                type: 'audio',
                                audio: {
                                    samples: samples.buffer,
                                    sampleRate: audioBuffer.sampleRate
                                }
                            });
                            transfers.push(samples.buffer);
                            await audioCtx.close();
                        } catch (e) {
                            console.error('音频提取失败:', e);
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