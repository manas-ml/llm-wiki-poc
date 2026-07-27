// Sensor for the "openapi-sync" agent control loop.
//
// Extracts the *actual* route surface and Zod request/query schemas straight from
// src/modules/**, and diffs that against the committed openapi.json. This makes the
// spec the thing being checked, not the thing being trusted: any drift between the
// live code and openapi.json is reported as a finding.
//
// What it checks:
//   - Every route in each module's *.routes.ts exists in openapi.json (and vice versa
//     — extra/removed paths are flagged too).
//   - Every route's request body schema (found by scanning the controller for
//     `<schema>.parse(req.body)`) matches components.schemas[<schema>] byte-for-byte
//     as JSON Schema (via zod-to-json-schema).
//   - Every route's query schema (`<schema>.parse(req.query)`) has one `parameters`
//     entry per top-level key, with the right `required` flag and enum values.
//   - Every route's success status code (from `res.status(N)`, default 200) has a
//     matching entry under `responses`.
//   - All non-health routes require the `apiKeyAuth` security scheme.
//
// What it does NOT check: response body shapes (routes return plain store records,
// not Zod-validated output, so there's no schema to diff against), and cosmetic
// fields like `summary`/`description` text.
//
// Usage:
//   npx tsx scripts/check-openapi-sync.ts            # report findings, exit 1 if any
//   npx tsx scripts/check-openapi-sync.ts --json      # machine-readable findings
//   npx tsx scripts/check-openapi-sync.ts --write     # regenerate openapi.json from
//                                                      # scratch to match the code
//
// --write is a bootstrap/full-resync tool for a human maintainer. The openapi-sync
// agent skill must NOT use it for incremental runs — it fixes every finding at once,
// defeating the "small reviewable batch" policy the controller relies on.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OPENAPI_PATH = path.join(ROOT, "openapi.json");

type Severity = "high" | "medium" | "low";

interface Finding {
  severity: Severity;
  kind: string;
  path?: string;
  method?: string;
  detail: string;
}

interface RouteInfo {
  method: string; // lowercase http method
  routePath: string; // express-style, e.g. /:id
  handler: string; // controller method name
}

interface ModuleDef {
  name: string;
  mountPath: string; // e.g. /users
  routesFile: string;
  controllerFile: string;
  schemasFile: string;
}

const MODULES: ModuleDef[] = [
  {
    name: "users",
    mountPath: "/users",
    routesFile: "src/modules/users/users.routes.ts",
    controllerFile: "src/modules/users/users.controller.ts",
    schemasFile: "src/modules/users/users.schemas.ts",
  },
  {
    name: "tasks",
    mountPath: "/tasks",
    routesFile: "src/modules/tasks/tasks.routes.ts",
    controllerFile: "src/modules/tasks/tasks.controller.ts",
    schemasFile: "src/modules/tasks/tasks.schemas.ts",
  },
];

function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function parseRoutes(source: string, routerVarName: string): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const routeRegex = new RegExp(
    `${routerVarName}\\.(get|post|put|patch|delete)\\(\\s*["'\`]([^"'\`]*)["'\`]\\s*,\\s*\\w+\\.(\\w+)\\s*\\)`,
    "g",
  );
  let match: RegExpExecArray | null;
  while ((match = routeRegex.exec(source)) !== null) {
    const [, method, routePath, handler] = match;
    routes.push({ method, routePath, handler });
  }
  return routes;
}

function extractHandlerBody(source: string, handlerName: string): string {
  const anchor = new RegExp(`\\b${handlerName}\\s*\\(`);
  const anchorMatch = anchor.exec(source);
  if (!anchorMatch) return "";
  const openBraceIdx = source.indexOf("{", anchorMatch.index);
  if (openBraceIdx === -1) return "";
  let depth = 0;
  for (let i = openBraceIdx; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(openBraceIdx, i + 1);
    }
  }
  return "";
}

function findSchemaUsage(body: string, target: "req.body" | "req.query"): string | null {
  const regex = new RegExp(`(\\w+)\\.parse\\(\\s*${target.replace(".", "\\.")}\\s*\\)`);
  const match = regex.exec(body);
  return match ? match[1] : null;
}

function findSuccessStatus(body: string): number {
  const match = /res\.status\((\d+)\)/.exec(body);
  return match ? Number(match[1]) : 200;
}

interface ExpectedRoute {
  method: string;
  path: string;
  operationId: string;
  requestSchemaName: string | null;
  querySchemaName: string | null;
  successStatus: number;
  requiresAuth: boolean;
}

async function loadExpectedRoutes(): Promise<{
  routes: ExpectedRoute[];
  schemas: Record<string, z.ZodTypeAny>;
}> {
  const routes: ExpectedRoute[] = [
    {
      method: "get",
      path: "/health",
      operationId: "health.check",
      requestSchemaName: null,
      querySchemaName: null,
      successStatus: 200,
      requiresAuth: false,
    },
  ];
  const schemas: Record<string, z.ZodTypeAny> = {};

  for (const mod of MODULES) {
    const routesSource = await readFile(path.join(ROOT, mod.routesFile), "utf8");
    const controllerSource = await readFile(path.join(ROOT, mod.controllerFile), "utf8");
    const routerVarMatch = /export const (\w+) = Router\(\)/.exec(routesSource);
    if (!routerVarMatch) {
      throw new Error(`Could not find Router() export in ${mod.routesFile}`);
    }
    const parsed = parseRoutes(routesSource, routerVarMatch[1]);

    const schemaModule = (await import(path.join(ROOT, mod.schemasFile))) as Record<
      string,
      z.ZodTypeAny
    >;

    for (const route of parsed) {
      const body = extractHandlerBody(controllerSource, route.handler);
      const requestSchemaName = findSchemaUsage(body, "req.body");
      const querySchemaName = findSchemaUsage(body, "req.query");
      const successStatus = findSuccessStatus(body);

      if (requestSchemaName && schemaModule[requestSchemaName]) {
        schemas[requestSchemaName] = schemaModule[requestSchemaName];
      }
      if (querySchemaName && schemaModule[querySchemaName]) {
        schemas[querySchemaName] = schemaModule[querySchemaName];
      }

      routes.push({
        method: route.method,
        path: `${mod.mountPath}${toOpenApiPath(route.routePath)}`.replace(/\/$/, "") || "/",
        operationId: `${mod.name}.${route.handler}`,
        requestSchemaName,
        querySchemaName,
        successStatus,
        requiresAuth: true,
      });
    }
  }

  return { routes, schemas };
}

function zodQueryParams(schema: z.ZodTypeAny): Array<{
  name: string;
  required: boolean;
  enumValues?: string[];
}> {
  if (!(schema instanceof z.ZodObject)) return [];
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  return Object.entries(shape).map(([name, value]) => {
    const required = !value.isOptional();
    let inner = value;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) {
      inner = inner instanceof z.ZodOptional ? inner.unwrap() : inner._def.innerType;
    }
    const enumValues = inner instanceof z.ZodEnum ? [...(inner.options as string[])] : undefined;
    return { name, required, enumValues };
  });
}

function jsonSchemaFor(name: string, schema: z.ZodTypeAny): unknown {
  return zodToJsonSchema(schema, { name, target: "openApi3", $refStrategy: "none" }).definitions?.[
    name
  ];
}

async function buildExpectedSpec() {
  const { routes, schemas } = await loadExpectedRoutes();

  const componentSchemas: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    componentSchemas[name] = jsonSchemaFor(name, schema);
  }

  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    paths[route.path] ??= {};
    const parameters: unknown[] = [];

    const idParams = [...route.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    for (const p of idParams) {
      parameters.push({
        name: p,
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    }

    if (route.querySchemaName && schemas[route.querySchemaName]) {
      for (const qp of zodQueryParams(schemas[route.querySchemaName])) {
        parameters.push({
          name: qp.name,
          in: "query",
          required: qp.required,
          schema: qp.enumValues ? { type: "string", enum: qp.enumValues } : { type: "string" },
        });
      }
    }

    const operation: Record<string, unknown> = {
      operationId: route.operationId,
      parameters,
      responses: {
        [String(route.successStatus)]: { description: "Success" },
      },
    };
    if (route.requiresAuth) {
      operation.security = [{ apiKeyAuth: [] }];
    }
    if (route.requestSchemaName) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: `#/components/schemas/${route.requestSchemaName}` },
          },
        },
      };
    }

    paths[route.path][route.method] = operation;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "TaskFlow API",
      version: "1.0.0",
      description: "Users + tasks REST API. Generated/maintained by the openapi-sync agent loop.",
    },
    components: {
      securitySchemes: {
        apiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
      },
      schemas: componentSchemas,
    },
    paths,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function loadCommittedSpec(): Promise<any> {
  try {
    const raw = await readFile(OPENAPI_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function severityRank(s: Severity): number {
  return { high: 0, medium: 1, low: 2 }[s];
}

async function diff(expected: any, committed: any): Promise<Finding[]> {
  const findings: Finding[] = [];

  if (!committed) {
    findings.push({
      severity: "high",
      kind: "missing-spec",
      detail: "openapi.json does not exist. Run with --write to bootstrap it.",
    });
    return findings;
  }

  for (const [routePath, methods] of Object.entries(expected.paths as Record<string, any>)) {
    for (const method of Object.keys(methods)) {
      const committedOp = committed.paths?.[routePath]?.[method];
      if (!committedOp) {
        findings.push({
          severity: "high",
          kind: "missing-endpoint",
          path: routePath,
          method,
          detail: `${method.toUpperCase()} ${routePath} exists in code but not in openapi.json.`,
        });
        continue;
      }

      const expectedOp = methods[method];
      const expectedStatus = Object.keys(expectedOp.responses)[0];
      if (!committedOp.responses?.[expectedStatus]) {
        findings.push({
          severity: "medium",
          kind: "wrong-status-code",
          path: routePath,
          method,
          detail: `${method.toUpperCase()} ${routePath} should document a ${expectedStatus} response.`,
        });
      }

      const hasAuth = Boolean(committedOp.security?.length);
      if (Boolean(expectedOp.security) !== hasAuth) {
        findings.push({
          severity: "medium",
          kind: "auth-mismatch",
          path: routePath,
          method,
          detail: `${method.toUpperCase()} ${routePath} security requirement does not match code (expected ${Boolean(expectedOp.security)}).`,
        });
      }

      if (expectedOp.requestBody) {
        const expectedRef = expectedOp.requestBody.content["application/json"].schema.$ref;
        const committedRef =
          committedOp.requestBody?.content?.["application/json"]?.schema?.$ref;
        if (expectedRef !== committedRef) {
          findings.push({
            severity: "high",
            kind: "missing-request-schema",
            path: routePath,
            method,
            detail: `${method.toUpperCase()} ${routePath} should reference requestBody schema ${expectedRef}.`,
          });
        }
      } else if (committedOp.requestBody) {
        findings.push({
          severity: "medium",
          kind: "extra-request-schema",
          path: routePath,
          method,
          detail: `${method.toUpperCase()} ${routePath} documents a requestBody the code does not parse.`,
        });
      }

      const expectedParams: any[] = expectedOp.parameters ?? [];
      const committedParams: any[] = committedOp.parameters ?? [];
      for (const ep of expectedParams) {
        const cp = committedParams.find((c: any) => c.name === ep.name && c.in === ep.in);
        if (!cp) {
          findings.push({
            severity: "medium",
            kind: `missing-${ep.in}-param`,
            path: routePath,
            method,
            detail: `${method.toUpperCase()} ${routePath} is missing ${ep.in} parameter "${ep.name}".`,
          });
        } else if (cp.required !== ep.required || !deepEqual(cp.schema, ep.schema)) {
          findings.push({
            severity: "low",
            kind: `param-mismatch`,
            path: routePath,
            method,
            detail: `${method.toUpperCase()} ${routePath} parameter "${ep.name}" does not match code (required/enum drift).`,
          });
        }
      }
      for (const cp of committedParams) {
        const stillExpected = expectedParams.find(
          (e) => e.name === cp.name && e.in === cp.in,
        );
        if (!stillExpected) {
          findings.push({
            severity: "medium",
            kind: `extra-${cp.in}-param`,
            path: routePath,
            method,
            detail: `${method.toUpperCase()} ${routePath} documents ${cp.in} parameter "${cp.name}" the code no longer has.`,
          });
        }
      }
    }
  }

  for (const [routePath, methods] of Object.entries(committed.paths ?? {}) as [string, any][]) {
    for (const method of Object.keys(methods)) {
      if (!expected.paths[routePath]?.[method]) {
        findings.push({
          severity: "high",
          kind: "extra-endpoint",
          path: routePath,
          method,
          detail: `openapi.json documents ${method.toUpperCase()} ${routePath}, which no longer exists in code.`,
        });
      }
    }
  }

  for (const [name, schema] of Object.entries(expected.components.schemas)) {
    const committedSchema = committed.components?.schemas?.[name];
    if (!committedSchema) {
      findings.push({
        severity: "high",
        kind: "missing-schema",
        detail: `Component schema "${name}" exists in code but not in openapi.json.`,
      });
    } else if (!deepEqual(schema, committedSchema)) {
      findings.push({
        severity: "medium",
        kind: "schema-drift",
        detail: `Component schema "${name}" in openapi.json does not match the live Zod schema.`,
      });
    }
  }
  for (const name of Object.keys(committed.components?.schemas ?? {})) {
    if (!expected.components.schemas[name]) {
      findings.push({
        severity: "low",
        kind: "extra-schema",
        detail: `Component schema "${name}" is documented but no longer used by any route.`,
      });
    }
  }

  findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  return findings;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const write = args.includes("--write");

  const expected = await buildExpectedSpec();

  if (write) {
    await writeFile(OPENAPI_PATH, `${JSON.stringify(expected, null, 2)}\n`);
    console.log(`Wrote ${path.relative(ROOT, OPENAPI_PATH)} from the current code.`);
    return;
  }

  const committed = await loadCommittedSpec();
  const findings = await diff(expected, committed);

  if (jsonOutput) {
    console.log(JSON.stringify(findings, null, 2));
  } else if (findings.length === 0) {
    console.log("openapi.json is in sync with src/modules/**.");
  } else {
    console.log(`${findings.length} finding(s):\n`);
    for (const f of findings) {
      console.log(`[${f.severity}] ${f.kind}${f.path ? ` — ${f.method?.toUpperCase()} ${f.path}` : ""}`);
      console.log(`  ${f.detail}`);
    }
  }

  process.exit(findings.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
