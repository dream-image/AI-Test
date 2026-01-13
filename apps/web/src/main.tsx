import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { HeroUIProvider } from "@heroui/react";
import "toastify-js/src/toastify.css"
import TranslatorApp from './TranslatorApp.tsx';
createRoot(document.getElementById('root')!).render(
  <HeroUIProvider>
    {/* <App /> */}
    <TranslatorApp />
  </HeroUIProvider>

)
