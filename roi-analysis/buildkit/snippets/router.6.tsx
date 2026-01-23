import { BrowserRouter, Routes, Route } from 'react-router-dom'
import type { MicroAppProps } from './micro-app.d.ts'

const App = ({ basename = '/' }: MicroAppProps) => {
    return (
        <BrowserRouter basename={basename}>
        <Routes>
            <Route path="/" element={<Home />} />
            {/* 其他路由 */}
        </Routes>
        </BrowserRouter>
    )
}

export default App