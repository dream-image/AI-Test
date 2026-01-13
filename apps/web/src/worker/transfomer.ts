import { pipeline, TextStreamer, env } from '@huggingface/transformers';

// 性能优化配置
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 4; // 减少线程避免内存问题
env.backends.onnx.wasm.proxy = false;

class MyTextGenerationPipeline {
    static task = 'text-generation';
    // 🚀 SmolLM3-3B-Base - 3B模型，使用强力量化
    static model = 'HuggingFaceTB/SmolLM3-3B-Base';
    static instance: any = null;

    static async getInstance(progress_callback: ((data: any) => void) | null = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task as any, this.model, {
                progress_callback: progress_callback as any,
                // 🔥 关键：使用 q4 强力量化减少内存占用
                dtype: 'q4',
                // 🔥 优先使用 WebGPU 加速（如果可用）
                device: 'auto',
            });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
    const generator = await MyTextGenerationPipeline.getInstance((x) => {
        self.postMessage(x);
    });

    self.postMessage({ status: 'ready' });

    // 直接使用提示词
    const userPrompt = event.data.text;

    // 流式输出
    const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: function (text: string) {
            self.postMessage({
                status: "update",
                output: text,
            });
        },
    });

    // 生成参数（优化配置）
    const output = await generator(userPrompt, {
        max_new_tokens: event.data.max_new_tokens || 100, // 减少长度提升速度
        temperature: 0.7,
        top_k: 50,
        top_p: 0.9,
        do_sample: true,
        streamer,
    });

    self.postMessage({
        status: "complete",
        output: output[0].generated_text,
    });
});
