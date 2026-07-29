export interface SavedHost {
  id: string;
  name: string;
  ip: string;
  port: number;
  group?: string;
  tags?: string[];
  createdAt: string;
}

export interface TabSession {
  id: string;
  title: string;
  ip: string;
  port: number;
  connectedAt: string;
  status: 'connecting' | 'connected' | 'disconnected';
}
