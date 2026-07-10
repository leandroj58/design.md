import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyApiToken } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";

// Servidor MCP (Streamable HTTP) en /api/mcp.
// Autenticación: Authorization: Bearer nk_... (tokens generados en /settings).
const mcpHandler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {},
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: false,
  }
);

const handler = withMcpAuth(mcpHandler, verifyApiToken, { required: true });

export { handler as GET, handler as POST, handler as DELETE };
