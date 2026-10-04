/**
 * MUST be the first import of every test file: it points the application at the
 * isolated test database and silences logs before config/env.js is evaluated.
 */
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'school_management_test';
process.env.LOG_LEVEL = 'error';
process.env.DOCS_ENABLED = 'true';
process.env.ALLOW_PUBLIC_REGISTRATION = 'true';
process.env.APP_TIMEZONE = 'UTC';
