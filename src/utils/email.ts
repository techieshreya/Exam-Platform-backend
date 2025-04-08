import nodemailer from 'nodemailer';

// Basic validation for required environment variables
const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Email configuration error: Missing environment variable ${envVar}`);
    // Optionally throw an error or exit if email is critical
    // throw new Error(`Missing environment variable ${envVar}`);
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  // secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports (like 587)
  // For Gmail on port 587, secure should be false as Nodemailer uses STARTTLS
  secure: false, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Add TLS configuration for stricter environments if needed
  // tls: {
  //   ciphers:'SSLv3'
  // }
});

interface SendWelcomeEmailArgs {
  to: string;
  username: string;
  passwordPlainText: string; // Important: Pass the plain text password here
}

export const sendWelcomeEmail = async ({ to, username, passwordPlainText }: SendWelcomeEmailArgs): Promise<boolean> => {
  const subject = 'Welcome to Unisphere!';
  const htmlBody = `
    <h1>Welcome to Unisphere, ${username}!</h1>
    <p>Your account has been created successfully.</p>
    <p>Here are your login details:</p>
    <ul>
      <li><strong>Email:</strong> ${to}</li>
      <li><strong>Password:</strong> ${passwordPlainText}</li>
    </ul>
    <p>Please keep these details safe. You can log in at [Your Application URL - Replace This].</p>
    <br>
    <p>Best regards,</p>
    <p>The Unisphere Team</p>
  `;
  const textBody = `
    Welcome to Unisphere, ${username}!
    Your account has been created successfully.
    Here are your login details:
    Email: ${to}
    Password: ${passwordPlainText}
    Please keep these details safe. You can log in at [Your Application URL - Replace This].
    Best regards,
    The Unisphere Team
  `;

  const mailOptions = {
    from: `"Unisphere Admin" <${process.env.EMAIL_FROM}>`, // Sender address
    to: to, // List of receivers
    subject: subject, // Subject line
    text: textBody, // Plain text body
    html: htmlBody, // HTML body
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(`Error sending welcome email to ${to}:`, error);
    return false;
  }
};

// Optional: Verify transporter configuration on startup
transporter.verify(function (error, success) {
  if (error) {
    console.error('Error verifying email transporter config:', error);
  } else {
    console.log('Email server is ready to take messages');
  }
});
