import { useEffect, useRef, useState } from 'react'

import './App.css'
import { Button, Card, CardBody, CardFooter, Spinner, Textarea } from '@heroui/react'
import { useAsyncEffect, useMount } from 'ahooks'

const createSession = async () => {
  const controller = new AbortController()
  //@ts-ignore
  const session = await LanguageModel.create({
    monitor(m: any) {
      m.addEventListener('downloadprogress', (e: any) => {
        console.log(`Downloaded ${e.loaded * 100}%`);
      });
    },
    signal: controller.signal
  });
  return {
    session,
    controller
  }
}
function App() {
  const controllerRef = useRef<AbortController>(new AbortController())
  const sessionRef = useRef<any>(null)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState("")
  const [message, setMessage] = useState<{
    role: 'user' | 'assistant' | 'system',
    content: string
  }[]>([
    {
      role: "system",
      content: `
你是一位精通中文的语言润色专家，擅长将文本润色为优美、流畅且富有诗意的中文表达。请遵循以下要求：

若输入文本为纯中文，则输出必须为中文，并保持文意不变；

对文本进行措辞优化、句式调整，带有诗词的对仗和工整；

不添加额外解释，直接输出润色后的完整文本。
      `
    },
    {
      role: "assistant",
      content: "我是你的小助手，有什么需要帮忙的？"
    }
  ])
  const init = async () => {
    //@ts-ignore
    const res = await LanguageModel.availability({ languages: ["en", "ja"] });
    console.log(res)
    const { session, controller } = await createSession()
    sessionRef.current = session
    controllerRef.current = controller
  }

  useMount(() => {
    init()
  })
  return (
    <div>
      <Card>
        <CardBody className=''>
          {
            message?.filter(i => i.role !== 'system')?.map?.((i, index) => {
              return <div key={index} className={`${i.role === 'user' ? ' text-end' : ''} w-full `}>{i.content}</div>
            })
          }
        </CardBody>
        <CardFooter className=' justify-end'>
          {sessionRef.current?.inputQuota && sessionRef.current?.inputUsage && `${sessionRef.current.inputUsage || 0}/${sessionRef.current.inputQuota}`}
        </CardFooter>
      </Card>
      {
        <div className='mt-3 flex items-center gap-2'>
          <Textarea
            classNames={{
              base: "w-full",
              input: "resize-y min-h-[40px]",
            }}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
            }}
            placeholder="请输入"
            variant="bordered"
          />
          <Button isLoading={loading} color="primary" onPress={() => {
            const _message = message.concat({
              role: 'user',
              content: text
            })
            setText('')
            setMessage(_message);
            ; (async () => {
              const stream = await sessionRef.current.promptStreaming(_message)

              _message.push({
                role: 'assistant',
                content: ""
              })
              setLoading(true)
              for await (const chunk of stream) {
                _message[_message.length - 1].content += chunk
                console.log('chunk', chunk);

                setMessage(_message)
              }
              setLoading(false)
            })()
          }}>确定</Button>
        </div>
      }


    </div>
  )
}


export default App
