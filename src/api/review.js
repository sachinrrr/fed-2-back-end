import express from "express";
import { createReview } from "../application/review.js";

const reviewRouter = express.Router();

reviewRouter.route("/").post(createReview);


export default reviewRouter;