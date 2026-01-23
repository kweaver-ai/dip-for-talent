import { BrowserRouter, Route, Switch } from 'react-router-dom'
import type { MicroAppProps } from 'micro-app.d.ts'

const App = ({ basename = '/' }: MicroAppProps) => {
    return (
        <BrowserRouter basename={basename}>
        <Switch>
            <Route exact path="/" component={Home} />
            {/* 其他路由 */}
        </Switch>
        </BrowserRouter>
    )
}

export default App