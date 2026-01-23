import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import type { MicroAppProps } from 'micro-app.d.ts'

const App = ({
  basename = '/',
  setMicroAppState,
  onMicroAppStateChange 
}: MicroAppProps) => {
  // 监听全局状态变化（如语言切换）
  useEffect(() => {
    if (!onMicroAppStateChange) return

    const unsubscribe = onMicroAppStateChange((state, prev) => {
      console.log('全局状态变化:', state, prev)
      
      // 处理语言切换等
      if (state.language !== prev.language) {
        // 更新应用语言
        // i18n.changeLanguage(state.language)
      }
    }, true) // fireImmediately: true 表示立即触发一次

    return () => {
      unsubscribe()
    }
  }, [onMicroAppStateChange])

  // 更新面包屑示例
  const updateBreadcrumb = () => {
    if (setMicroAppState) {
      setMicroAppState({
        breadcrumb: [
          { name: '首页', path: '/' },
          { name: '当前页面', path: '/current' }
        ]
      })
    }
  }

  return (
    <BrowserRouter basename={basename}>
      {/* 应用内容 */}
    </BrowserRouter>
  )
}