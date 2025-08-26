import Product from "../infrastructure/db/entities/Product";
import ValidationError from "../domain/errors/validation-error";
import NotFoundError from "../domain/errors/not-found-error";
import mongoose from "mongoose";

interface OrderItem {
  productId: string | mongoose.Types.ObjectId;
  quantity: number;
}

/**
 * Validates that all products in the order have sufficient stock
 * @param orderItems - Array of order items with productId and quantity
 * @throws ValidationError if any product has insufficient stock
 * @throws NotFoundError if any product is not found
 */
export const validateStockAvailability = async (orderItems: OrderItem[]): Promise<void> => {
  for (const item of orderItems) {
    const product = await Product.findById(item.productId);
    
    if (!product) {
      throw new NotFoundError(`Product with ID ${item.productId} not found`);
    }
    
    if (product.stock < item.quantity) {
      throw new ValidationError(
        `Insufficient stock for product "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`
      );
    }
  }
};

/**
 * Reduces product stock for all items in an order
 * Uses atomic operations to prevent race conditions
 * @param orderItems - Array of order items with productId and quantity
 * @throws ValidationError if any product has insufficient stock
 * @throws NotFoundError if any product is not found
 */
export const reduceProductStock = async (orderItems: OrderItem[]): Promise<void> => {
  // Use a session for atomic operations
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      for (const item of orderItems) {
        const result = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            stock: { $gte: item.quantity } // Ensure sufficient stock
          },
          {
            $inc: { stock: -item.quantity } // Reduce stock atomically
          },
          {
            session,
            new: true
          }
        );
        
        if (!result) {
          // Either product not found or insufficient stock
          const product = await Product.findById(item.productId).session(session);
          if (!product) {
            throw new NotFoundError(`Product with ID ${item.productId} not found`);
          } else {
            throw new ValidationError(
              `Insufficient stock for product "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`
            );
          }
        }
        
        console.log(`Stock reduced for product ${result.name}: ${result.stock + item.quantity} -> ${result.stock}`);
      }
    });
  } finally {
    await session.endSession();
  }
};

/**
 * Restores product stock for all items in an order (used for order cancellation or refunds)
 * @param orderItems - Array of order items with productId and quantity
 */
export const restoreProductStock = async (orderItems: OrderItem[]): Promise<void> => {
  // Use a session for atomic operations
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      for (const item of orderItems) {
        const result = await Product.findByIdAndUpdate(
          item.productId,
          {
            $inc: { stock: item.quantity } // Restore stock atomically
          },
          {
            session,
            new: true
          }
        );
        
        if (!result) {
          throw new NotFoundError(`Product with ID ${item.productId} not found`);
        }
        
        console.log(`Stock restored for product ${result.name}: ${result.stock - item.quantity} -> ${result.stock}`);
      }
    });
  } finally {
    await session.endSession();
  }
};
