import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const swagger = JSON.parse(readFileSync(new URL("docs/swagger.json", root), "utf8"));
const schemas = JSON.parse(JSON.stringify(swagger.definitions).replaceAll("#/definitions/", "#/components/schemas/"));
for (const [name, schema] of Object.entries(schemas)) {
  if (!schema.properties) continue;
  schema.required = Object.keys(schema.properties);
  if (name.includes("_db.")) {
    const requiredValues = new Set(["id", "user_id", "start_time", "created_at", "updated_at", "recorded_at", "resource", "state", "started_at"]);
    for (const [field, value] of Object.entries(schema.properties)) {
      if (!requiredValues.has(field)) value.nullable = true;
      if (field.endsWith("_time") || field.endsWith("_at")) value.format = "date-time";
    }
  }
  if (schema.properties.next_cursor) schema.properties.next_cursor.nullable = true;
}
const paths = {};
for (const [path, methods] of Object.entries(swagger.paths)) {
  paths[path] = {};
  for (const [method, operation] of Object.entries(methods)) {
    const op = JSON.parse(JSON.stringify(operation).replaceAll("#/definitions/", "#/components/schemas/"));
    delete op.consumes; delete op.produces;
    op.parameters = (op.parameters ?? []).map(({ type, format, items, ...parameter }) => ({ ...parameter, schema: { type, ...(format ? { format } : {}), ...(items ? { items } : {}) } }));
    for (const response of Object.values(op.responses)) {
      if (response.schema) { response.content = { "application/json": { schema: response.schema } }; delete response.schema; }
    }
    paths[path][method] = op;
  }
}
writeFileSync(new URL("docs/openapi.json", root), JSON.stringify({ openapi: "3.0.3", info: swagger.info, paths, components: { schemas, securitySchemes: { BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } } }, null, 2) + "\n");
