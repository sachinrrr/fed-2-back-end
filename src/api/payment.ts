import express from "express";
import { createCheckoutSession, handleStripeWebhook } from "../application/payment";
import isAuthenticated from "./middleware/authentication-middleware";

const paymentRouter = express.Router();

// Stripe webhook endpoint (must be before express.json middleware)
paymentRouter.route("/stripe/webhook").post(express.raw({type: 'application/json'}), handleStripeWebhook);

// Protected payment endpoints
paymentRouter.route("/create-checkout-session").post(isAuthenticated, createCheckoutSession);

export default paymentRouter;
