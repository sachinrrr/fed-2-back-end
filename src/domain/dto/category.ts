
import { z } from "zod";

const CreateCategoryDTO = z.object({
  name: z.string().min(1),
});

export { CreateCategoryDTO };
