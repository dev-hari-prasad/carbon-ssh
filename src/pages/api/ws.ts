import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * This endpoint is a no-op stub.
 * WebSocket connections are handled by the custom server (server.ts),
 * NOT through this Pages API route.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ status: "ws endpoint — use WebSocket protocol" });
}
