const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    this.fromTransactional = process.env.EMAIL_FROM_TRANSACTIONAL || 'ahoyvpn@ahoyvpn.net';
    this.fromSupport = process.env.EMAIL_FROM_SUPPORT || 'William@ahoyvpn.com';
    
    this.templates = {
      welcome: this.loadTemplate('welcome'),
      passwordReset: this.loadTemplate('passwordReset'),
      verification: this.loadTemplate('verification'),
      paymentSuccess: this.loadTemplate('paymentSuccess'),
      paymentFailed: this.loadTemplate('paymentFailed'),
      subscriptionExpiring: this.loadTemplate('subscriptionExpiring'),
      subscriptionCancelled: this.loadTemplate('subscriptionCancelled'),
      trialEnding: this.loadTemplate('trialEnding'),
      accountCreated: this.loadTemplate('accountCreated'),
    };
  }
  
  loadTemplate(name) {
    const templatePath = path.join(__dirname, '..', 'templates', 'email', `${name}.html`);
    try {
      return fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
      console.warn(`Email template ${name}.html not found, using fallback.`);
      return `{{content}}`;
    }
  }
  
  replacePlaceholders(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
  
  async sendTransactional(to, subject, templateName, data) {
    const template = this.templates[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    
    const html = this.replacePlaceholders(template, data);
    
    const mailOptions = {
      from: this.fromTransactional,
      to,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, ''),
    };
    
    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      throw error;
    }
  }
  
  async sendWelcomeEmail(to, name) {
    return this.sendTransactional(
      to,
      'Welcome to AhoyVPN! Your Account is Ready',
      'welcome',
      { name, email: to }
    );
  }
  
  async sendPasswordResetEmail(to, resetLink) {
    return this.sendTransactional(
      to,
      'AhoyVPN Password Reset',
      'passwordReset',
      { resetLink }
    );
  }
  
  async sendPaymentSuccessEmail(to, amount, planName, nextBillingDate) {
    return this.sendTransactional(
      to,
      `Payment Successful – AhoyVPN ${planName}`,
      'paymentSuccess',
      { amount, planName, nextBillingDate }
    );
  }
  
  async sendPaymentFailedEmail(to, planName, retryLink) {
    return this.sendTransactional(
      to,
      `Payment Failed – AhoyVPN ${planName}`,
      'paymentFailed',
      { planName, retryLink }
    );
  }
  
  async sendSubscriptionExpiringEmail(to, planName, daysLeft, renewLink, expiryDate) {
    return this.sendTransactional(
      to,
      `Your AhoyVPN Subscription Expires in ${daysLeft} Days`,
      'subscriptionExpiring',
      { planName, daysLeft, renewLink, expiryDate }
    );
  }
  
  async sendTrialEndingEmail(to, daysLeft) {
    return this.sendTransactional(
      to,
      `Your AhoyVPN Trial Ends in ${daysLeft} Days`,
      'trialEnding',
      { daysLeft }
    );
  }
  
  async sendSubscriptionCancelledEmail(to, expiryDate) {
    return this.sendTransactional(
      to,
      'Your AhoyVPN Subscription Has Been Cancelled',
      'subscriptionCancelled',
      { expiryDate }
    );
  }
  
  async sendAccountCreatedEmail(to, vpnUsername, vpnPassword, expiryDate) {
    return this.sendTransactional(
      to,
      'Your AhoyVPN Account Details',
      'accountCreated',
      { vpnUsername, vpnPassword, expiryDate }
    );
  }
  
  // For customer‑service replies (manual)
  getSupportEmail() {
    return this.fromSupport;
  }
}

module.exports = new EmailService();