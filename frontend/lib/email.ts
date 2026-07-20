import nodemailer from "nodemailer";

export function emailConfigured(): boolean {
  return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
}

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendInviteEmail(
  to: string,
  businessName: string,
  onboardUrl: string
): Promise<{ mode: "smtp" | "demo" }> {
  if (!emailConfigured()) {
    // No SMTP configured — log the link so invites are still usable in local dev.
    console.log(`[demo] Invite for ${to} → ${onboardUrl}`);
    return { mode: "demo" };
  }

  await transporter().sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: `${businessName} invited you to FlowCast`,
    html: `
      <p>${businessName} wants to start paying you in USDC via FlowCast.</p>
      <p><a href="${onboardUrl}">Accept your invite and set up your wallet →</a></p>
      <p style="color:#64748b;font-size:13px">No crypto experience needed — FlowCast creates a secure wallet for you.</p>
    `,
  });
  return { mode: "smtp" };
}
