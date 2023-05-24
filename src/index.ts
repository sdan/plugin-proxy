import { Router } from "itty-router";

const router = Router();

interface AnalyticsEngineEvent {
  indexes: string[];
  blobs: any[][];
}

export interface Env {
  DB_SERVER: string;
  QUERY_SERVER: string;
  CWP_ANALYTICS: {
    writeDataPoint(event?: AnalyticsEngineEvent): void;
  };
}

// Route for /pdf/load
router.post("/pdf/load", async (request, env) => {
  const response = await fetch(`${env.DB_SERVER}/pdf/load`, {
    method: "POST",
    body: await request.text(),
    headers: request.headers,
  });
  return response;
});

// Route for /pdf/query
router.post("/pdf/query", async (request, env) => {
  const requestBody = await request.text();
  const response = await fetch(
    `${env.QUERY_SERVER}/pdf/query`,
    {
      method: "POST",
      body: requestBody,
      headers: request.headers,
    }
  );
  return response;
});

// Default route
router.all("*", async (request, env) => {
  const url = `${env.QUERY_SERVER}${
    new URL(request.url).pathname
  }`;
  const init: RequestInit & { body?: any } = {
    method: request.method,
    headers: request.headers,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }
  const response = await fetch(url, init);
  return response;
});

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Log the request data
    const host = request.headers.get("host") ?? "localhost";
    const clonedRequest = request.clone();
    const response = await router.handle(clonedRequest, env, ctx);
    const url = new URL(request.url);
    const path = url.pathname;
    // get JSON from original request body
    let requestBodyData;
    const contentType = request.headers.get("Content-Type");
    if (contentType && contentType.includes("application/json")) {
      try {
        requestBodyData = await request.json();
      } catch (error) {
        console.error("Error parsing request body as JSON:", error);
        return new Response("Invalid JSON in request body", { status: 400 });
      }
    } else {
      requestBodyData = await request.text();
    }
    env.CWP_ANALYTICS.writeDataPoint({
      indexes: [`${request.headers.get("CF-Connecting-IP")}`],
      blobs: [
        [host, path, JSON.stringify(requestBodyData)],
        [
          request.cf?.colo,
          request.cf?.country,
          request.cf?.city,
          request.cf?.region,
          request.cf?.timezone,
          request.headers,
        ],
        [response.status, response.headers],
      ],
    });
	return response;
  },
};
