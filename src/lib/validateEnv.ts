const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `ERROR: Missing required environment variables: ${missing.join(', ')}`
    );
    process.exit(1);
  }
}
