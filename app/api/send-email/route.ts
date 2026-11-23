import { NextResponse } from "next/server";
import { Resend } from "resend";

type EmailType = "application_received" | "pre_approved" | "account_activated";

// const ADMIN_NOTIFICATION_EMAILS = [
//   "skampanar@gmail.com",
//   "olga_dre@yahoo.gr",
//   "tommyanastaso@gmail.com",
// ];

const ADMIN_NOTIFICATION_EMAILS = [
  "skampanar@gmail.com",
];

interface EmailPayload {
  type: EmailType;
  to: string;
  contactName: string;
  companyName: string;
  venueName: string;
  venueArea?: string;
  phone?: string;
  vatNumber?: string;
  planLabel?: string;
  price?: number;
  paymentReference?: string;
  paymentLink?: string;
  isExistingUser?: boolean;
  tempPassword?: string;
}

function buildEmailContent(data: EmailPayload): { subject: string; html: string } {
  const iban = process.env.COMPANY_IBAN || "GR00 0000 0000 0000 0000 0000 000";
  const beneficiary = process.env.COMPANY_BENEFICIARY || "HAPPYSEATS Ι.Κ.Ε.";

  if (data.type === "application_received") {
    return {
      subject: `Λάβαμε την αίτηση συνεργασίας σας — ${data.venueName} | HappySeats`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6;">
          <h2 style="color: #ea580c;">HappySeats Partners</h2>
          <p>Γεια σας <strong>${data.contactName}</strong>,</p>
          <p>Επιβεβαιώνουμε ότι λάβαμε επιτυχώς την αίτηση συνεργασίας για το κατάστημα <strong>${data.venueName}</strong> (${data.companyName}).</p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Επιλεγμένο Πακέτο:</strong> ${data.planLabel} (${data.price}€ + ΦΠΑ)</p>
            <p style="margin: 6px 0 0;"><strong>Κατάσταση:</strong> Υπό εξέταση από το αρμόδιο τμήμα</p>
          </div>
          <p>Η ομάδα μας θα εξετάσει τα στοιχεία σας εντός 24 εργάσιμων ωρών και θα σας αποστείλει email με τους όρους συμμετοχής και τις οδηγίες ενεργοποίησης.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Με εκτίμηση,<br/>Η ομάδα του HappySeats</p>
        </div>
      `,
    };
  }

  if (data.type === "pre_approved") {
    return {
      subject: `Προέγκριση Αίτησης & Οδηγίες Πληρωμής — ${data.venueName} | HappySeats`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6;">
          <h2 style="color: #ea580c;">Η αίτησή σας προεγκρίθηκε! 🎉</h2>
          <p>Γεια σας <strong>${data.contactName}</strong>,</p>
          <p>Με χαρά σας ενημερώνουμε ότι η αίτηση για το κατάστημα <strong>${data.venueName}</strong> προεγκρίθηκε από την ομάδα του HappySeats.</p>
          
          <h3 style="margin-top: 20px;">1. Όροι Συμμετοχής</h3>
          <ul style="padding-left: 18px; font-size: 14px;">
            <li>Η συνδρομή αφορά αποκλειστικά το κατάστημα <strong>${data.venueName}</strong> και ανανεώνεται κατόπιν επιβεβαίωσης.</li>
            <li>Το κατάστημα δεσμεύεται να τιμά τις εκπτώσεις και τις χρονοθυρίδες που δημοσιεύει στην πλατφόρμα.</li>
            <li>Με την εξόφληση εκδίδεται νόμιμο τιμολόγιο παροχής υπηρεσιών στα στοιχεία ΑΦΜ που δηλώσατε.</li>
          </ul>

          <h3 style="margin-top: 20px;">2. Ολοκλήρωση Πληρωμής</h3>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 12px 0;">
            <p style="margin: 0;"><strong>Πακέτο:</strong> ${data.planLabel}</p>
            <p style="margin: 6px 0;"><strong>Ποσό:</strong> ${data.price}€ (+ 24% ΦΠΑ)</p>
            <p style="margin: 6px 0;"><strong>Δικαιούχος:</strong> ${beneficiary}</p>
            <p style="margin: 6px 0;"><strong>IBAN:</strong> <code>${iban}</code></p>
            <p style="margin: 6px 0 0;"><strong>Υποχρεωτική Αιτιολογία Κατάθεσης:</strong> <strong style="color: #ea580c;">${data.paymentReference}</strong></p>
          </div>
          ${
            data.paymentLink
              ? `<p style="margin: 16px 0;"><a href="${data.paymentLink}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;">Πληρωμή με Κάρτα →</a></p>`
              : ""
          }
          <p>Μόλις επιβεβαιωθεί η πληρωμή από το λογιστήριο μας, ο λογαριασμός σας θα ενεργοποιηθεί άμεσα και θα λάβετε email πρόσβασης.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Με εκτίμηση,<br/>Η ομάδα του HappySeats</p>
        </div>
      `,
    };
  }

  return {
    subject: `Ο λογαριασμός σας ενεργοποιήθηκε! — ${data.venueName} | HappySeats`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #16a34a;">Καλώς ήρθατε στο HappySeats! ✓</h2>
        <p>Γεια σας <strong>${data.contactName}</strong>,</p>
        <p>Η πληρωμή επιβεβαιώθηκε και το κατάστημα <strong>${data.venueName}</strong> είναι πλέον ενεργό στην πλατφόρμα.</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Email Σύνδεσης:</strong> ${data.to}</p>
          ${
            data.isExistingUser
              ? `<p style="margin: 6px 0 0;"><strong>Κωδικός:</strong> Χρησιμοποιήστε τον υπάρχοντα κωδικό του λογαριασμού σας.</p>`
              : `<p style="margin: 6px 0 0;"><strong>Προσωρινός Κωδικός:</strong> <code>${data.tempPassword}</code></p>`
          }
        </div>
        <p>Μπορείτε να συνδεθείτε στο Πάνελ Συνεργατών (<code>/login</code>) για να διαχειριστείτε τις χρονοθυρίδες και τις προσφορές σας.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Καλή αρχή,<br/>Η ομάδα του HappySeats</p>
      </div>
    `,
  };
}

function buildAdminNotification(data: EmailPayload): { subject: string; html: string } {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    subject: `🔔 Νέα Αίτηση Συνεργασίας: ${data.venueName} (${data.planLabel || "Συνδρομή"})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #dc2626;">Νέα Αίτηση Συνεργασίας — HappySeats Admin</h2>
        <p>Υποβλήθηκε νέα αίτηση από κατάστημα και αναμένει έλεγχο & προέγκριση:</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 14px;">
          <p style="margin: 0;"><strong>Κατάστημα:</strong> ${data.venueName}${data.venueArea ? ` (${data.venueArea})` : ""}</p>
          <p style="margin: 6px 0 0;"><strong>Επιχείρηση:</strong> ${data.companyName}${data.vatNumber ? ` — ΑΦΜ: ${data.vatNumber}` : ""}</p>
          <p style="margin: 6px 0 0;"><strong>Υπεύθυνος:</strong> ${data.contactName}${data.phone ? ` • ${data.phone}` : ""}</p>
          <p style="margin: 6px 0 0;"><strong>Email:</strong> ${data.to}</p>
          <p style="margin: 6px 0 0;"><strong>Πακέτο:</strong> ${data.planLabel} (${data.price}€ + ΦΠΑ)</p>
          ${data.paymentReference ? `<p style="margin: 6px 0 0;"><strong>Κωδικός Πληρωμής:</strong> <code>${data.paymentReference}</code></p>` : ""}
        </div>
        <p>
          <a href="${appUrl}/admin" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;">
            Άνοιγμα Admin Panel →
          </a>
        </p>
      </div>
    `,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EmailPayload;

    if (!body.to || !body.type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { subject, html } = buildEmailContent(body);
    const apiKey = process.env.RESEND_API_KEY;

    // Fallback για τοπικές δοκιμές χωρίς RESEND_API_KEY
    if (!apiKey) {
      console.log("📧 [DEV EMAIL PREVIEW]", { to: body.to, subject });
      if (body.type === "application_received") {
        console.log("🔔 [DEV ADMIN ALERT]", {
          to: ADMIN_NOTIFICATION_EMAILS,
          venue: body.venueName,
        });
      }
      return NextResponse.json({ ok: true, devMode: true });
    }

    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM || "HappySeats Partners <onboarding@resend.dev>";
    const devOverride = process.env.DEV_EMAIL_OVERRIDE;

    // 1. Αποστολή email στον συνεργάτη
    const { data, error } = await resend.emails.send({
      from,
      to: devOverride || body.to,
      subject: devOverride ? `[TEST → ${body.to}] ${subject}` : subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Αν είναι νέα αίτηση, ειδοποιούμε αυτόματα και τους admins
    if (body.type === "application_received") {
      const adminMail = buildAdminNotification(body);
      const { error: adminErr } = await resend.emails.send({
        from,
        to: devOverride || ADMIN_NOTIFICATION_EMAILS,
        subject: devOverride ? `[ADMIN TEST] ${adminMail.subject}` : adminMail.subject,
        html: adminMail.html,
      });

      if (adminErr) {
        // Δεν αποτυγχάνει η αίτηση του πελάτη αν κολλήσει μόνο το admin alert
        console.error("Admin notification error:", adminErr);
      }
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error("Email route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}