const SECRET_ENVIRONMENT_KEYS = [
  "DATABASE_URL",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "OTP_SECRET",
  "ADMIN_PASSWORD",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "CLOUDINARY_API_SECRET",
];

function redactText(value, additionalSecrets = []) {
  let text = String(value);
  const secrets = [
    ...SECRET_ENVIRONMENT_KEYS.map((key) => process.env[key]).filter(Boolean),
    ...additionalSecrets.filter((secret) => typeof secret === "string" && secret.length > 0),
  ].sort((left, right) => right.length - left.length);

  for (const secret of secrets) {
    text = text.replaceAll(secret, "[REDACTED]");
  }

  return text.replace(
    /\b(?:mysql|mariadb):\/\/[^\s"'`]+/gi,
    "[REDACTED_DATABASE_URL]"
  );
}

function sanitizeValue(value, additionalSecrets, seen = new WeakSet()) {
  if (typeof value === "string") return redactText(value, additionalSecrets);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, additionalSecrets, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /password|secret|token|cookie|authorization|database.?url/i.test(key)
        ? "[REDACTED]"
        : sanitizeValue(item, additionalSecrets, seen),
    ])
  );
}

export function describeError(error, additionalSecrets = []) {
  if (error instanceof Error) {
    const details = {
      name: error.name,
      message: redactText(error.message, additionalSecrets),
      code: error.code,
      clientVersion: error.clientVersion,
      meta: sanitizeValue(error.meta, additionalSecrets),
      stack: error.stack ? redactText(error.stack, additionalSecrets) : undefined,
    };

    if (error.cause) {
      details.cause = describeError(error.cause, additionalSecrets);
    }

    return details;
  }

  return {
    name: typeof error,
    message: redactText(
      typeof error === "string" ? error : JSON.stringify(sanitizeValue(error, additionalSecrets)),
      additionalSecrets
    ),
  };
}

export function logSafeServerError(label, error, { secrets = [] } = {}) {
  console.error(label, JSON.stringify(describeError(error, secrets)));
}

export function logSignupError(error, { secrets = [] } = {}) {
  const details = describeError(error, secrets);
  console.error("[SIGNUP] ERROR:", details);
  console.error("[SIGNUP] ERROR NAME:", details.name);
  console.error("[SIGNUP] ERROR MESSAGE:", details.message);
  console.error("[SIGNUP] ERROR CODE:", details.code);
  console.error("[SIGNUP] ERROR META:", details.meta);
  console.error("[SIGNUP] ERROR STACK:", details.stack);
}

export async function runSignupDatabaseOperation(operation, callback, { secrets = [] } = {}) {
  console.log(`[SIGNUP] ${operation} started`);
  try {
    const result = await callback();
    console.log(`[SIGNUP] ${operation} completed`);
    return result;
  } catch (error) {
    logSafeServerError(`Signup database operation failed: ${operation}`, error, { secrets });
    throw error;
  }
}
