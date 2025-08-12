import { z } from "zod";

const CreateOrderDTO = z.object({
  userId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1), 
        quantity: z.number().positive(), 
      })
    )
    .min(1), 
  addressId: z.string().min(1), 
  orderStatus: z
    .enum(["PENDING", "SHIPPED", "FULFILLED", "CANCELLED"])
    .default("PENDING"),
  paymentMethod: z
    .enum(["COD", "CREDIT_CARD"])
    .default("CREDIT_CARD"),
  paymentStatus: z
    .enum(["PENDING", "PAID", "REFUNDED"])
    .default("PENDING"),
});

export { CreateOrderDTO };
