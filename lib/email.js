import nodemailer from "nodemailer";

/**
 * Validates the SMTP configuration from environment variables.
 * Returns an object with { ok: boolean, error?: string }.
 */
export function validateSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = (process.env.SMTP_FROM || user)?.trim();

  if (!host || !user || !pass) {
    return {
      ok: false,
      error:
        "SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM in .env.local.",
    };
  }

  // Detect common unconfigured placeholder strings
  const placeholderPatterns = [
    "your-gmail-address",
    "your-email",
    "your-smtp",
    "your-google-app-password",
    "your-16-character-app-password",
    "example.com",
    "@gmail.com" === user ? true : false,
  ];

  const hasPlaceholder =
    placeholderPatterns.some((pattern) => typeof pattern === "string" && (user.includes(pattern) || pass.includes(pattern))) ||
    user === "your-gmail-address@gmail.com";

  if (hasPlaceholder) {
    return {
      ok: false,
      error:
        "Gmail SMTP credentials in .env.local are still set to placeholder values. Please set your actual Gmail address in SMTP_USER and a 16-character Google App Password in SMTP_PASSWORD.",
    };
  }

  if (isNaN(port) || port <= 0) {
    return {
      ok: false,
      error: "SMTP_PORT must be a valid port number (usually 587 or 465).",
    };
  }

  return { ok: true, host, port, user, pass, from };
}

/**
 * Creates and returns a Nodemailer transporter configured for Gmail SMTP.
 */
export function getSmtpTransporter() {
  const config = validateSmtpConfig();
  if (!config.ok) {
    const err = new Error(config.error);
    err.code = "SMTP_CONFIG_ERROR";
    throw err;
  }

  const { host, port, user, pass } = config;
  const isSecure = process.env.SMTP_SECURE === "true" || port === 465;

  // Google App Passwords often contain spaces (e.g. 'abcd efgh ijkl mnop')
  // Strip all whitespace for reliable authentication
  const cleanedPassword = pass.replace(/\s+/g, "");

  const isGmail = host === "smtp.gmail.com" || host.includes("gmail");

  const transportOptions = isGmail
    ? {
        service: "gmail",
        auth: {
          user,
          pass: cleanedPassword,
        },
        tls: {
          rejectUnauthorized: false,
        },
      }
    : {
        host,
        port,
        secure: isSecure,
        auth: {
          user,
          pass: cleanedPassword,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      };

  return nodemailer.createTransport(transportOptions);
}

/**
 * Sends a 6-digit email verification OTP to the user's email.
 *
 * @param {string} email - Destination email
 * @param {string} otp - 6-digit OTP string
 * @param {object} [options] - Optional settings (name, expiryMinutes)
 */
export async function sendVerificationOtp(email, otp, options = {}) {
  const config = validateSmtpConfig();
  if (!config.ok) {
    const err = new Error(config.error);
    err.code = "SMTP_CONFIG_ERROR";
    throw err;
  }

  const transporter = getSmtpTransporter();
  const sender = (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  const formattedFrom = sender.includes("<") ? sender : `DocVault <${sender}>`;

  const expiryMinutes = options.expiryMinutes || 10;
  const userName = options.name ? options.name.trim() : "";
  const greeting = userName ? `Hello ${userName},` : "Hello,";

  const subject = "DocVault - Your Email Verification OTP";

  const plainText = `${greeting}\n\n` +
    `Welcome to DocVault! Use the verification code below to complete your account registration:\n\n` +
    `VERIFICATION CODE: ${otp}\n\n` +
    `This code will expire in ${expiryMinutes} minutes.\n\n` +
    `Security notice: Never share this OTP with anyone. DocVault will never ask you for your code.\n` +
    `If you did not request this code, please ignore this email.`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 10px 15px -3px rgba(0,0,0,0.08);border:1px solid #e2e8f0;overflow:hidden;">
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #4f46e5 100%);padding:32px 36px;text-align:center;">
              <div style="display:inline-block;background-color:rgba(255,255,255,0.15);padding:10px;border-radius:12px;margin-bottom:12px;">
                <span style="font-size:26px;line-height:1;">🔒</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">DocVault</h1>
              <p style="margin:4px 0 0 0;color:#dbeafe;font-size:13px;font-weight:500;">Secure Personal Document Cloud</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <h2 style="margin:0 0 12px 0;color:#0f172a;font-size:20px;font-weight:700;">Verify Your Email Address</h2>
              <p style="margin:0 0 20px 0;color:#475569;font-size:15px;line-height:1.6;">
                ${greeting} Thank you for creating an account with <strong>DocVault</strong>. Please use the one-time verification code below to verify your email and activate your account:
              </p>

              <!-- OTP Box -->
              <div style="background-color:#f8fafc;border:2px dashed #93c5fd;border-radius:12px;padding:24px;text-align:center;margin:28px 0;">
                <span style="display:block;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Your 6-Digit Code</span>
                <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#1d4ed8;font-family:SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;display:inline-block;">${otp}</span>
                <span style="display:block;margin-top:10px;font-size:13px;color:#64748b;">
                  ⏱ Valid for <strong>${expiryMinutes} minutes</strong>
                </span>
              </div>

              <!-- Security Notice -->
              <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin:24px 0;">
                <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
                  <strong>Security Note:</strong> Do not share this OTP with anyone. DocVault will never ask for your verification code via phone or email.
                </p>
              </div>

              <p style="margin:20px 0 0 0;color:#64748b;font-size:13px;line-height:1.5;">
                If you did not attempt to create an account on DocVault, please disregard this email. No account will be created without this verification step.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} DocVault. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: formattedFrom,
      to: email,
      subject,
      text: plainText,
      html,
    });
  } catch (error) {
    if (error.code === "EAUTH" || error.responseCode === 535) {
      const authError = new Error(
        "Gmail rejected the SMTP login. Check SMTP_USER and SMTP_PASSWORD; for Gmail, use a Google App Password for that account, not its regular password."
      );
      authError.code = "SMTP_AUTH_FAILED";
      throw authError;
    }

    const sendError = new Error(
      `Could not send verification email via Gmail SMTP: ${error.message || "Unknown error"}`
    );
    sendError.code = "SMTP_SEND_FAILED";
    throw sendError;
  }
}
