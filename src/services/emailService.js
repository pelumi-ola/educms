const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const send = async ({ to, subject, text }) => {
  if (!transporter) {
    logger.info(`[email disabled] to=${to} subject="${subject}"`);
    return false;
  }
  try {
    await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, text });
    return true;
  } catch (err) {
    logger.error(`Email failed: ${err.message}`);
    return false;
  }
};

const sendVerificationEmail = (user, token) =>
  send({
    to: user.email,
    subject: 'Verify your EduCMS email',
    text: `Hi ${user.username},\n\nVerify your email: ${process.env.FRONTEND_URL || ''}/verify-email?token=${token}\n`,
  });

module.exports = { send, sendVerificationEmail };
