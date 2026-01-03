
import Toastify from 'toastify-js'

const worker = new Worker('/modal.worker.js');

let initResolver: (() => void) | null = null;
let askResolver: ((text: any) => void) | null = null;
let partialResolver: ((text: string) => void) | null = null;

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
    question: string,
    image?: Blob,
    audio?: Blob,
    onPartial?: (token: string) => void
}) => {
    const { question, image, audio, onPartial } = options;
    return new Promise<string>(async (resolve) => {
        askResolver = resolve;
        partialResolver = onPartial || null;

        const payload: any = { question };
        const transfers: Transferable[] = [];

        // 处理图像数据
        if (image) {
            const buffer = await image.arrayBuffer();
            payload.image = buffer;
            transfers.push(buffer);
        }

        // 处理音频数据：主线程预处理（降采样至 16kHz）
        if (audio) {
            try {
                // MediaPipe GenAI 期望 16kHz 的单声道音频
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                const arrayBuffer = await audio.arrayBuffer();
                console.log('Main: 开始解码音频...', audio.size, '字节');
                const start = Date.now();
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                const samples = audioBuffer.getChannelData(0); // 获取第一声道
                console.log(`Main: 音频解码完成, 耗时: ${Date.now() - start}ms, 长度: ${audioBuffer.duration.toFixed(2)}s`);

                // 增加振幅检测并拦截
                let maxAmp = 0;
                for (let i = 0; i < samples.length; i++) {
                    const abs = Math.abs(samples[i]);
                    if (abs > maxAmp) maxAmp = abs;
                }
                console.log(`Main: 音频最大振幅: ${maxAmp.toFixed(5)}`);

                if (maxAmp < 0.015) {
                    await audioCtx.close();
                    throw new Error('语音信号太弱，请大声一点，或靠近麦克风。');
                }

                payload.audio = {
                    samples: samples.buffer, // 发送原始浮动采样数据
                    sampleRate: audioBuffer.sampleRate
                };
                transfers.push(samples.buffer);
                await audioCtx.close();
            } catch (e) {
                console.error('音频解码失败:', e);
            }
        }

        worker.postMessage({ type: 'ask', payload }, transfers);
    });
}