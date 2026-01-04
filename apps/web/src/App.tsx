import { useEffect, useRef, useState } from 'react'

import './App.css'
import { Button, Card, CardBody, CardFooter, Spinner, Textarea } from '@heroui/react'
import { useAsyncEffect, useMemoizedFn, useMount, useThrottleFn } from 'ahooks'
import { isString } from 'es-toolkit'
import { ask, init as initModal } from './modal'
import type { Message, ContentItem } from './modal'

function App() {
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState("")
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)

  const [modelSize, setModelSize] = useState<number>(0)
  const [modelName, setModelName] = useState<string>('')
  const [memoryUsage, setMemoryUsage] = useState<number>(0)

  // 监控内存使用
  useEffect(() => {
    const timer = setInterval(() => {
      // @ts-ignore
      const memory = window.performance?.memory;
      if (memory) {
        setMemoryUsage(memory.usedJSHeapSize);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // 录音相关状态
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // 移除预加载逻辑，改为手动上传
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // 性能优化：用于存储最新的流式文本，供节流更新使用
  const latestTextRef = useRef("");

  const [message, setMessage] = useState<Message[]>([
    {
      role: "system",
      content: "你是一个端侧多模态助手。你能识别图片、听懂语音并流畅交流。请始终使用中文回答，且回答力求简洁、专业。"
    },
    {
      role: "assistant",
      content: "我是你的小助手，有什么需要帮忙的？(支持语音、图片上传及流式响应)"
    }
  ])

  // 节流处理消息列表更新，降低 React 渲染频率
  const { run: throttledUpdateMessage } = useThrottleFn(
    (textValue: string) => {
      setMessage(prev => {
        const next = [...prev];
        if (next.length > 0) {
          // 更新最后一条助手消息
          next[next.length - 1] = { ...next[next.length - 1], content: textValue };
        }
        return next;
      });
    },
    { wait: 80 } // 80ms 节流，平衡了实时感与性能
  );

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioPreviewUrl(url);
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('无法启动录音:', err);
      alert('请允许麦克风权限以使用语音功能');
    }
  }

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  }

  // 处理图片选择
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageBlob(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  // 清除图片
  const clearImage = () => {
    setImageBlob(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // 清除录音
  const clearAudio = () => {
    setAudioBlob(null);
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
  }

  const sendMessage = useMemoizedFn(async () => {
    // 1. 构造当前用户输入的 ContentItem 数组
    const userContent: ContentItem[] = [];
    if (text.trim()) {
      userContent.push({ type: 'text', text });
    }
    if (imageBlob) {
      userContent.push({ type: 'image', image: imageBlob });
    }
    if (audioBlob) {
      userContent.push({ type: 'audio', audio: audioBlob });
    }

    if (userContent.length === 0) return;

    const newUserMessage: Message = { role: 'user', content: userContent };

    // 更新消息列表，添加用户新消息和助手的占位消息
    const updatedMessages = [...message, newUserMessage];
    const assistantPlaceholder: Message = { role: 'assistant', content: "" };

    setMessage([...updatedMessages, assistantPlaceholder]);

    setLoading(true);
    const originalText = text;
    setText('');
    const originalAudio = audioBlob;
    // clearAudio(); // 发送时清除预览

    // 2. 准备流式接收助手消息
    latestTextRef.current = "";

    try {
      const res = await ask({
        messages: updatedMessages,
        onPartial: (token) => {
          latestTextRef.current += token;
          throttledUpdateMessage(latestTextRef.current);
        }
      });

      // 3. 推理结束后进行一次强制同步，确保最后一段内容不被节流丢弃
      setMessage(prev => {
        const next = [...prev];
        if (next.length > 0) {
          next[next.length - 1] = { ...next[next.length - 1], content: res };
        }
        return next;
      });
    } catch (e) {
      console.error(e);
      alert('发送失败，请查看控制台日志');
    } finally {
      setLoading(false);
    }
  })

  // 模型加载进度
  const [modelReady, setModelReady] = useState(false)
  const [progress, setProgress] = useState(0)

  // ... existing states ...

  useMount(() => {
    initModal((p) => {
      setProgress(p)
    }).then((res) => {
      setModelReady(true)
      setModelSize(res?.size || 0)
      setModelName(res?.name || '')
    })
  })

  // 如果模型未就绪，显示加载进度界面
  if (!modelReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 from-gray-50 to-gray-100">
        <Card className="w-full max-w-md p-6 shadow-xl">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" color="primary" />
            <div className="flex flex-col items-center gap-1 w-full">
              <h2 className="text-xl font-bold text-gray-800">正在启动多模态助手</h2>
              <p className="text-sm text-gray-500">首次加载模型文件较大 (约2GB)，请耐心等待...</p>
            </div>

            {progress > 0 && (
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs text-gray-500 px-1">
                  <span>下载中...</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-center text-gray-400 max-w-[80%]">
              模型将缓存至浏览器本地，下次访问可秒级启动
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* 状态监控栏 */}
      <div className="mb-4 p-2 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center text-xs text-gray-600 shadow-sm">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-800">📦 模型大小:</span>
            <span>{modelSize ? formatBytes(modelSize) : '未知'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-800">🧠 页面 JS 内存:</span>
            <span className={`${memoryUsage > 500 * 1024 * 1024 ? 'text-orange-500 font-bold' : ''}`}>
              {memoryUsage ? formatBytes(memoryUsage) : '不可用'}
            </span>
          </div>
        </div>
        <div>
          <span className="text-gray-400">{modelName || 'Gemma-2B-Int4'} (GPU 加速)</span>
        </div>
      </div>

      <Card>
        <CardBody className='min-h-[300px] gap-2'>
          {
            message?.filter(i => i.role !== 'system')?.map?.((i, index) => {
              const displayContent = () => {
                if (typeof i.content === 'string') {
                  return i.content || (loading && index === (message.filter(m => m.role !== 'system').length - 1) ? '正在思考...' : '');
                }
                return i.content.map((item, idx) => {
                  if (item.type === 'text') return <div key={idx}>{item.text}</div>;
                  if (item.type === 'image') return <div key={idx}>[图片内容]</div>;
                  if (item.type === 'audio') return <div key={idx}>[语音内容]</div>;
                  return null;
                });
              };

              return <div key={index} className={`${i.role === 'user' ? ' text-end' : ''} w-full py-1 `}>
                <div className={`inline-block px-3 py-2 rounded-lg ${i.role === 'user' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 shadow-sm border border-gray-200'}`}>
                  {displayContent()}
                </div>
              </div>
            })
          }
        </CardBody>
        <CardFooter className='flex-col items-start gap-2 border-t border-gray-100'>
          <div className="flex flex-wrap gap-2">
            {imagePreview && (
              <div className="relative group">
                <img src={imagePreview} alt="预览" className="h-20 w-20 object-cover rounded-md border" />
                <Button
                  isIconOnly
                  size="sm"
                  color="danger"
                  variant="solid"
                  className="absolute -top-2 -right-2 min-w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onPress={clearImage}
                >
                  ×
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {imageBlob && <span className="text-xs text-blue-500 font-medium">📸 已选择图片: {imageBlob instanceof File ? imageBlob.name : '未知文件'}</span>}
            {audioPreviewUrl && (
              <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded border border-green-100">
                <span className="text-xs text-green-600 font-medium">🎤 录制就绪:</span>
                <audio src={audioPreviewUrl} controls className="h-8 max-w-[180px]" />
                <Button isIconOnly size="sm" variant="light" color="danger" onPress={clearAudio} className="h-6 w-6 min-w-0">×</Button>
              </div>
            )}
          </div>
        </CardFooter>
      </Card>

      <div className='mt-4 flex flex-col gap-3'>
        <div className="flex gap-2 flex-wrap">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />
          <Button
            color="secondary"
            variant="flat"
            onPress={() => fileInputRef.current?.click()}
            isDisabled={loading}
          >
            📷 上传图片
          </Button>
          <Button
            color={isRecording ? "danger" : "default"}
            onPress={isRecording ? stopRecording : startRecording}
            variant="flat"
            isDisabled={loading}
          >
            {isRecording ? "🔴 停止录音" : "🎤 语音输入"}
          </Button>
        </div>

        <div className="flex items-end gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200">
          <Textarea
            classNames={{
              base: "w-full",
              input: "resize-y min-h-[44px] py-2 px-1",
              inputWrapper: "border-0 bg-transparent shadow-none"
            }}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
            }}
            placeholder={isRecording ? "正在录制您的语音..." : "描述这张图片或说点什么..."}
            variant="flat"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage()
              }
            }}
          />
          <Button
            isLoading={loading}
            color="primary"
            onPress={sendMessage}
            className="mb-1"
            isDisabled={isRecording}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  )
}

export default App
