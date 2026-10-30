import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentUser,
  findFirst,
  updateMany,
  invoke,
  reserveChatUsage,
  settleChatUsage,
  releaseChatUsage,
} = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  invoke: vi.fn(),
  reserveChatUsage: vi.fn(),
  settleChatUsage: vi.fn(),
  releaseChatUsage: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { findFirst, updateMany } },
}));
vi.mock("@/lib/rate-limit", () => ({
  reserveChatUsage,
  settleChatUsage,
  releaseChatUsage,
}));
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: class {
    withStructuredOutput() {
      return { invoke };
    }
  },
}));

import { POST } from "@/app/api/projects/[id]/chat/route";

const context = { params: Promise.resolve({ id: "proj-1" }) };
const request = (body: unknown) =>
  new Request("http://localhost/api/projects/proj-1/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
const message = { message: "Plan my app" };

const storedProject = {
  id: "proj-1",
  ownerId: 1,
  name: "App",
  description: "A todo app",
  version: 0,
  roadmap: null,
  chatMessages: null,
};

const modelResult = {
  raw: { usage_metadata: { total_tokens: 1234 } },
  parsed: {
    reply: "Here you go",
    roadmap: {
      title: "Plan",
      summary: "S",
      phases: [
        { id: null, title: "A", description: "", tasks: [{ id: null, text: "a1" }] },
      ],
    },
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  getCurrentUser.mockResolvedValue({ id: 1 });
  findFirst.mockResolvedValue(storedProject);
  reserveChatUsage.mockResolvedValue(77);
  releaseChatUsage.mockResolvedValue(undefined);
  updateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/projects/[id]/chat", () => {
  it("returns 401 when signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await POST(request(message), context);
    expect(response.status).toBe(401);
    expect(reserveChatUsage).not.toHaveBeenCalled();
  });

  it("returns 404 for a project the user does not own", async () => {
    findFirst.mockResolvedValue(null);
    const response = await POST(request(message), context);
    expect(response.status).toBe(404);
    expect(reserveChatUsage).not.toHaveBeenCalled();
  });

  it("rejects an invalid message with 400 before reserving usage", async () => {
    const response = await POST(request({ message: "   " }), context);
    expect(response.status).toBe(400);
    expect(reserveChatUsage).not.toHaveBeenCalled();
  });

  it("returns 429 when the usage budget is spent", async () => {
    reserveChatUsage.mockResolvedValue(null);
    const response = await POST(request(message), context);
    expect(response.status).toBe(429);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("settles real token usage and keeps it on success", async () => {
    invoke.mockResolvedValue(modelResult);
    const response = await POST(request(message), context);
    expect(response.status).toBe(200);
    expect(settleChatUsage).toHaveBeenCalledWith(77, 1234);
    expect(releaseChatUsage).not.toHaveBeenCalled();
  });

  it("releases the reserved usage when the model call fails (5xx)", async () => {
    invoke.mockRejectedValue(new Error("Connection error."));
    const response = await POST(request(message), context);
    expect(response.status).toBe(502);
    expect(releaseChatUsage).toHaveBeenCalledWith(77);
    expect(settleChatUsage).not.toHaveBeenCalled();
  });

  it("releases the usage when the model output cannot be parsed (5xx)", async () => {
    invoke.mockResolvedValue({ raw: modelResult.raw, parsed: null });
    const response = await POST(request(message), context);
    expect(response.status).toBe(502);
    expect(releaseChatUsage).toHaveBeenCalledWith(77);
  });

  it("still returns 502 if releasing the usage itself fails", async () => {
    invoke.mockRejectedValue(new Error("Connection error."));
    releaseChatUsage.mockRejectedValue(new Error("db down"));
    const response = await POST(request(message), context);
    expect(response.status).toBe(502);
  });

  it("keeps the usage when the project disappears mid-call (4xx)", async () => {
    invoke.mockResolvedValue(modelResult);
    findFirst.mockResolvedValueOnce(storedProject).mockResolvedValueOnce(null);
    const response = await POST(request(message), context);
    expect(response.status).toBe(404);
    expect(releaseChatUsage).not.toHaveBeenCalled();
  });
});
