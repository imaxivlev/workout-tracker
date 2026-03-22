/**
 * API клиент для работы с бэкендом
 * Автоматически передаёт JWT cookies, обрабатывает ошибки и retry для сетевых сбоев
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  retries?: number;
}

async function apiFetch<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { retries = 2, ...fetchOptions } = options;

  const defaultOptions: RequestInit = {
    credentials: 'include', // автоматически передаёт HTTP-only cookies
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  };

  const config: RequestInit = { ...defaultOptions, ...fetchOptions };

  let lastError: Error = new Error('Неизвестная ошибка');

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData: { error?: string; code?: string; details?: Array<{ field: string; message: string }> } = {};
        try {
          errorData = await response.json();
        } catch {
          // Если не удалось распарсить JSON
        }

        throw new ApiError(
          response.status,
          errorData.code || 'UNKNOWN_ERROR',
          errorData.error || `Ошибка ${response.status}`,
          errorData.details
        );
      }

      // Для DELETE без тела
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof ApiError) {
        // Не ретраим клиентские ошибки (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
      }

      lastError = error as Error;

      // Ретраим только при сетевых ошибках или 5xx
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError;
}

// --- Auth ---

export const authApi = {
  async register(email: string, password: string, firstName?: string, lastName?: string) {
    return apiFetch<{ user: { id: string; email: string } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName: firstName || undefined, lastName: lastName || undefined }),
    });
  },

  async login(email: string, password: string) {
    return apiFetch<{ user: { id: string; email: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout() {
    return apiFetch<void>('/api/auth/logout', { method: 'POST' });
  },

  async verifyEmail(token: string) {
    return apiFetch<{ message: string }>(`/api/auth/verify?token=${token}`);
  },

  async requestPasswordReset(email: string) {
    return apiFetch<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async confirmPasswordReset(token: string, password: string) {
    return apiFetch<{ message: string }>('/api/auth/reset-password/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
};

// --- Workouts ---

export interface SkillSet {
  id: string;
  reps: number;
  weight: number;
}

export interface SkillBlock {
  id: string;
  exercise: { id: string; name: string };
  sets: SkillSet[];
}

export interface WodExercise {
  id: string;
  exercise: { id: string; name: string };
  reps: number;
  weight?: number;
}

export interface WodBlock {
  id: string;
  wodType: 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA';
  level: 'RX' | 'SCALED';
  timeCapSeconds?: number;
  isLadder: boolean;
  resultType: 'TIME' | 'REPS' | 'WEIGHT';
  resultDisplay: string;
  resultSeconds?: number;
  resultTotalReps?: number;
  exercises: WodExercise[];
}

export interface Workout {
  id: string;
  date: string;
  comment?: string;
  createdAt: string;
  skillBlocks: SkillBlock[];
  wodBlocks: WodBlock[];
}

export interface WorkoutsResponse {
  workouts: Workout[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    totalPages: number;
  };
}

export interface WorkoutInput {
  date: string;
  comment?: string;
  isClubTemplate?: boolean;
  skillBlocks?: Array<{
    exerciseName: string;
    sets: Array<{ reps: number; weight: number }>;
  }>;
  wodBlocks?: Array<{
    wodType: 'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA';
    level: 'RX' | 'SCALED';
    timeCapSeconds?: number;
    isLadder: boolean;
    resultType: 'TIME' | 'REPS' | 'WEIGHT';
    resultDisplay: string;
    resultSeconds?: number;
    resultTotalReps?: number;
    exercises: Array<{
      exerciseName: string;
      reps: number;
      weight?: number;
    }>;
  }>;
}

export const workoutsApi = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    exerciseId?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.exerciseId) query.set('exerciseId', params.exerciseId);
    const qs = query.toString();
    return apiFetch<WorkoutsResponse>(`/api/workouts${qs ? `?${qs}` : ''}`);
  },

  async getById(id: string) {
    return apiFetch<{ workout: Workout }>(`/api/workouts/${id}`);
  },

  async create(data: WorkoutInput) {
    return apiFetch<{ workout: Workout; message: string }>('/api/workouts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<WorkoutInput>) {
    return apiFetch<{ workout: Workout }>(`/api/workouts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiFetch<void>(`/api/workouts/${id}`, { method: 'DELETE' });
  },

  async getDates() {
    return apiFetch<{ dates: Record<string, { hasSkill: boolean; hasWod: boolean }> }>('/api/workouts/dates');
  },
};

// --- Statistics ---

export interface DashboardStats {
  workoutsThisMonth: number;
  tonnageThisMonth: number;
  bestWeight: { exerciseName: string; weight: number; date: string } | null;
  streak: { days: number; weeks: number };
  recentWorkouts: Workout[];
}

export interface StatsData {
  workoutsCount: number;
  skillSessions: number;
  wodSessions: number;
  newPRs: number;
  personalRecords: Array<{ exerciseName: string; weight: number; date: string; reps: number }>;
}

export interface ExerciseStats {
  personalRecords: {
    maxWeight: number | null;
    maxReps: number | null;
    best1RM: number | null;
  };
  progressHistory: Array<{
    date: string;
    weight: number;
    reps: number;
    estimated1RM: number;
  }>;
}

export const statisticsApi = {
  async getDashboard() {
    return apiFetch<DashboardStats>('/api/statistics/dashboard');
  },

  async getExerciseStats(exerciseId: string, params?: { startDate?: string; endDate?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    return apiFetch<ExerciseStats>(`/api/statistics/exercise/${exerciseId}${qs ? `?${qs}` : ''}`);
  },

  async getStats(period: 'week' | 'month' | 'year' | 'all') {
    return apiFetch<StatsData>(`/api/statistics/stats?period=${period}`);
  },
};

// --- Exercises ---

export interface Exercise {
  id: string;
  name: string;
  isGlobal: boolean;
}

export const exercisesApi = {
  async search(query: string, limit?: number, withData?: boolean) {
    const params = new URLSearchParams({ query });
    if (limit) params.set('limit', String(limit));
    if (withData) params.set('withData', 'true');
    return apiFetch<{ exercises: Exercise[] }>(`/api/exercises?${params.toString()}`);
  },

  async getLastHistory(name: string, excludeWorkoutId?: string) {
    let url = `/api/exercises/history?name=${encodeURIComponent(name)}`;
    if (excludeWorkoutId) {
      url += `&excludeWorkoutId=${encodeURIComponent(excludeWorkoutId)}`;
    }
    return apiFetch<{ lastWeight: number | null; lastDate: string | null }>(url);
  },
};

// --- User ---

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  createdAt: string;
}

export const userApi = {
  async getProfile() {
    return apiFetch<{ user: UserProfile }>('/api/user/profile');
  },

  async updateProfile(data: { firstName?: string; lastName?: string; avatar?: string }) {
    return apiFetch<{ user: UserProfile }>('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async changeEmail(newEmail: string) {
    return apiFetch<{ message: string }>('/api/user/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail }),
    });
  },

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
    return apiFetch<{ message: string }>('/api/user/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  },

  async deleteAccount(password: string, csrfToken: string) {
    return apiFetch<void>('/api/user/delete-account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
      headers: { 'X-CSRF-Token': csrfToken },
    });
  },
};

// --- Migration ---

export const migrationApi = {
  async migrate(workouts: unknown[]) {
    return apiFetch<{ imported: number; failed: number; errors: string[] }>('/api/migration', {
      method: 'POST',
      body: JSON.stringify({ workouts }),
    });
  },
};

// --- Clubs ---

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  logo: string | null;
  memberCount: number;
  myRole: 'OWNER' | 'COACH' | 'ATHLETE' | null;
  createdAt: string;
}

export interface ClubMember {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'OWNER' | 'COACH' | 'ATHLETE';
  showInLeaderboard: boolean;
  joinedAt: string;
}

export interface ClubWorkoutTemplate {
  signature: string;
  firstWorkoutId: string;
  date: string;
  athleteCount: number;
  athletes: Array<{ userId: string; name: string; workoutId: string }>;
  skillBlocks: Array<{
    exerciseName: string;
    sets: Array<{ reps: number; weight: number }>;
  }>;
  wodBlocks: Array<{
    wodType: string;
    level: string;
    timeCapSeconds: number | null;
    isLadder: boolean;
    exercises: Array<{ exerciseName: string; reps: number; weight: number | null }>;
  }>;
}

export interface WodLeaderboardEntry {
  userId: string;
  name: string;
  workoutId: string;
  wodType: string;
  level: string;
  resultDisplay: string;
  resultSeconds: number | null;
  resultTotalReps: number | null;
  weightsUsed: string | null;
  rank?: number;
}

export interface MonthlyLeaderboardEntry {
  userId: string;
  name: string;
  workoutCount: number;
  tonnage: number;
  activeDays: number;
}

export interface SkillLeaderboardEntry {
  exerciseName: string;
  athletes: Array<{
    rank: number;
    userId: string;
    name: string;
    maxWeight: number;
    best1RM: number;
    bestReps: number;
    bestWeightForReps: number;
    date: string;
  }>;
}

export const clubsApi = {
  async create(data: { name: string; description?: string; city?: string }) {
    return apiFetch<{ club: Club }>('/api/clubs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMy() {
    return apiFetch<{ club: Club | null }>('/api/clubs/my');
  },

  async getById(id: string) {
    return apiFetch<{ club: Club }>(`/api/clubs/${id}`);
  },

  async update(id: string, data: { name?: string; description?: string; city?: string }) {
    return apiFetch<{ club: Club }>(`/api/clubs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async join(code: string) {
    return apiFetch<{ club: Club; message: string }>('/api/clubs/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async leave(id: string) {
    return apiFetch<{ message: string }>(`/api/clubs/${id}/leave`, { method: 'POST' });
  },

  async createInvite(id: string, options?: { maxUses?: number; expiresInDays?: number }) {
    return apiFetch<{ invite: { code: string; expiresAt: string | null } }>(`/api/clubs/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },

  async getMembers(id: string) {
    return apiFetch<{ members: ClubMember[] }>(`/api/clubs/${id}/members`);
  },

  async updateMemberRole(clubId: string, userId: string, role: string) {
    return apiFetch<{ message: string }>(`/api/clubs/${clubId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async removeMember(clubId: string, userId: string) {
    return apiFetch<{ message: string }>(`/api/clubs/${clubId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  async getTodayWorkouts(id: string, date?: string) {
    const qs = date ? `?date=${date}` : '';
    return apiFetch<{ templates: ClubWorkoutTemplate[]; date: string }>(`/api/clubs/${id}/workouts/today${qs}`);
  },

  async getWodLeaderboard(id: string, date: string, signature?: string) {
    const params = new URLSearchParams({ type: 'wod', date });
    if (signature) params.set('signature', signature);
    return apiFetch<{ type: string; date: string; entries: WodLeaderboardEntry[] }>(
      `/api/clubs/${id}/leaderboard?${params.toString()}`
    );
  },

  async getMonthlyLeaderboard(id: string, year?: number, month?: number) {
    const params = new URLSearchParams({ type: 'monthly' });
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    return apiFetch<{ type: string; year: number; month: number; entries: MonthlyLeaderboardEntry[] }>(
      `/api/clubs/${id}/leaderboard?${params.toString()}`
    );
  },

  async getAllTimeLeaderboard(id: string) {
    return apiFetch<{ type: string; entries: MonthlyLeaderboardEntry[] }>(
      `/api/clubs/${id}/leaderboard?type=all`
    );
  },

  async getSkillLeaderboard(id: string) {
    return apiFetch<{ type: string; entries: SkillLeaderboardEntry[] }>(
      `/api/clubs/${id}/leaderboard?type=skill`
    );
  },

  async updateLeaderboardVisibility(id: string, show: boolean) {
    return apiFetch<{ showInLeaderboard: boolean }>(`/api/clubs/${id}/leaderboard-visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ show }),
    });
  },
};

// --- CSRF ---

export async function getCsrfToken(): Promise<string> {
  const data = await apiFetch<{ csrfToken: string }>('/api/csrf-token');
  return data.csrfToken;
}
