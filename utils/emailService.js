const { google } = require("googleapis");

let oauth2ClientInstance = null;
let gmailInstance = null;

// Disable IPv6 for Node.js to avoid timeout issues
if (process.env.NODE_ENV !== "test") {
  require("dns").setDefaultResultOrder("ipv4first");
}

const getOAuth2Client = () => {
  if (!oauth2ClientInstance) {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.REDIRECT_URI || !process.env.REFRESH_TOKEN) {
      throw new Error("Missing OAuth2 environment variables: CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, or REFRESH_TOKEN");
    }

    oauth2ClientInstance = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URI
    );

    oauth2ClientInstance.setCredentials({
      refresh_token: process.env.REFRESH_TOKEN,
    });
  }
  return oauth2ClientInstance;
};

const getGmailClient = () => {
  if (!gmailInstance) {
    const client = getOAuth2Client();
    gmailInstance = google.gmail({ version: "v1", auth: client });
  }
  return gmailInstance;
};

/**
 * Retry helper with exponential backoff
 */
const retryWithBackoff = async (fn, maxRetries = 3, delayMs = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Only retry on network errors
      if (attempt === maxRetries || !isNetworkError(error)) {
        throw error;
      }
      const delay = delayMs * Math.pow(2, attempt - 1);
      console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

/**
 * Check if error is a network-related error
 */
const isNetworkError = (error) => {
  if (!error) return false;
  const message = error.message || "";
  const code = error.code || "";
  return (
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("socket hang up") ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND"
  );
};

/**
 * Send email using Gmail API
 */
const sendEmailViaGmailAPI = async (to, subject, htmlContent) => {
  try {
    if (!process.env.ADMIN_EMAIL) {
      throw new Error("Missing ADMIN_EMAIL environment variable");
    }

    // Construct the email message
    const constructMessage = () => {
      const message = [
        `From: ${process.env.ADMIN_EMAIL}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        'Content-Type: text/html; charset="UTF-8"',
        "",
        htmlContent,
      ].join("\n");

      // Encode the message in base64
      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      return encodedMessage;
    };

    // Send email with retry logic
    const result = await retryWithBackoff(async () => {
      const gmailClient = getGmailClient();
      const encodedMessage = constructMessage();

      return await gmailClient.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });
    }, 3, 2000);

    console.log("✓ Email sent successfully via Gmail API to:", to);
    return result;
  } catch (error) {
    console.error("✗ Error sending email via Gmail API:", error.message);
    throw error;
  }
};

/**
 * Send approval email to seller
 */
const sendApprovalEmail = async (sellerEmail, sellerName) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #232f3e; color: white; padding: 20px; text-align: center;">
          <h1>Account Approved</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd;">
          <p>Hi <strong>${sellerName}</strong>,</p>
          
          <p>Great news! Your seller account has been <strong>approved</strong> and is now active.</p>
          
          <p>You can now:</p>
          <ul>
            <li>List your products on the platform</li>
            <li>Manage your inventory</li>
            <li>Process customer orders</li>
            <li>Track your sales and earnings</li>
          </ul>
          
          <p>We are excited to have you on board and look forward to your success as a seller.</p>
          
          <p>If you have any questions, feel free to contact our support team.</p>
          
          <p>Best regards,<br><strong>ExpressBuy Admin Team</strong></p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>&copy; 2026 ExpressBuy. All rights reserved.</p>
        </div>
      </div>
    `;

    const result = await sendEmailViaGmailAPI(
      sellerEmail,
      "Your Seller Account Has Been Approved!",
      htmlContent
    );

    return result;
  } catch (error) {
    console.error("✗ Error sending approval email:", error.message);
    throw error;
  }
};

/**
 * Send rejection email to seller
 */
const sendRejectionEmail = async (sellerEmail, sellerName, rejectionReason) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #232f3e; color: white; padding: 20px; text-align: center;">
          <h1>Application Status Update</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd;">
          <p>Hi <strong>${sellerName}</strong>,</p>
          
          <p>Thank you for applying to become a seller on our platform. We appreciate your interest in joining our marketplace.</p>
          
          <p>Unfortunately, we are unable to approve your seller account at this time for the following reason:</p>
          
          <div style="background-color: #fff3cd; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0;">
            <p><strong>Reason:</strong></p>
            <p>${rejectionReason}</p>
          </div>
          
          <p>What you can do next:</p>
          <ul>
            <li>Address the concerns mentioned above</li>
            <li>Reapply with corrected information</li>
            <li>Contact our support team for clarification</li>
          </ul>
          
          <p>We encourage you to try again. If you believe this decision is in error or would like more information, please contact our support team.</p>
          
          <p>Best regards,<br><strong>ExpressBuy Admin Team</strong></p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>&copy; 2026 ExpressBuy. All rights reserved.</p>
        </div>
      </div>
    `;

    const result = await sendEmailViaGmailAPI(
      sellerEmail,
      "Update on Your Seller Account Application",
      htmlContent
    );

    return result;
  } catch (error) {
    console.error("✗ Error sending rejection email:", error.message);
    throw error;
  }
};

/**
 * Send OTP email
 */
const sendOTPEmail = async (to, subject, htmlContent) => {
  try {
    if (!process.env.ADMIN_EMAIL) {
      throw new Error("Missing ADMIN_EMAIL environment variable");
    }

    const gmailClient = getGmailClient();

    // Construct the email message
    const message = [
      `From: ${process.env.ADMIN_EMAIL}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      htmlContent,
    ].join("\n");

    // Encode the message in base64
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Send the email using Gmail API
    const result = await gmailClient.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log("✓ OTP email sent successfully to:", to);
    return result;
  } catch (error) {
    console.error("✗ Error sending OTP email:", error.message);
    throw error;
  }
};

module.exports = {
  sendApprovalEmail,
  sendRejectionEmail,
  sendOTPEmail,
};
