import Review from "../infrastructure/db/entities/Review";
import Product from "../infrastructure/db/entities/Product";
import { Request, Response, NextFunction } from "express";
import NotFoundError from "../domain/errors/not-found-error";
import { getAuth, clerkClient } from "@clerk/express";

//create review
const createReview = async (req:Request, res:Response, next:NextFunction) => {
  try {
    const data = req.body;
    const { userId } = getAuth(req);

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    // Get user details from Clerk
    const user = await clerkClient.users.getUser(userId);
    const userName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.emailAddresses[0]?.emailAddress || 'Anonymous';

    const review = await Review.create({
      review: data.review,
      rating: data.rating,
      userId: userId,
      userName: userName,
    });

    const product = await Product.findById(data.productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    product.reviews.push(review._id);
    await product.save(); 

    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

export { createReview };