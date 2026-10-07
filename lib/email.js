import "server-only";
import nodemailer from "nodemailer";
import { logSafeServerError } from "@/lib/auth/errorDiagnostics";

function getMissingSmtpVariables() {
  return ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"].filter(
    (name) => !String(process.env[name] ?? "").trim()
  );
}

/**
 * Validates the SMTP configuration from environment variables.
 * Returns an object with { ok: boolean, error?: string }.
 */
export function validateSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const rawPort = process.env.SMTP_PORT ? String(process.env.SMTP_PORT).trim() : "465";
  const port = Number(rawPort);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim() || (user ? `DocVault <${user}>` : "");

  const missingVariables = getMissingSmtpVariables();
  if (missingVariables.length > 0) {
    return {
      ok: false,
      error: `SMTP is not configured. Set ${missingVariables.join(", ")} in .env.local for local development or in Vercel Project Settings > Environment Variables for production.`,
    };
  }

  if (
    [host, user, pass, from].filter(Boolean).some((value) =>
      /your-|replace-with|example\.com/i.test(value)
    )
  ) {
    return {
      ok: false,
      error: "SMTP settings still contain example placeholder values. Replace them with your provider's actual SMTP settings.",
    };
  }

  if (!rawPort || !Number.isInteger(port) || port < 1 || port > 65535) {
    return {
      ok: false,
      error: "SMTP_PORT must be a whole number between 1 and 65535 (Gmail commonly uses 465 or 587).",
    };
  }

  return { ok: true, host, port, user, pass, from };
}

/**
 * Creates a Nodemailer transporter from server-side SMTP environment variables.
 */
export function getSmtpTransporter() {
  console.log("[OTP] SMTP transporter creation started");
  const config = validateSmtpConfig();
  if (!config.ok) {
    const err = new Error(config.error);
    err.code = "SMTP_CONFIG_ERROR";
    throw err;
  }

  const { host, port, user, pass } = config;
  const authPassword =
    host.toLowerCase() === "smtp.gmail.com"
      ? pass.replace(/\s+/g, "")
      : pass;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass: authPassword,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    console.log("[OTP] SMTP transporter creation completed");
    return transporter;
  } catch (error) {
    logSafeServerError("[OTP] SMTP transporter creation failed", error, {
      secrets: [user, pass, config.from],
    });
    throw error;
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[character];
  });
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
  const formattedFrom = config.from.includes("<")
    ? config.from
    : `DocVault <${config.from}>`;

  const expiryMinutes = options.expiryMinutes || 10;
  const userName = options.name ? options.name.trim() : "";
  const greeting = userName ? `Hello ${userName},` : "Hello,";
  const htmlGreeting = userName
    ? `Hello ${escapeHtml(userName)},`
    : "Hello,";

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
                ${htmlGreeting} Thank you for creating an account with <strong>DocVault</strong>. Please use the one-time verification code below to verify your email and activate your account:
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
    logSafeServerError("[OTP] SMTP send failed", error, {
      secrets: [config.user, config.pass, config.from, email, otp],
    });

    const errorCode = typeof error?.code === "string" ? error.code : "UNKNOWN";
    const causeCode =
      typeof error?.cause?.code === "string" ? error.cause.code : "";
    const errorMessage = String(error?.message || "").toLowerCase();
    const details = {
      code: ["EAUTH", "ECONNECTION", "EDNS", "ESOCKET", "ETIMEDOUT", "ETLS"].includes(errorCode)
        ? errorCode
        : "UNKNOWN",
      causeCode: [
        "CERT_HAS_EXPIRED",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "SELF_SIGNED_CERT_IN_CHAIN",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "ECONNRESET",
        "ECONNREFUSED",
        "ETIMEDOUT",
      ].includes(causeCode)
        ? causeCode
        : "UNKNOWN",
      command: ["CONN", "AUTH", "MAIL", "RCPT", "DATA", "STARTTLS"].includes(error?.command)
        ? error.command
        : "UNKNOWN",
      responseCode: Number.isInteger(error?.responseCode)
        ? error.responseCode
        : null,
    };
    console.error("SMTP delivery failed.", details);

    if (errorCode === "EAUTH" || error?.responseCode === 535) {
      const authError = new Error(
        "SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD; for Gmail, use a Google App Password, not your regular account password."
      );
      authError.code = "SMTP_AUTH_FAILED";
      throw authError;
    }

    if (
      /certificate|self.signed|unable to verify/.test(errorMessage) ||
      [
        "CERT_HAS_EXPIRED",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "SELF_SIGNED_CERT_IN_CHAIN",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      ].includes(errorCode) ||
      details.causeCode.startsWith("CERT_") ||
      details.causeCode.includes("SELF_SIGNED") ||
      details.causeCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
    ) {
      const tlsError = new Error(
        "SMTP TLS certificate verification failed. Use a trusted network or ensure Node.js trusts your network's certificate authority. Do not disable certificate verification."
      );
      tlsError.code = "SMTP_TLS_CERTIFICATE_ERROR";
      throw tlsError;
    }

    if (errorCode === "ETIMEDOUT" || causeCode === "ETIMEDOUT") {
      const timeoutError = new Error(
        "SMTP connection timed out. Check SMTP_HOST and SMTP_PORT, and confirm your network allows outbound SMTP."
      );
      timeoutError.code = "SMTP_CONNECTION_TIMEOUT";
      throw timeoutError;
    }

    if (errorCode === "ECONNECTION" || errorCode === "ESOCKET") {
      const connectionError = new Error(
        "Could not connect to the SMTP server. Check SMTP_HOST and SMTP_PORT, allow outbound SMTP traffic, and run the app with npm run dev so Node.js trusts the operating-system CA store."
      );
      connectionError.code = "SMTP_CONNECTION_FAILED";
      throw connectionError;
    }

    if ([450, 451, 452, 550, 551, 552, 553, 554].includes(error?.responseCode)) {
      const addressError = new Error(
        "The SMTP provider rejected the sender or recipient. Check SMTP_FROM and verify the recipient address and provider sending limits."
      );
      addressError.code = "SMTP_ADDRESS_REJECTED";
      throw addressError;
    }

    const sendError = new Error(
      "Could not send verification email. Check the SMTP settings and review the server's safe SMTP error code."
    );
    sendError.code = "SMTP_SEND_FAILED";
    throw sendError;
  }
}
