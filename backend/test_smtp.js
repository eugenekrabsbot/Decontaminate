const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('Testing SMTP connection with SendGrid...');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS length:', process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 'missing');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function test() {
  try {
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful');
    
    // Optional: send a test email (commented out)
    // console.log('Sending test email...');
    // const info = await transporter.sendMail({
    //   from: process.env.EMAIL_FROM_TRANSACTIONAL,
    //   to: 'test@example.com',
    //   subject: 'Test SMTP',
    //   text: 'Test email from AhoyVPN backend',
    // });
    // console.log('Test email sent:', info.messageId);
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    console.error('Full error:', error);
  }
}

test();