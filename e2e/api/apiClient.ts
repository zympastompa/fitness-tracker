import type { APIRequestContext, APIResponse } from "@playwright/test";
import type {
  CreateSessionInput,
  QueryValue,
  SaveSetInput,
  SaveSetResponse,
  SessionsResponse,
  WorkoutKey,
  WorkoutSession
} from "./types";

type SessionTracker = (session: WorkoutSession) => void;

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly trackSession: SessionTracker = () => undefined
  ) {}

  async health(): Promise<{ ok: true; db: "ok" }> {
    return this.get("/api/health");
  }

  async listSessions(date: string, workout: WorkoutKey): Promise<SessionsResponse> {
    return this.get("/api/sessions", { date, workout });
  }

  async createSession(input: CreateSessionInput): Promise<WorkoutSession> {
    const session = await this.post<WorkoutSession>("/api/sessions", input);
    this.trackSession(session);
    return session;
  }

  async saveSet(input: SaveSetInput): Promise<SaveSetResponse> {
    return this.post("/api/set", input);
  }

  async deleteSession(sessionId: number): Promise<void> {
    const response = await this.request.post("/api/delete-session", {
      data: { session_id: sessionId }
    });
    if (response.ok() || response.status() === 404) {
      return;
    }
    await throwResponseError(response);
  }

  private async get<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const response = await this.request.get(withQuery(path, query));
    return parseResponse<T>(response);
  }

  private async post<T>(path: string, data: unknown): Promise<T> {
    const response = await this.request.post(path, { data });
    return parseResponse<T>(response);
  }
}

function withQuery(path: string, query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) {
      params.set(key, String(value));
    }
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function parseResponse<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    await throwResponseError(response);
  }
  return await response.json() as Promise<T>;
}

async function throwResponseError(response: APIResponse): Promise<never> {
  const body = await response.text();
  throw new Error(`API ${response.status()} ${response.statusText()}: ${body}`);
}
