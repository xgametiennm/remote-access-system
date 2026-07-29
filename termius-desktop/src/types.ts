export interface SavedHost {
  id: string;
  name: string;
  ip: string;
  port: number;
  authType?: 'agent' | 'password';
  username?: string;
  password?: string;
  group?: string;
  tags?: string[];
  createdAt: string;
}

export interface TabSession {
  id: string;
  title: string;
  ip: string;
  port: number;
  authType?: 'agent' | 'password';
  username?: string;
  password?: string;
  connectedAt: string;
  status: 'connecting' | 'connected' | 'disconnected';
}
