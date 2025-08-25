import express from "express";
import { createCheckoutSession, handleStripeWebhook, getCheckoutSessionStatus } from "../application/payment";
import isAuthenticated from "./middleware/authentication-middleware";

const paymentRouter = express.Router();

// Stripe webhook endpoint (with raw body parsing)
paymentRouter.route("/stripe/webhook").post(express.raw({type: 'application/json'}), handleStripeWebhook);

// Protected payment endpoints (will use express.json() from main app)
paymentRouter.route("/create-checkout-session").post(express.json(), isAuthenticated, createCheckoutSession);
paymentRouter.route("/checkout-session-status").get(isAuthenticated, getCheckoutSessionStatus);

export default paymentRouter;
