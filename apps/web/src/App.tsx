import { useEffect, useEffectEvent, useState } from 'react'

import './App.css'
import { Button, Tooltip } from '@heroui/react'

function App() {

  const [count, setCount] = useState(0)
  const a = useEffectEvent(() => {
    return count
  })
  useEffect(() => {
    setTimeout(() => {
      console.log(a())
    }, 5000)

  }, [])
  return (
    <div>
      <Button onPress={() => setCount(count + 1)}>你好</Button>
      <Tooltip content="你好">
        <h1>你好</h1>
      </Tooltip>
    </div>
  )
}


export default App
