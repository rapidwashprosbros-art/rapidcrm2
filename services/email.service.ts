import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailTemplate =
  | "verify-email"
  | "password-reset"
  | "team-invitation"
  | "review-request"
  | "negative-feedback-alert"
  | "invoice-paid"
  | "estimate-accepted";

interface SendEmailParams {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

/**
 * Central send point for all transactional email. Templates render to
 * HTML via `renderTemplate` (kept separate so template markup doesn't
 * clutter call sites, and so we have one place to add a design system
 * for emails later).
 */
export async function sendEmail({ to, subject, template, data }: SendEmailParams) {
  const html = renderTemplate(template, data);

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Rapid CRM <notifications@rapidcrm.app>",
    to,
    subject,
    html,
  });

  if (error) {
    // Email failures should never crash the calling flow (e.g. a job
    // completion shouldn't fail because SMTP hiccuped) — log and move on.
    console.error(`Failed to send "${template}" email to ${to}:`, error);
  }
}

function renderTemplate(template: EmailTemplate, data: Record<string, unknown>): string {
  switch (template) {
    case "verify-email":
      return baseLayout(`
        <h1>Verify your email</h1>
        <p>Hi ${data.name}, confirm your email to finish setting up Rapid CRM.</p>
        <a href="${data.url}" class="btn">Verify email</a>
      `);
    case "password-reset":
      return baseLayout(`
        <h1>Reset your password</h1>
        <p>Hi ${data.name}, click below to choose a new password. This link expires in 1 hour.</p>
        <a href="${data.url}" class="btn">Reset password</a>
      `);
    case "team-invitation":
      return baseLayout(`
        <h1>You've been invited to ${data.companyName}</h1>
        <p>${data.inviterName} invited you to join their team on Rapid CRM as ${data.roleName}.</p>
        <a href="${data.url}" class="btn">Accept invitation</a>
      `);
    case "review-request":
      return baseLayout(`
        <h1>How did we do?</h1>
        <p>Hi ${data.customerName}, thanks for choosing ${data.companyName}. Tell us how the job went.</p>
        <a href="${data.url}" class="btn">Leave feedback</a>
      `);
    case "negative-feedback-alert":
      return baseLayout(`
        <h1>New feedback needs attention</h1>
        <p>${data.customerName} left a ${data.rating}-star rating on job "${data.jobTitle}".</p>
        <blockquote>${data.feedbackText}</blockquote>
        <a href="${data.url}" class="btn">View in Rapid CRM</a>
      `);
    case "invoice-paid":
      return baseLayout(`
        <h1>Invoice paid</h1>
        <p>${data.customerName} paid invoice #${data.invoiceNumber} — $${data.amount}.</p>
      `);
    case "estimate-accepted":
      return baseLayout(`
        <h1>Estimate accepted</h1>
        <p>${data.customerName} accepted estimate #${data.estimateNumber}.</p>
      `);
  }
}

function baseLayout(inner: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      ${inner}
      <style>
        h1 { font-size: 20px; }
        .btn {
          display: inline-block;
          margin-top: 16px;
          padding: 12px 24px;
          background: #111827;
          color: #fff;
          text-decoration: none;
          border-radius: 10px;
        }
      </style>
    </div>
  `;
}
