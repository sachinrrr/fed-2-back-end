
import { z } from "zod";

const CreateReviewDTO = z.object({
  review: z.string().min(1),
  rating: z.number().min(1).max(5), 
});

export { CreateReviewDTO };
