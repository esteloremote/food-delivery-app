import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing stripe signature or secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Webhook signature error";
    console.error("⚠️ Webhook signature verification failed:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  try {
    switch (event.type) {
      // 1. Επιτυχής αρχική πληρωμή συνδρομής
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const merchantId = session.metadata?.merchantId;

        if (merchantId) {
          const nextDate = new Date();
          nextDate.setMonth(nextDate.getMonth() + 1);

          await updateDoc(doc(db, "merchants", merchantId), {
            "subscription.status": "active",
            "subscription.stripeCustomerId": session.customer as string,
            "subscription.stripeSubscriptionId": session.subscription as string,
            "subscription.validUntil": nextDate.toLocaleDateString("el-GR"),
            "subscription.updatedAt": serverTimestamp(),
          });
        }
        break;
      }

      // 2. Επιτυχής μηνιαία ανανέωση
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subData = (invoice as any).subscription_details?.metadata;
        const merchantId = subData?.merchantId;

        if (merchantId) {
          const nextDate = new Date();
          nextDate.setMonth(nextDate.getMonth() + 1);

          await updateDoc(doc(db, "merchants", merchantId), {
            "subscription.status": "active",
            "subscription.validUntil": nextDate.toLocaleDateString("el-GR"),
            "subscription.updatedAt": serverTimestamp(),
          });
        }
        break;
      }

      // 3. Αποτυχία πληρωμής ή ακύρωση συνδρομής
      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const objectData = event.data.object as { metadata?: { merchantId?: string } };
        const merchantId = objectData.metadata?.merchantId;

        if (merchantId) {
          await updateDoc(doc(db, "merchants", merchantId), {
            "subscription.status": "past_due",
            "subscription.updatedAt": serverTimestamp(),
          });
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error updating merchant subscription in Firestore:", err);
    return NextResponse.json(
      { error: "Failed to process webhook event" },
      { status: 500 }
    );
  }
}