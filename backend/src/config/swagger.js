/**
 * Swagger UI for docs/openapi.yaml. The YAML is parsed once at start-up, so a
 * syntax error in the spec fails the boot with a line number instead of a
 * blank docs page later.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { env } from './env.js';

const specPath = path.join(env.backendRoot, 'docs', 'openapi.yaml');

export function loadOpenApiSpec() {
  return YAML.parse(readFileSync(specPath, 'utf8'));
}

export function createSwaggerRouter() {
  const spec = loadOpenApiSpec();
  const router = Router();
  router.get('/openapi.json', (_req, res) => res.json(spec));
  router.use('/', swaggerUi.serve, swaggerUi.setup(spec, { swaggerOptions: { persistAuthorization: true } }));
  return router;
}
