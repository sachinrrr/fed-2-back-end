import { z } from "zod";

const CreateProductDTO = z.object({
  categoryId: z.string().min(1),
  colorId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().min(1, "Description is required"),
  image: z.string().min(1),
  stock: z.number().nonnegative(),
  price: z.number().nonnegative(),
});

const UpdateProductDTO = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  stock: z.number().nonnegative().optional(),
  categoryId: z.string().min(1).optional(),
  colorId: z.string().optional(),
  image: z.string().min(1).optional(),
});

export { CreateProductDTO, UpdateProductDTO };