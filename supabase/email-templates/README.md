# Supabase email setup (5 minutes, all in the dashboard)

## 1. URL settings
Supabase dashboard > Authentication > URL Configuration
- Site URL: your live address, for example `https://your-app.vercel.app` (no trailing slash).
- Redirect URLs: add `https://your-app.vercel.app/**`.

## 2. Paste the three templates
Authentication > Email Templates. For each tab, set the subject and paste the matching file:

| Tab | Subject | File |
| --- | --- | --- |
| Confirm signup | Confirm your FreightShield email | `confirm-signup.html` |
| Reset password | Reset your FreightShield password | `reset-password.html` |
| Magic link | Your FreightShield sign-in link | `magic-link.html` |

The links point at `/auth/confirm` in the app, which verifies the token directly, so they work even when
opened in a different browser or in a phone's mail app.

## 3. Send from your own address (needed for real users)
Supabase's built-in sender is for testing only: it is heavily rate-limited and may only deliver to your team.
Authentication > Emails > SMTP Settings > Enable custom SMTP, using Resend:
- Host `smtp.resend.com`, port `465`
- Username `resend`, password: your Resend API key
- Sender email: an address on a domain you have verified in Resend (for example `no-reply@yourdomain.com`)
- Sender name: `FreightShield`

## 4. Test
Sign up with a new address, open the email on your phone, tap the button. You should land on the dashboard.
Then try Forgot password: the button should open the "choose a new password" page.

## Logo in the emails
The templates load the logo from `{{ .SiteURL }}/email/logo.png` (file: `public/email/logo.png`), because email apps do not
show SVG logos. So the Site URL in step 1 must be your public address, not localhost, and the file must be deployed.
Some apps (Outlook, Gmail with images off) hide images until the reader allows them; the alt text "FreightShield" shows meanwhile.
