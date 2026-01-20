export type TokenInfo = {
  accessToken: string;
  refreshToken: () => Promise<{ accessToken: string }>;
  onTokenExpired?: (code?: number) => void;
};

export type RouteInfo = {
  basename: string;
};

export type UserInfo = {
  id: string;
  vision_name: string;
  account: string;
};

export type MicroAppStateSetter = (state: Record<string, any>) => boolean;

export type MicroAppStateChangeHandler = (
  callback: (state: any, prev: any) => void,
  fireImmediately?: boolean
) => () => void;

export type MicroAppProps = {
  token?: TokenInfo;
  route?: RouteInfo;
  user?: UserInfo;
  renderAppMenu?: (container: HTMLElement | string) => void;
  logout?: () => void;
  setMicroAppState?: MicroAppStateSetter;
  onMicroAppStateChange?: MicroAppStateChangeHandler;
  container?: HTMLElement;
};
