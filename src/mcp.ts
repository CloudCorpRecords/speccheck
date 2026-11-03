/**
 * speccheck MCP server. Tools: check_spec_coverage.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The computation is pure and local: no upstream API, no
 * authentication, and no configuration — the caller supplies
 * every requirement and claim the report is based on.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { checkSpecCoverage, formatPayload, VERSION } from "./speccheck.js";

const TOOLS = [
  {
    name: "check_spec_coverage",
    description:
      "Verify a spec's requirements are claimed by issues, pull requests, or code, from caller-supplied requirement and claim facts. Returns covered and uncovered requirements, dangling claims that name no requirement, per-requirement claim counts, and a verdict. Nothing is fetched.",
    inputSchema: {
      type: "object" as const,
      properties: {
        requirements: {
          type: "array",
          description: "The spec's requirements",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Requirement identifier",
              },
              text: {
                type: "string",
                description: "Requirement text",
              },
            },
            required: ["id", "text"],
          },
        },
        claims: {
          type: "array",
          description:
            "Claims that an issue, pull request, or code reference addresses a requirement",
          items: {
            type: "object",
            properties: {
              requirement_id: {
                type: "string",
                description: "Id of the requirement being claimed",
              },
              source_kind: {
                type: "string",
                enum: ["issue", "pr", "code"],
                description: "Kind of the claiming source",
              },
              source_ref: {
                type: "string",
                description:
                  "Reference to the claiming source, e.g. an issue number or a file path",
              },
            },
            required: ["requirement_id", "source_kind", "source_ref"],
          },
        },
      },
      required: ["requirements", "claims"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "speccheck", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "check_spec_coverage") {
      out = checkSpecCoverage(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
