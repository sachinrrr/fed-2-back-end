import express from "express";
import { createReview } from "../application/review";
import isAuthenticated from "./middleware/authentication-middleware";

const reviewRouter = express.Router();

reviewRouter.route("/").post(isAuthenticated, createReview);

export default reviewRouter;