import { EmailTemplate } from "../types";

export const passwordChangedTemplate: EmailTemplate = {
  subject: "Your password has been changed - <%= appName %>",

  html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
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
                Password Changed Successfully
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #555555;">
                Hello<% if (user.firstName) { %> <%= user.firstName %><% } %>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #555555;">
                Your password for your <strong><%= appName %></strong> account (<strong><%= user.email %></strong>) has been successfully changed.
              </p>

              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #777777;">
                <strong>When:</strong> <%= changedAt %>
              </p>

              <!-- Security Warning -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8d7da; border-radius: 4px; margin: 0 0 20px 0;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #721c24;">
                      <strong>Didn't make this change?</strong><br><br>
                      If you did not change your password, your account may have been compromised. Please contact us immediately at <% if (supportEmail) { %><a href="mailto:<%= supportEmail %>" style="color: #721c24;"><%= supportEmail %></a><% } else { %>our support team<% } %>.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #555555;">
                For your security, you have been signed out of all devices. Please sign in again with your new password.
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
Password Changed Successfully

Hello<% if (user.firstName) { %> <%= user.firstName %><% } %>,

Your password for your <%= appName %> account (<%= user.email %>) has been successfully changed.

When: <%= changedAt %>

DIDN'T MAKE THIS CHANGE?

If you did not change your password, your account may have been compromised. Please contact us immediately at <% if (supportEmail) { %><%= supportEmail %><% } else { %>our support team<% } %>.

For your security, you have been signed out of all devices. Please sign in again with your new password.

Best regards,
The <%= appName %> Team

<% if (supportEmail) { %>
Need help? Contact us at <%= supportEmail %>
<% } %>

© <%= year %> <%= appName %>. All rights reserved.
  `.trim(),
};
