import type { MicroAppProps } from 'micro-app.d.ts'

const App = ({ basename, token, user }: MicroAppProps) => {
  // 使用 token
  useEffect(() => {
    if (token) {
      // 设置 HTTP 请求的 token
      // axios.defaults.headers.common['Authorization'] = `Bearer ${token.accessToken}`
      
      // 监听 token 过期
      if (token.onTokenExpired) {
        // 在 HTTP 拦截器中调用
      }
    }
  }, [token])

  return (
    <BrowserRouter basename={basename}>
      {/* 应用内容 */}
    </BrowserRouter>
  )
}