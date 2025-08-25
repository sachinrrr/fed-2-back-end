import { NextFunction, Request, Response } from "express";
import stripe from "../infrastructure/stripe";
import Order from "../infrastructure/db/entities/Order";
import NotFoundError from "../domain/errors/not-found-error";
import ValidationError from "../domain/errors/validation-error";

const createCheckoutSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      throw new ValidationError("orderId is required");
    }

    console.log("Creating checkout session for order:", orderId);

    // Get the order details
    const order = await Order.findById(orderId)
      .populate({
        path: 'items.productId',
        select: 'name price image'
      })
      .populate('addressId');

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    console.log("Order found:", order._id);

    // Create line items for Stripe
    const lineItems = order.items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: (item.productId as any).name,
          images: (item.productId as any).image ? [(item.productId as any).image] : [],
        },
        unit_amount: Math.round((item.productId as any).price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    console.log("Line items created:", lineItems.length);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/complete?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout`,
      metadata: {
        orderId: orderId.toString(),
      },
    });

    console.log("Checkout session created:", session.id);

    res.status(200).json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Create checkout session error:", error);
    next(error);
  }
};

const handleStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(400).send('Webhook secret not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log("Webhook event received:", event.type);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  try {
    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      console.log("Payment completed for session:", session.id);

      // Get order ID from metadata
      const orderId = session.metadata?.orderId;
      if (orderId) {
        // Update order payment status
        const order = await Order.findById(orderId);
        if (order) {
          order.paymentStatus = 'PAID';
          await order.save();
          console.log("Order payment status updated to PAID:", orderId);
        }
      }
    }

    // Handle payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;
      console.log("Payment intent succeeded:", paymentIntent.id);
    }

    res.json({received: true});
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).send('Webhook handler failed');
  }
};

export { createCheckoutSession, handleStripeWebhook };
