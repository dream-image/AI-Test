import { useEffect, useRef, useState } from "react";
import Progress from "./components/Progress";

import "./TranslatorApp.css";

interface ProgressItem {
    file: string;
    progress: number;
}

function TranslatorApp() {
    // Model loading state
    const [ready, setReady] = useState<boolean | null>(null);
    const [disabled, setDisabled] = useState(false);
    const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

    // Inputs and outputs
    const [input, setInput] = useState("请写一首关于打工人牛马的诗");
    const [output, setOutput] = useState("");

    // Memory monitoring
    const [memoryUsage, setMemoryUsage] = useState<number>(0);
    const [totalMemory, setTotalMemory] = useState<number>(0);

    // Create a reference to the worker object.
    const worker = useRef<Worker | null>(null);

    // Monitor memory usage
    useEffect(() => {
        const timer = setInterval(() => {
            // @ts-ignore - performance.memory is available in Chrome
            const memory = window.performance?.memory;
            if (memory) {
                setMemoryUsage(memory.usedJSHeapSize);
                setTotalMemory(memory.totalJSHeapSize);
            }
        }, 2000); // Update every 2 seconds
        return () => clearInterval(timer);
    }, []);

    // We use the `useEffect` hook to setup the worker as soon as the component is mounted.
    useEffect(() => {
        // Create the worker if it does not yet exist.
        if (!worker.current) {
            worker.current = new Worker(
                new URL("./worker/transfomer.ts", import.meta.url),
                { type: "module" }
            );
        }

        // Create a callback function for messages from the worker thread.
        const onMessageReceived = (e: MessageEvent) => {
            switch (e.data.status) {
                case "initiate":
                    // Model file start load: add a new progress item to the list.
                    setReady(false);
                    setProgressItems((prev) => [...prev, e.data]);
                    break;

                case "progress":
                    // Model file progress: update one of the progress items.
                    setProgressItems((prev) =>
                        prev.map((item) => {
                            if (item.file === e.data.file) {
                                return { ...item, progress: e.data.progress };
                            }
                            return item;
                        })
                    );
                    break;

                case "done":
                    // Model file loaded: remove the progress item from the list.
                    setProgressItems((prev) =>
                        prev.filter((item) => item.file !== e.data.file)
                    );
                    break;

                case "ready":
                    // Pipeline ready: the worker is ready to accept messages.
                    setReady(true);
                    break;

                case "update":
                    // Generation update: update the output text (streaming).
                    setOutput((prev) => prev + e.data.output);
                    break;

                case "complete":
                    // Generation complete: re-enable the "Generate" button
                    setDisabled(false);
                    setOutput(e.data.output);
                    break;
            }
        };

        // Attach the callback function as an event listener.
        worker.current.addEventListener("message", onMessageReceived);

        // Define a cleanup function for when the component is unmounted.
        return () => {
            worker.current?.removeEventListener("message", onMessageReceived);
        };
    }, []);

    const generate = () => {
        setDisabled(true);
        setOutput("");
        worker.current?.postMessage({
            text: input,
            max_new_tokens: 128,
        });
    };

    // Helper function to format bytes
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="translator-container">
            <h1 className="translator-title">🤖 Transformers.js</h1>
            <h2 className="translator-subtitle">ML-powered text generation in React!</h2>

            {/* Memory Usage Monitor */}
            <div className="memory-monitor">
                <div className="memory-info">
                    <span className="memory-label">💾 JS Heap Memory:</span>
                    <span className={`memory-value ${memoryUsage > 2 * 1024 * 1024 * 1024 ? 'memory-warning' : ''}`}>
                        {formatBytes(memoryUsage)} / {formatBytes(totalMemory)}
                    </span>
                    <span className="memory-percentage">
                        ({totalMemory > 0 ? ((memoryUsage / totalMemory) * 100).toFixed(1) : 0}%)
                    </span>
                </div>
                <div className="memory-bar">
                    <div
                        className="memory-bar-fill"
                        style={{
                            width: `${totalMemory > 0 ? (memoryUsage / totalMemory) * 100 : 0}%`,
                            backgroundColor: memoryUsage > 2 * 1024 * 1024 * 1024 ? '#f59e0b' : '#3b82f6'
                        }}
                    />
                </div>
            </div>

            <div className="translator-content">
                <div className="textbox-container single">
                    <div className="textbox-wrapper">
                        <label className="textbox-label">Input Prompt</label>
                        <textarea
                            value={input}
                            rows={3}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Enter text prompt..."
                            className="translator-textarea"
                        />
                    </div>
                    <div className="textbox-wrapper">
                        <label className="textbox-label">Generated Output</label>
                        <textarea
                            value={output}
                            rows={5}
                            readOnly
                            placeholder="Generated text will appear here..."
                            className="translator-textarea output"
                        />
                    </div>
                </div>
            </div>

            <button
                disabled={disabled || ready === false}
                onClick={generate}
                className="translate-button"
            >
                {disabled ? "Generating..." : "Generate"}
            </button>

            <div className="progress-bars-container">
                {ready === false && (
                    <div className="loading-label">
                        <span className="loading-spinner">⏳</span>
                        Loading models... (only runs once)
                    </div>
                )}
                {progressItems.map((data) => (
                    <div key={data.file}>
                        <Progress text={data.file} percentage={data.progress} />
                    </div>
                ))}
            </div>

            {ready === true && (
                <div className="model-ready-badge">
                    ✅ Model loaded and ready!
                </div>
            )}
        </div>
    );
}

export default TranslatorApp;
