import { Request, Response } from "express";
import util from "util";
import Order from "../infrastructure/db/entities/Order";
import stripe from "../infrastructure/stripe";
import ProductModel from "../infrastructure/db/entities/Product";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
const FRONTEND_URL = process.env.FRONTEND_URL as string;

interface ProductType {
  _id: string;
  stock: number;
  stripePriceId?: string;
  name: string;
  description?: string;
  price: number;
}

async function fulfillCheckout(sessionId: string) {
  // Set your secret key. Remember to switch to your live secret key in production.
  // See your keys here: https://dashboard.stripe.com/apikeys
  console.log("Fulfilling Checkout Session " + sessionId);

  // Make this function safe to run multiple times,
  // even concurrently, with the same session ID

  // Make sure fulfillment hasn't already been
  // peformed for this Checkout Session

  // Retrieve the Checkout Session from the API with line_items expanded
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });
  console.log(
    util.inspect(checkoutSession, false, null, true /* enable colors */)
  );

  const order = await Order.findById(
    checkoutSession.metadata?.orderId
  ).populate<{
    items: { productId: ProductType; quantity: number }[];
  }>("items.productId");
  if (!order) {
    throw new Error("Order not found");
  }

  if (order.paymentStatus !== "PENDING") {
    throw new Error("Payment is not pending");
  }

  if (order.orderStatus !== "PENDING") {
    throw new Error("Order is not pending");
  }

  // Check the Checkout Session's payment_status property
  // to determine if fulfillment should be peformed
  if (checkoutSession.payment_status !== "unpaid") {
    //  Perform fulfillment of the line items
    //  Record/save fulfillment status for this
    order.items.forEach(async (item) => {
      const product = item.productId;
      await ProductModel.findByIdAndUpdate(product._id, {
        $inc: { stock: -item.quantity },
      });
    });

    await Order.findByIdAndUpdate(order._id, {
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    });
  }
}

export const handleWebhook = async (req: Request, res: Response) => {
  const payload = req.body;
  const sig = req.headers["stripe-signature"] as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await fulfillCheckout(event.data.object.id);

      res.status(200).send();
      return;
    }
  } catch (err) {
    // @ts-ignore
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const orderId = req.body.orderId;
    console.log("Creating checkout session for order:", orderId);
    
    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const order = await Order.findById(orderId).populate<{
      items: { productId: ProductType; quantity: number }[];
    }>({
      path: "items.productId",
      select: "name description price stripePriceId stock" // Only select needed fields
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    console.log("Order found with items:", order.items.length);
    
    // Check if order has items
    if (!order.items || order.items.length === 0) {
      return res.status(400).json({ error: "Order has no items" });
    }

    // For products without stripePriceId, create dynamic price objects
    const lineItems = [];
    
    for (const item of order.items) {
      const product = item.productId;
      
      // Check if product exists (not null/undefined)
      if (!product) {
        console.error(`Product not found for item in order ${orderId}`);
        return res.status(400).json({ 
          error: "One or more products in the order are no longer available" 
        });
      }
      
      console.log(`Processing product: ${product.name}, stripePriceId: ${product.stripePriceId}`);
      
      if (product.stripePriceId) {
        // Use existing Stripe price ID
        lineItems.push({
          price: product.stripePriceId,
          quantity: item.quantity,
        });
      } else {
        // Create dynamic price for products without stripePriceId
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: product.description || `${product.name} - High quality product`,
            },
            unit_amount: Math.round(product.price * 100), // Convert to cents
          },
          quantity: item.quantity,
        });
      }
    }

    console.log("Creating Stripe session with line items:", lineItems.length);

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      line_items: lineItems,
      mode: "payment",
      return_url: `${FRONTEND_URL}/shop/complete?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        orderId: req.body.orderId,
      },
    });

    console.log("Stripe session created successfully");
    res.send({ clientSecret: session.client_secret });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ 
      error: "Failed to create checkout session", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

export const retrieveSessionStatus = async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.session_id as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    const order = await Order.findById(checkoutSession.metadata?.orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({
      orderId: order._id,
      status: checkoutSession.status,
      customer_email: checkoutSession.customer_details?.email,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    console.error("Error retrieving session status:", error);
    res.status(500).json({ 
      error: "Failed to retrieve session status", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
};