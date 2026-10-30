import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, findFirst, updateMany } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { findFirst, updateMany } },
}));

import { PATCH } from "@/app/api/projects/[id]/tasks/route";

const context = { params: Promise.resolve({ id: "proj-1" }) };
const request = (body: unknown) =>
  new Request("http://localhost/api/projects/proj-1/tasks", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
const toggle = { phaseIndex: 0, taskIndex: 0, completed: true };

const storedProject = (version = 0) => ({
  id: "proj-1",
  ownerId: 1,
  version,
  roadmap: {
    title: "Plan",
    summary: "S",
    phases: [{ title: "A", description: "", tasks: ["a1", "a2"] }],
  },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PATCH /api/projects/[id]/tasks", () => {
  it("returns 401 when signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await PATCH(request(toggle), context);
    expect(response.status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 for a project the user does not own", async () => {
    getCurrentUser.mockResolvedValue({ id: 2 });
    findFirst.mockResolvedValue(null);
    const response = await PATCH(request(toggle), context);
    expect(response.status).toBe(404);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "proj-1", ownerId: 2 } });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid body with 400", async () => {
    getCurrentUser.mockResolvedValue({ id: 1 });
    const response = await PATCH(request({ phaseIndex: -1 }), context);
    expect(response.status).toBe(400);
  });

  it("writes with the version it read and bumps it", async () => {
    getCurrentUser.mockResolvedValue({ id: 1 });
    findFirst.mockResolvedValue(storedProject(4));
    updateMany.mockResolvedValue({ count: 1 });
    const response = await PATCH(request(toggle), context);
    expect(response.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proj-1", ownerId: 1, version: 4 },
        data: expect.objectContaining({ version: { increment: 1 } }),
      })
    );
  });

  it("retries after a version conflict, then gives up with 409", async () => {
    getCurrentUser.mockResolvedValue({ id: 1 });
    findFirst.mockResolvedValue(storedProject());
    updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    expect((await PATCH(request(toggle), context)).status).toBe(200);
    expect(updateMany).toHaveBeenCalledTimes(2);

    updateMany.mockReset().mockResolvedValue({ count: 0 });
    expect((await PATCH(request(toggle), context)).status).toBe(409);
    expect(updateMany).toHaveBeenCalledTimes(3);
  });
});
