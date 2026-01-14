const { sendOTPEmail } = require("./emailService");

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate OTP with expiration time
 */
const generateOTPWithExpiry = (expiryMinutes = 10) => {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  return {
    code: otp,
    expiresAt,
  };
};

/**
 * Validate OTP
 */
const validateOTP = (storedOTP, providedOTP) => {
  if (!storedOTP || !storedOTP.code) {
    return {
      valid: false,
      message: "No OTP found for this user",
    };
  }

  if (new Date() > new Date(storedOTP.expiresAt)) {
    return {
      valid: false,
      message: "OTP has expired",
    };
  }

  if (storedOTP.code !== providedOTP) {
    return {
      valid: false,
      message: "Invalid OTP",
    };
  }

  return {
    valid: true,
    message: "OTP is valid",
  };
};

/**
 * Send OTP via email
 */
const sendOTPToEmail = async (email, otp, userName) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #232f3e; color: white; padding: 20px; text-align: center;">
          <h1>Email Verification</h1>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd;">
          <p>Hi <strong>${userName}</strong>,</p>
          
          <p>Thank you for registering as a seller on Amazon Clone. To verify your email address and complete your registration, please use the One-Time Password (OTP) below:</p>
          
          <div style="background-color: #f0f0f0; border: 2px solid #FF9900; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="font-size: 24px; font-weight: bold; color: #FF9900; margin: 0; letter-spacing: 5px;">
              ${otp}
            </p>
          </div>
          
          <p><strong>Important:</strong></p>
          <ul>
            <li>This OTP is valid for 10 minutes only</li>
            <li>Do not share this OTP with anyone</li>
            <li>If you did not initiate this registration, please ignore this email</li>
          </ul>
          
          <p>If you did not receive the OTP or need to generate a new one, please try registering again.</p>
          
          <p>Best regards,<br><strong>ExpressBuy Admin Team</strong></p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>&copy; 2026 ExpressBuy. All rights reserved.</p>
        </div>
      </div>
    `;

    await sendOTPEmail(email, "Email Verification - OTP for Seller Registration", htmlContent);
    console.log(`✓ OTP sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`✗ Error sending OTP to ${email}:`, error.message);
    throw error;
  }
};

module.exports = {
  generateOTP,
  generateOTPWithExpiry,
  validateOTP,
  sendOTPToEmail,
};
