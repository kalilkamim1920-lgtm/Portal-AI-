/**
 * Types shared across the frontend.
 */
export type PlanId = 'free' | 'basic' | 'pro' | 'premium';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  createdAt: string | null;
  language: 'ar' | 'en';
  settings: {
    defaultModel?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
  };
}

export interface UsageInfo {
  plan: PlanId;
  planName: string;
  limits: { messages: number; images: number };
  used: { messages: number; images: number; toolCalls: number };
  remaining: { messages: number; images: number };
  date: string;
}

export interface MeResponse {
  user: UserProfile;
  plan: PlanId;
  planName: string;
  usage: UsageInfo;
  isAdmin: boolean;
  providers: {
    chat: string | null;
    image: string | null;
    models: { id: string; name: string; provider: string; badge: string }[];
  };
}

export interface Conversation {
  id: string;
  title: string;
  model?: string;
  lastMessage?: string;
  kind?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  model?: string;
  createdAt?: string;
  attachments?: { name?: string; mimeType?: string; size?: number }[];
  pending?: boolean;
  error?: string;
}

export interface ImageItem {
  id: string;
  url: string;
  prompt: string;
  size: string;
  style: string;
  provider: string;
  createdAt: string | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  nameAr: string;
  price: number;
  currency: string;
  dailyMessages: number;
  dailyImages: number;
  features: string[];
  active: boolean;
}

export interface SubscriptionInfo {
  plan: PlanId;
  status: string;
  enabled: boolean;
  startedAt: string | null;
  endsAt: string | null;
  canceledAt: string | null;
  amount: number;
  currency: string;
  demo: boolean;
}

export interface Invoice {
  id: string;
  plan: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  demo: boolean;
  createdAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  read: boolean;
  broadcast: boolean;
  createdAt: string | null;
}

export interface ToolSpec {
  id: string;
  name: string;
  nameAr: string;
  fields: string[];
}

export interface AdminStats {
  users: { total: number; activeLast7d: number };
  subscriptions: { active: number; planDistribution: Record<string, number> };
  content: { messages: number; images: number; conversations: number };
  invoices: number;
  usageByDay: { date: string; messages: number; images: number }[];
  generatedAt: string;
}

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: string;
  plan: string;
  disabled: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
}

export interface ActivityLog {
  id: string;
  uid: string | null;
  action: string;
  meta: Record<string, unknown>;
  ip: string | null;
  createdAt: string | null;
}
