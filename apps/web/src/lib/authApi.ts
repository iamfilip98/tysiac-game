const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

interface RegisterData {
  email: string;
  password: string;
  displayName: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface AuthResponse {
  playerId: string;
  authToken: string;
  displayName: string;
}

interface ProfileResponse {
  playerId: string;
  displayName: string;
  email: string;
  isRegistered: boolean;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    totalBidsWon: number;
    totalBidsFailed: number;
    totalMarriages: number;
    highestGameScore: number;
    currentWinStreak: number;
    longestWinStreak: number;
    rating: number;
  };
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data as T;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function login(data: LoginData): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logout(token: string): Promise<void> {
  await apiRequest('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getProfile(token: string): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
