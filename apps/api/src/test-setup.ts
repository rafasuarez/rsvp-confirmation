// Set required environment variables for tests before any module is loaded
process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] =
  'postgresql://postgres:postgres@localhost:5432/topaz_ibis_dev?schema=public'
process.env['REDIS_URL'] = 'redis://localhost:6379'
process.env['SESSION_SECRET'] = 'test_secret_for_vitest_at_least_32_chars_long'
process.env['WA_VERIFY_TOKEN'] = 'test_verify_token'
process.env['WA_APP_SECRET'] = 'test_app_secret'
process.env['WA_ACCESS_TOKEN'] = 'test_access_token'
process.env['WA_PHONE_NUMBER_ID'] = 'test_phone_number_id'
process.env['LOG_LEVEL'] = 'error'
