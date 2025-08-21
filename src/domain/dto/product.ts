import { z } from "zod";

const CreateProductDTO = z.object({
  categoryId: z.string().min(1),
  colorId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().min(1, "Description is required"),
  image: z.string().min(1),
  stock: z.number(),
  price: z.number().nonnegative(),
});

export { CreateProductDTO };