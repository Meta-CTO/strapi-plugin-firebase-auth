import { EmailTemplate } from "../types";

export const magicLinkTemplate: EmailTemplate = {
  subject: "Sign in to <%= appName %>",

  html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Your Account</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; color: #333333; font-weight: 600;">
                🔗 Sign in to <%= appName %>
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #555555;">
                Hello<% if (user.email) { %> <%= user.email %><% } %>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #555555;">
                You requested a magic link to sign in to your <strong><%= appName %></strong> account. No password needed!
              </p>

              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #555555;">
                Click the button below to securely sign in:
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px 0;">
                    <a href="<%= magicLink %>"
                       style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 5px; transition: background-color 0.3s;">
                      Sign In Now
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #777777;">
                Or copy and paste this link into your browser:
              </p>

              <p style="margin: 0 0 30px 0; font-size: 14px; line-height: 1.6; word-break: break-all; color: #007bff;">
                <%= magicLink %>
              </p>

              <!-- Security Notice -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d1fae5; border-radius: 4px; margin: 0 0 20px 0;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #065f46;">
                      <strong>✅ Secure Sign-In:</strong> This is a secure, one-time link that will expire in <strong><%= expiresIn %></strong>.
                      The link cannot be forwarded or reused.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Warning Notice -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-radius: 4px; margin: 0 0 20px 0;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #856404;">
                      <strong>⚠️ Didn't request this?</strong> If you didn't request this sign-in link, you can safely ignore this email.
                      No one can access your account without clicking this link.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #555555;">
                For your security, please do not share this link with anyone.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px 40px 40px; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.6; color: #999999; text-align: center;">
                Best regards,<br>
                The <%= appName %> Team
              </p>

              <% if (supportEmail) { %>
              <p style="margin: 0 0 10px 0; font-size: 12px; line-height: 1.6; color: #999999; text-align: center;">
                Need help? Contact us at <a href="mailto:<%= supportEmail %>" style="color: #007bff; text-decoration: none;"><%= supportEmail %></a>
              </p>
              <% } %>

              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #999999; text-align: center;">
                © <%= year %> <%= appName %>. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim(),

  text: `
Sign in to <%= appName %>

Hello<% if (user.email) { %> <%= user.email %><% } %>,

You requested a magic link to sign in to your <%= appName %> account. No password needed!

Click this link to sign in to your account:

<%= magicLink %>

This secure, one-time link will expire in <%= expiresIn %> and cannot be forwarded or reused.

If you didn't request this sign-in link, you can safely ignore this email. No one can access your account without clicking this link.

For your security, please do not share this link with anyone.

Best regards,
The <%= appName %> Team

<% if (supportEmail) { %>
Need help? Contact us at <%= supportEmail %>
<% } %>

© <%= year %> <%= appName %>. All rights reserved.
  `.trim(),
};
