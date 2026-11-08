import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchantId, merchantEmail, venueName, monthlyPrice = 49 } = body;

    if (!merchantId) {
      return NextResponse.json(
        { error: "Λείπει το αναγνωριστικό καταστήματος (merchantId)." },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Δημιουργία συνεδρίας Checkout για επαναλαμβανόμενη μηνιαία χρέωση
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: merchantEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `HappySeats Business - ${venueName || "Συνδρομή Καταστήματος"}`,
              description: "Μηνιαία συνδρομή προβολής, κρατήσεων & 1-Tap κονσόλας HappySeats.",
            },
            unit_amount: Math.round(monthlyPrice * 100), // σε λεπτά του ευρώ (49€ = 4900)
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        merchantId,
        venueName: venueName || "",
      },
      subscription_data: {
        metadata: {
          merchantId,
          venueName: venueName || "",
        },
      },
      success_url: `${appUrl}/merchant?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/merchant?subscription=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe Checkout Error:", error);
    const msg = error instanceof Error ? error.message : "Σφάλμα δημιουργίας πληρωμής.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}