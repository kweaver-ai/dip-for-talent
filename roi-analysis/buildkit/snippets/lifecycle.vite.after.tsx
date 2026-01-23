import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import { renderWithQiankun, qiankunWindow } from "vite-plugin-qiankun/dist/helper";
import App from "./App";
import type { MicroAppProps } from "./micro-app";
import "antd/dist/reset.css";
import "./index.css";

let root: ReturnType<typeof ReactDOM.createRoot> | null = null;

const render = (props?: MicroAppProps) => {
  const { container, route, token, user, setMicroAppState, onMicroAppStateChange } =
    props || {};
  const rootElement = container
    ? container.querySelector("#root") || container
    : document.querySelector("#root");

  if (!rootElement) {
    console.error("找不到根元素");
    return;
  }

  if (root) {
    root.unmount();
  }

  root = ReactDOM.createRoot(rootElement as HTMLElement);
  root.render(
    <React.StrictMode>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#b45309",
            colorTextBase: "#1f2937",
            fontFamily:
              "'IBM Plex Sans', 'Noto Sans SC', 'PingFang SC', sans-serif"
          }
        }}
      >
        <App
          basename={route?.basename}
          token={token}
          user={user}
          setMicroAppState={setMicroAppState}
          onMicroAppStateChange={onMicroAppStateChange}
        />
      </ConfigProvider>
    </React.StrictMode>
  );
};

renderWithQiankun({
  mount(props) {
    console.log("[微应用] mount", props);
    render(props);
  },
  bootstrap() {
    console.log("[微应用] bootstrap");
  },
  unmount(props: any) {
    console.log("[微应用] unmount");
    if (root) {
      root.unmount();
      root = null;
    }
  },
  update(props: any) {
    console.log("[微应用] update", props);
  }
});

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render();
}