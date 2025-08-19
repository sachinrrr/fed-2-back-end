import { z } from "zod";

const CreateColorDTO = z.object({
  name: z.string().min(1, "Color name is required").max(50, "Color name must be less than 50 characters"),
  hexCode: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color code (e.g., #FF0000 or #F00)")
});

export { CreateColorDTO };
