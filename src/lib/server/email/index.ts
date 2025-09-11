import { env } from "$env/dynamic/private";
import { sendEmail } from "./sendEmail";

export async function sendSignInEmail(
	to: string,
	{ code, magicLinkToken }: { code: string; magicLinkToken: string },
) {
	const magicLink = `${env.PUBLIC_BASE_URL}/auth/verify-magic-link?email=${to}&token=${magicLinkToken}`;

	await sendEmail({
		from: "noreply@app.weburst.fr",
		to,
		subject: "Sign In",
		html: `
			<body style="margin:0; padding:20px; background-color:#f8fafc; font-family:Arial, Helvetica, sans-serif;">
			  <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border:1px solid #e5e7eb;">

			    <!-- Logo -->
			    <div style="text-align:center; padding:25px 0 10px;">
			      <img src="https://weburst.com/assets/logo.png" alt="Weburst Logo" width="120" style="display:block; margin:0 auto; max-width:120px; height:auto;">
			    </div>

			    <!-- Header -->
			    <div style="background-color:#4F46E5; padding:40px 30px; text-align:center;">
			      <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:bold;">Welcome to Weburst</h1>
			      <p style="color:#e0e7ff; margin:8px 0 0; font-size:16px;">Your SEO companion</p>
			    </div>

			    <!-- Content -->
			    <div style="padding:40px 30px;">
			      <h2 style="color:#111827; margin:0 0 20px; font-size:22px; font-weight:bold;">Sign in to your account</h2>
			      <p style="color:#374151; margin:0 0 30px; font-size:15px; line-height:1.5;">
			        We’ve made signing in simple. Use the magic link or enter your code below:
			      </p>

			      <!-- Option 1 -->
			      <div style="margin-bottom:35px;">
			        <h3 style="color:#1f2937; margin:0 0 15px; font-size:18px; font-weight:bold;">Option 1: One-Click Sign In</h3>
			        <p style="margin:0 0 15px; font-size:15px; color:#374151;"><strong>Click below for instant access:</strong></p>
			        <a href="${magicLink}" style="display:inline-block; padding:14px 28px; background-color:#4F46E5; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold;">
			          🚀 Sign In Instantly
			        </a>
			      </div>

			      <!-- Divider -->
			      <div style="text-align:center; margin:35px 0; color:#9ca3af; font-size:14px;">
			        <span style="display:inline-block; border-top:1px solid #e5e7eb; width:30%; vertical-align:middle;"></span>
			        <span style="padding:0 10px; vertical-align:middle;">OR</span>
			        <span style="display:inline-block; border-top:1px solid #e5e7eb; width:30%; vertical-align:middle;"></span>
			      </div>

			      <!-- Option 2 -->
			      <div style="margin-bottom:35px;">
			        <h3 style="color:#1f2937; margin:0 0 15px; font-size:18px; font-weight:bold;">Option 2: Enter Verification Code</h3>
			        <p style="color:#374151; margin:0 0 20px; font-size:15px;">Use this 6-digit code in the app:</p>
			        <div style="background-color:#f9fafb; border:1px solid #e5e7eb; padding:20px; text-align:center;">
			          <div style="font-family:Courier, monospace; font-size:32px; font-weight:bold; color:#111827; letter-spacing:8px; margin-bottom:10px;">
			            <span>${code.slice(0, 3)}</span>
			            <span>${code.slice(3)}</span>
			          </div>
			          <p style="color:#6b7280; margin:0; font-size:13px;">Enter this code in the verification field</p>
			        </div>
			      </div>

			      <!-- Additional Info -->
			      <div style="background-color:#fff8e5; border:1px solid #fcd34d; padding:15px; margin:30px 0;">
			        <p style="color:#92400e; margin:0; font-size:14px; font-weight:bold;">
			          ⏰ Important: This code and link will expire in 15 minutes for security reasons.
			        </p>
			      </div>

			      <!-- Backup Link -->
			      <div style="margin-top:30px; padding-top:20px; border-top:1px solid #e5e7eb;">
			        <p style="color:#6b7280; margin:0 0 10px; font-size:13px;">
			          Having trouble with the button? Copy and paste this link:
			        </p>
			        <p style="word-break:break-all; color:#4F46E5; font-family:Courier, monospace; font-size:12px; background-color:#f8fafc; padding:10px; margin:0;">
			          https://weburst.com/magic-login?token=XYZ123
			        </p>
			      </div>
			    </div>

			    <!-- Footer -->
			    <div style="background-color:#f9fafb; padding:25px; border-top:1px solid #e5e7eb; text-align:center;">
			      <p style="color:#9ca3af; margin:0 0 8px; font-size:13px;">
			        If you didn't request this sign-in, you can safely ignore this email.
			      </p>
			      <p style="color:#d1d5db; margin:0; font-size:11px;">
			        © 2024 Weburst SEO App. All rights reserved.
			      </p>
			    </div>
			  </div>
			</body>
		`,
	});
}
