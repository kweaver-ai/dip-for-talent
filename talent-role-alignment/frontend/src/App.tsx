import React from 'react';
import { ConfigProvider, Layout } from 'antd';
import JobFit from './pages/JobFit';
import { Organization, OrganizationProvider } from './context/OrganizationContext';

const { Header, Content } = Layout;

export default function App() {
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = React.useState('');

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0f1c2e',
          borderRadius: 12,
          fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <OrganizationProvider value={{ organizations, selectedOrgId, setSelectedOrgId, setOrganizations }}>
        <Layout className="app-shell min-h-screen">
          <Header className="app-header app-header-sticky shadow-card">
            <div className="app-header-inner flex items-center justify-between py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-ink-400">DIP for Talent</div>
                <div className="text-lg font-semibold text-ink-900">人岗动态匹配分析</div>
              </div>
            </div>
          </Header>
          <Content className="app-content px-6 pb-10">
            <JobFit />
          </Content>
        </Layout>
      </OrganizationProvider>
    </ConfigProvider>
  );
}
