import { useState } from 'react'

import './App.css'
import { Button } from '@heroui/react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <Button>你好</Button>
    </div>
  )
}

export default App
