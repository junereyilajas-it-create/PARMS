import nodemailer from 'nodemailer';

// Uses env variables or falls back to a test/dummy transport if none are configured.
export const sendPasswordResetEmail = async (toEmail, resetLink) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_USER || 'test@ethereal.email',
      pass: process.env.SMTP_PASSWORD || 'testpassword'
    }
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Property Assessment System" <noreply@municipality.gov>',
    to: toEmail,
    subject: 'Password Reset Request',
    text: `You have requested to reset your password. Please click on the following link or paste it into your browser to complete the process: \n\n${resetLink}\n\nThis link will expire in 30 minutes. If you did not request this, please ignore this email.`,
    html: `<p>You have requested to reset your password.</p><p>Please click on the following link or paste it into your browser to complete the process:</p><p><a href="${resetLink}">${resetLink}</a></p><p>This link will expire in 30 minutes.</p><p>If you did not request this, please ignore this email.</p>`
  };

  try {
    if (process.env.SMTP_HOST) {
      await transporter.sendMail(mailOptions);
      console.log(`Reset email sent to ${toEmail}`);
    } else {
      console.log('No SMTP configuration found. Simulating email sending.');
      console.log('--- EMAIL CONTENT ---');
      console.log('To:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      console.log('Body:', mailOptions.text);
      console.log('---------------------');
    }
  } catch (err) {
    console.error('Error sending email:', err);
    throw new Error('Failed to send reset email');
  }
};
