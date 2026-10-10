import './helpers/setup.js';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { loadOpenApiSpec } from '../src/config/swagger.js';
import * as shared from '../src/constants/shared.js';

/**
 * docs/openapi.yaml against the code. No database and no Firebase are needed.
 *
 * Route inventory: the routes are read from the source instead of walking `app.router.stack`. Express 5's
 * router keeps the compiled matcher of a mounted router but not its mount path, so full paths cannot be
 * rebuilt from the live stack. `routes.js` supplies the mount points (`apiRouter.use('/path', ..., router)`)
 * and each `*.routes.js` its `router.METHOD('/path', ...)` calls, including the `authorize(...)` roles.
 * The reader throws on any declaration it does not understand (`.route()`, `.all()`, nested `.use()`,
 * non-literal paths), so a new routing style cannot slip past the parity check unnoticed.
 */

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const SRC_DIR = path.join(import.meta.dirname, '..', 'src');
const read = (relative) => readFileSync(path.join(SRC_DIR, relative), 'utf8');

/** Text between the parenthesis that opens at `open` and its partner. */
function balanced(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')' && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error('unbalanced parenthesis in route source');
}

/** Every `receiver.method(args)` call whose receiver matches `receiverPattern`. */
function* callsOn(source, receiverPattern) {
  for (const match of source.matchAll(new RegExp(`\\b(${receiverPattern})\\.(\\w+)\\(`, 'g'))) {
    const open = match.index + match[0].length - 1;
    yield { receiver: match[1], method: match[2], args: balanced(source, open), index: match.index };
  }
}

const rolesIn = (args) =>
  [...(/authorize\(([^)]*)\)/.exec(args)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((match) => match[1]);

/**
 * Router variable -> mount prefix, mount-level roles, and whether the mount runs `authenticate`.
 * Every call must mount a router under a literal path: middleware applied to the whole API router
 * (e.g. `apiRouter.use(authenticate)`) would run before routing and turn unknown paths into 401s.
 */
function readMounts() {
  const mounts = new Map();
  for (const call of callsOn(read('routes.js'), 'apiRouter')) {
    assert.equal(call.method, 'use', `routes.js: unsupported apiRouter.${call.method}()`);
    const prefix = /^\s*'([^']+)'/.exec(call.args)?.[1];
    assert.ok(
      prefix,
      `routes.js: apiRouter.use(${call.args.trim()}) must mount a router under a literal path`,
    );
    const router = /(\w+)\s*,?\s*$/.exec(call.args)[1];
    mounts.set(router, {
      prefix,
      roles: rolesIn(call.args),
      authenticated: /\bauthenticate\b/.test(call.args),
    });
  }
  return mounts;
}

/** "METHOD /openapi/{path}" -> { roles, isPublic } for every route registered under /api/v1. */
function readCodeOperations() {
  const mounts = readMounts();
  const operations = new Map();
  const routeFiles = readdirSync(path.join(SRC_DIR, 'modules'), { recursive: true }).filter((file) =>
    file.endsWith('.routes.js'),
  );
  for (const file of routeFiles) {
    for (const call of callsOn(read(path.join('modules', file)), '\\w+Routes')) {
      const where = `${file}: ${call.receiver}.${call.method}()`;
      assert.ok(HTTP_METHODS.includes(call.method), `${where} is not a plain get/post/put/patch/delete`);
      const route = /^\s*'([^']*)'/.exec(call.args)?.[1];
      assert.notEqual(route, undefined, `${where} must use a string literal path`);
      const mount = mounts.get(call.receiver);
      assert.ok(mount, `${where}: router is not mounted in routes.js`);
      const fullPath = (mount.prefix + (route === '/' ? '' : route)).replace(/:(\w+)/g, '{$1}');
      const routeRoles = rolesIn(call.args);
      operations.set(`${call.method.toUpperCase()} ${fullPath}`, {
        roles: routeRoles.length ? routeRoles : mount.roles,
        isPublic: !mount.authenticated && !/\bauthenticate\b/.test(call.args),
      });
    }
  }
  return operations;
}

const spec = loadOpenApiSpec();

const specOperations = Object.entries(spec.paths).flatMap(([route, item]) =>
  HTTP_METHODS.filter((method) => item[method]).map((method) => ({
    key: `${method.toUpperCase()} ${route}`,
    route,
    pathItem: item,
    operation: item[method],
  })),
);

const resolvePointer = (ref) =>
  ref
    .slice(2)
    .split('/')
    .map((part) => decodeURIComponent(part).replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((node, part) => node?.[part], spec);

/** Follows a `$ref` (parameters are shared through components). */
const deref = (node) => (node?.$ref ? resolvePointer(node.$ref) : node);

function* refsIn(node, where = '#') {
  if (Array.isArray(node)) {
    for (const [i, item] of node.entries()) yield* refsIn(item, `${where}/${i}`);
  } else if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string') yield { ref: node.$ref, where };
    for (const [key, value] of Object.entries(node)) yield* refsIn(value, `${where}/${key}`);
  }
}

/** The "Roles:" paragraph of an operation description, without parenthetical remarks. */
function rolesLine(operation) {
  const paragraph = /^Roles:[^\n]*(?:\n(?!\s*\n)[^\n]*)*/m.exec(operation.description ?? '')?.[0];
  return paragraph?.replace(/\([^)]*\)/gs, '');
}

const sorted = (values) => [...values].map(String).sort();

describe('OpenAPI specification', () => {
  it('parses as OpenAPI 3.0 with the global bearer security and a described tag list', () => {
    assert.match(spec.openapi, /^3\.0\./);
    assert.deepEqual(
      spec.servers.map((server) => server.url),
      [shared.API_BASE_PATH],
    );
    assert.deepEqual(spec.security, [{ bearerAuth: [] }]);
    assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');

    const tagNames = spec.tags.map((tag) => tag.name);
    assert.equal(new Set(tagNames).size, tagNames.length, 'duplicate tag names');
    for (const tag of spec.tags) assert.ok(tag.description, `tag "${tag.name}" has no description`);
    const used = new Set(specOperations.flatMap(({ operation }) => operation.tags));
    assert.deepEqual(
      tagNames.filter((name) => !used.has(name)),
      [],
      'tags without operations',
    );
  });

  it('resolves every $ref', () => {
    const refs = [...refsIn(spec)];
    assert.ok(refs.length > 100, 'suspiciously few $ref: is the spec using shared components?');
    const broken = refs.filter(({ ref }) => !ref.startsWith('#/') || resolvePointer(ref) === undefined);
    assert.deepEqual(
      broken.map(({ ref, where }) => `${where} -> ${ref}`),
      [],
    );
  });

  it('gives every operation an id, summary, known tag, responses and declared path parameters', () => {
    const tagNames = new Set(spec.tags.map((tag) => tag.name));
    const operationIds = new Set();
    const problems = [];

    for (const { key, route, pathItem, operation } of specOperations) {
      const id = operation.operationId;
      if (!/^[a-z][A-Za-z0-9]*$/.test(id ?? ''))
        problems.push(`${key}: operationId "${id}" is missing or not camelCase`);
      if (operationIds.has(id)) problems.push(`${key}: duplicate operationId "${id}"`);
      operationIds.add(id);
      if (!operation.summary?.trim()) problems.push(`${key}: summary is missing`);
      if (operation.tags?.length !== 1 || !tagNames.has(operation.tags[0])) {
        problems.push(
          `${key}: needs exactly one tag from the top-level list, got ${JSON.stringify(operation.tags)}`,
        );
      }
      const statuses = Object.keys(operation.responses ?? {});
      if (!statuses.length) problems.push(`${key}: no responses`);
      for (const status of statuses) {
        if (!/^([1-5]\d\d|default)$/.test(status))
          problems.push(`${key}: invalid response status "${status}"`);
      }

      const declared = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].map(deref);
      const pathParams = declared.filter((parameter) => parameter.in === 'path');
      const inTemplate = [...route.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
      const declaredNames = sorted(pathParams.map((parameter) => parameter.name));
      if (declaredNames.join() !== sorted(inTemplate).join()) {
        problems.push(`${key}: path parameters [${declaredNames}] do not match the template [${inTemplate}]`);
      }
      for (const parameter of pathParams) {
        if (parameter.required !== true)
          problems.push(`${key}: path parameter "${parameter.name}" must be required`);
      }
    }

    for (const [route, item] of Object.entries(spec.paths)) {
      for (const name of Object.keys(item)) {
        if (!HTTP_METHODS.includes(name) && name !== 'parameters')
          problems.push(`${route}: unexpected key "${name}"`);
      }
    }
    assert.deepEqual(problems, []);
  });

  it('documents exactly the operations the Express routers register', () => {
    const inCode = readCodeOperations();
    const inSpec = new Set(specOperations.map(({ key }) => key));
    const missing = [...inCode.keys()].filter((key) => !inSpec.has(key)).sort();
    const extra = [...inSpec].filter((key) => !inCode.has(key)).sort();
    assert.ok(
      !missing.length && !extra.length,
      [
        'docs/openapi.yaml and the routers disagree.',
        `  registered in code but missing from the spec (${missing.length}): ${missing.join(', ') || '-'}`,
        `  documented in the spec but not registered in code (${extra.length}): ${extra.join(', ') || '-'}`,
      ].join('\n'),
    );
  });

  it('states the roles and the public or secured status of every operation as the code enforces them', () => {
    const inCode = readCodeOperations();
    const problems = [];
    for (const { key, operation } of specOperations) {
      const code = inCode.get(key);
      if (!code) continue; // reported by the parity test
      const line = rolesLine(operation);
      if (!line) {
        problems.push(`${key}: the description must start with a "Roles:" line`);
        continue;
      }
      if (code.roles.length) {
        const documented = sorted(new Set(line.match(/\b(admin|teacher|student)\b/g) ?? []));
        if (documented.join() !== sorted(code.roles).join()) {
          problems.push(`${key}: code allows [${sorted(code.roles)}], spec says [${documented}]`);
        }
      } else if (!/\b(any authenticated user|public)\b/.test(line)) {
        problems.push(
          `${key}: no authorize() in code, so the Roles line must say "any authenticated user" or "public"`,
        );
      }
      if (code.isPublic) {
        if (!Array.isArray(operation.security) || operation.security.length) {
          problems.push(`${key}: public route must declare "security: []"`);
        }
        if (!/\bpublic\b/.test(line))
          problems.push(`${key}: public route must say "public" in the Roles line`);
      } else if (operation.security !== undefined) {
        problems.push(`${key}: secured route must inherit the global security`);
      }
    }
    assert.deepEqual(problems, []);
  });

  it('keeps enums, formats and limits equal to src/constants/shared.js', () => {
    const { schemas, parameters } = spec.components;
    const enums = {
      Role: shared.ROLES,
      Gender: shared.GENDERS,
      EnrollmentStatus: shared.ENROLLMENT_STATUSES,
      AdmissionStatus: shared.ADMISSION_STATUSES,
      AttendanceStatus: shared.ATTENDANCE_STATUSES,
      AssessmentType: shared.ASSESSMENT_TYPES,
      Term: shared.TERMS,
      AnnouncementAudience: shared.ANNOUNCEMENT_AUDIENCES,
      AnnouncementStatus: shared.ANNOUNCEMENT_STATUSES,
      CalendarEventType: shared.CALENDAR_EVENT_TYPES,
      ActivityArea: shared.ACTIVITY_AREAS,
      PaymentMethod: shared.PAYMENT_METHODS,
      NotificationType: shared.NOTIFICATION_TYPES,
      DayOfWeek: shared.DAYS_OF_WEEK,
      ErrorCode: Object.keys(shared.ERROR_CODES),
    };
    for (const [schema, values] of Object.entries(enums)) {
      assert.deepEqual(sorted(schemas[schema].enum), sorted(values), `${schema} enum`);
    }

    const patterns = {
      DateYmd: shared.DATE_REGEX,
      TimeHm: shared.TIME_REGEX,
      AcademicYear: shared.ACADEMIC_YEAR_REGEX,
      Phone: shared.PHONE_REGEX,
      StudentNumber: shared.STUDENT_NUMBER_REGEX,
      Lrn: shared.LRN_REGEX,
      EmployeeNumber: shared.EMPLOYEE_NUMBER_REGEX,
      SubjectCode: shared.SUBJECT_CODE_REGEX,
    };
    for (const [schema, regex] of Object.entries(patterns)) {
      assert.equal(schemas[schema].pattern, regex.source, `${schema} pattern`);
    }

    assert.equal(schemas.Password.minLength, shared.PASSWORD_MIN_LENGTH);
    assert.equal(schemas.Password.maxLength, shared.PASSWORD_MAX_LENGTH);
    assert.equal(parameters.Page.schema.default, shared.PAGINATION.DEFAULT_PAGE);
    assert.equal(parameters.Limit.schema.default, shared.PAGINATION.DEFAULT_LIMIT);
    assert.equal(parameters.Limit.schema.maximum, shared.PAGINATION.MAX_LIMIT);
    assert.deepEqual(sorted(parameters.SortOrder.schema.enum), sorted(shared.SORT_ORDERS));

    const bulkArrays = [
      schemas.BulkEnrollmentRequest.properties.studentIds,
      schemas.CompleteSchoolYearRequest.properties.studentIds,
      schemas.SaveAttendanceSheetRequest.properties.records,
      schemas.SaveGradesRequest.properties.grades,
    ];
    for (const array of bulkArrays) assert.equal(array.maxItems, shared.BULK_MAX_ROWS);

    for (const code of Object.keys(shared.ERROR_CODES)) {
      assert.ok(spec.info.description.includes(`\`${code}\``), `${code} is missing from the API description`);
    }
  });
});
