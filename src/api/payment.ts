import express from "express";
import { createCheckoutSession, handleStripeWebhook, getCheckoutSessionStatus } from "../application/payment";
import isAuthenticated from "./middleware/authentication-middleware";

const paymentRouter = express.Router();


paymentRouter.route("/stripe/webhook").post(express.raw({type: 'application/json'}), handleStripeWebhook);


paymentRouter.route("/create-checkout-session").post(express.json(), isAuthenticated, createCheckoutSession);
paymentRouter.route("/checkout-session-status").get(isAuthenticated, getCheckoutSessionStatus);

export default paymentRouter;
