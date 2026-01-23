import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// 定义渲染函数
let root: ReactDOM.Root | null = null

function render(props?: any = {}) {
    const { container, basename } = props
    const rootElement = container ? 
        container.querySelector('#root') || container :
        document.querySelector('#root')
    
    if (!rootElement) {
        console.error('找不到根元素')
        return
    }

    root = ReactDOM.createRoot(rootElement)
    root.render(<App basename={basename} />)
}

// 在非 qiankun 环境下独立运行
if (!window.__POWERED_BY_QIANKUN__) {
    render()
}

// 导出生命周期函数
export async function bootstrap() {
    console.log('[微应用] bootstrap')
}

export async function mount(props: any) {
    console.log('[微应用] mount', props)
    render(props)
}

export async function unmount(props: any) {
    console.log('[微应用] unmount', props)

    if (root) {
        root.unmount()
        root = null
    }
}