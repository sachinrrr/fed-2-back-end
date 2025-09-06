import { NextFunction, Request, Response } from "express";
import stripe from "../infrastructure/stripe";
import Order from "../infrastructure/db/entities/Order";
import NotFoundError from "../domain/errors/not-found-error";
import ValidationError from "../domain/errors/validation-error";
import { reduceProductStock } from "../utils/stockManager";

//create checkout session
const createCheckoutSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      throw new ValidationError("orderId is required");
    }


    const order = await Order.findById(orderId)
      .populate({
        path: 'items.productId',
        select: 'name price image'
      })
      .populate('addressId');

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const lineItems = order.items.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: (item.productId as any).name,
            images: (item.productId as any).image ? [(item.productId as any).image] : [],
          },
                  unit_amount: Math.round((item.productId as any).price * 100),
      },
      quantity: item.quantity,
    }));


    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      ui_mode: 'embedded',
      return_url: `${process.env.FRONTEND_URL}/?payment=success&session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      metadata: {
        orderId: orderId.toString(),
      },
    });



    res.status(200).json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (error) {
    next(error);
  }
};

const handleStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    res.status(400).send('Webhook secret not configured');
    return;
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err}`);
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const orderId = session.metadata?.orderId;
      
      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && order.paymentStatus !== 'PAID') {
          order.paymentStatus = 'PAID';
          await order.save();
          
          try {
            await reduceProductStock(order.items);
          } catch (stockError) {
            
          }
        }
      }
    }



    res.json({received: true});
  } catch (error) {
    res.status(500).send('Webhook handler failed');
    return;
  }
};

const getCheckoutSessionStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      throw new ValidationError("Session ID is required");
    }

    const session = await stripe.checkout.sessions.retrieve(session_id as string);

    if (session.payment_status === 'paid' && session.metadata?.orderId) {
      const orderId = session.metadata.orderId;
      const order = await Order.findById(orderId);
      
      if (order && order.paymentStatus !== 'PAID') {
        order.paymentStatus = 'PAID';
        await order.save();
        
        try {
          await reduceProductStock(order.items);
        } catch (stockError) {
          
        }
      }
    }

    res.status(200).json({
      payment_status: session.payment_status,
      order_id: session.metadata?.orderId
    });
  } catch (error) {
    next(error);
  }
};

export { createCheckoutSession, handleStripeWebhook, getCheckoutSessionStatus };
