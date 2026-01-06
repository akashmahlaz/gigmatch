import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly appName: string;
  private readonly frontendUrl: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY not configured - emails will be logged only',
      );
    }
    this.resend = new Resend(apiKey);
    this.fromEmail = this.configService.get<string>(
      'EMAIL_FROM',
      'GigMatch <noreply@gigmatch.app>',
    );
    this.appName = this.configService.get<string>('APP_NAME', 'GigMatch');
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'https://gigmatch.app',
    );
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        this.logger.error(`Failed to send email: ${error.message}`, error);
        return false;
      }

      this.logger.log(`Email sent successfully: ${data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Email sending failed: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName?: string,
  ): Promise<boolean> {
    const resetLink = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #2d2d2d; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🎸 ${this.appName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px;">Reset Your Password</h2>
              <p style="margin: 0 0 20px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Hi${userName ? ` ${userName}` : ''},
              </p>
              <p style="margin: 0 0 30px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                This link will expire in <strong style="color: #a0a0a0;">1 hour</strong>.
              </p>
              <p style="margin: 10px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you didn't request this, you can safely ignore this email.
              </p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #404040;">
              
              <p style="margin: 0; color: #666666; font-size: 12px;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${resetLink}" style="color: #dc2626; word-break: break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #1f1f1f; text-align: center;">
              <p style="margin: 0; color: #666666; font-size: 12px;">
                © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
Reset Your Password - ${this.appName}

Hi${userName ? ` ${userName}` : ''},

We received a request to reset your password. Click the link below to create a new password:

${resetLink}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

© ${new Date().getFullYear()} ${this.appName}
    `;

    return this.sendEmail({
      to: email,
      subject: `Reset Your Password - ${this.appName}`,
      html,
      text,
    });
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(
    email: string,
    verificationToken: string,
    userName?: string,
  ): Promise<boolean> {
    const verifyLink = `${this.frontendUrl}/verify-email?token=${verificationToken}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #2d2d2d; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🎸 ${this.appName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px;">Welcome to ${this.appName}! 🎉</h2>
              <p style="margin: 0 0 20px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Hi${userName ? ` ${userName}` : ''},
              </p>
              <p style="margin: 0 0 30px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Thanks for signing up! Please verify your email address to get started finding your perfect gig match.
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${verifyLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                This link will expire in <strong style="color: #a0a0a0;">24 hours</strong>.
              </p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #404040;">
              
              <p style="margin: 0; color: #666666; font-size: 12px;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${verifyLink}" style="color: #dc2626; word-break: break-all;">${verifyLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #1f1f1f; text-align: center;">
              <p style="margin: 0; color: #666666; font-size: 12px;">
                © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
Welcome to ${this.appName}! 🎉

Hi${userName ? ` ${userName}` : ''},

Thanks for signing up! Please verify your email address to get started finding your perfect gig match.

${verifyLink}

This link will expire in 24 hours.

© ${new Date().getFullYear()} ${this.appName}
    `;

    return this.sendEmail({
      to: email,
      subject: `Verify Your Email - Welcome to ${this.appName}!`,
      html,
      text,
    });
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(
    email: string,
    userName?: string,
    role?: string,
  ): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${this.appName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #2d2d2d; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🎸 ${this.appName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px;">You're All Set! 🚀</h2>
              <p style="margin: 0 0 20px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Hi${userName ? ` ${userName}` : ''},
              </p>
              <p style="margin: 0 0 20px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Your email has been verified and your ${this.appName} account is ready to go!
              </p>
              
              <p style="margin: 0 0 30px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                ${
                  role === 'artist'
                    ? '🎤 As an artist, you can now browse venues, showcase your talent, and find your next gig!'
                    : '🏢 As a venue, you can now discover talented artists and book amazing performances!'
                }
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${this.frontendUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
                      Start Exploring
                    </a>
                  </td>
                </tr>
              </table>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #404040;">
              
              <p style="margin: 0; color: #666666; font-size: 14px; text-align: center;">
                Questions? Reply to this email or visit our help center.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #1f1f1f; text-align: center;">
              <p style="margin: 0; color: #666666; font-size: 12px;">
                © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Welcome to ${this.appName}! Let's find your gig 🎸`,
      html,
    });
  }

  /**
   * Send match notification email
   */
  async sendMatchNotificationEmail(
    email: string,
    userName: string,
    matchedWith: string,
    matchedWithPhoto?: string,
  ): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You Have a New Match!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #2d2d2d; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">💕 It's a Match!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px; text-align: center;">
              <p style="margin: 0 0 20px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Hi ${userName},
              </p>
              <p style="margin: 0 0 30px; color: #ffffff; font-size: 20px; line-height: 1.6;">
                You matched with <strong style="color: #dc2626;">${matchedWith}</strong>!
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${this.frontendUrl}/matches" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
                      Start Chatting
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #1f1f1f; text-align: center;">
              <p style="margin: 0; color: #666666; font-size: 12px;">
                © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.sendEmail({
      to: email,
      subject: `💕 You matched with ${matchedWith}! - ${this.appName}`,
      html,
    });
  }
}
