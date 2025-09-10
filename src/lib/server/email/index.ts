import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "$env/dynamic/private";
import { dev } from "$app/environment";

let transporter: Transporter;

if (dev) {
	// For development, use console logging
	transporter = nodemailer.createTransport({
		jsonTransport: true
	});
} else {
	// For production, configure with your email service
	// Example for Gmail (requires app-specific password)
	transporter = nodemailer.createTransport({
		service: "gmail",
		auth: {
			user: env.EMAIL_USER,
			pass: env.EMAIL_PASSWORD
		}
	});
}

export async function sendMagicLinkEmail(to: string, token: string) {
	const magicLink = `${env.PUBLIC_BASE_URL || "http://localhost:5173"}/auth/verify-magic-link?token=${token}`;

	const mailOptions = {
		from: env.EMAIL_FROM || "noreply@weburst.com",
		to,
		subject: "Your Magic Link to Sign In",
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2>Sign in to Weburst SEO App</h2>
				<p>Click the link below to sign in to your account:</p>
				<a href="${magicLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
					Sign In
				</a>
				<p>Or copy and paste this link in your browser:</p>
				<p style="word-break: break-all; color: #6B7280;">${magicLink}</p>
				<p style="color: #6B7280; margin-top: 24px;">This link will expire in 15 minutes.</p>
				<p style="color: #6B7280;">If you didn't request this email, you can safely ignore it.</p>
			</div>
		`,
		text: `Sign in to Weburst SEO App\n\nClick this link to sign in: ${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this email, you can safely ignore it.`
	};

	if (dev) {
		// In development, log the email to console
		console.log("📧 Magic Link Email:");
		console.log("To:", to);
		console.log("Magic Link:", magicLink);
		const info = await transporter.sendMail(mailOptions);
		console.log("Email JSON:", info.message);
	} else {
		await transporter.sendMail(mailOptions);
	}
}