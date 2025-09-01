import Review from "../infrastructure/db/entities/Review";
import Product from "../infrastructure/db/entities/Product";

import { Request, Response, NextFunction } from "express";
import NotFoundError from "../domain/errors/not-found-error";

const createReview = async (req:Request, res:Response, next:NextFunction) => {
  try {
    const data = req.body;
    const userId = req.user?.userId;
    const userName = req.user?.firstName && req.user?.lastName 
      ? `${req.user.firstName} ${req.user.lastName}` 
      : req.user?.emailAddress || 'Anonymous';

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

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