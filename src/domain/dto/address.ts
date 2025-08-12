import { z } from "zod";

const CreateAddressDTO = z.object({
  line_1: z.string().min(1),
  line_2: z.string().optional(),
  city: z.string().min(1),
  phone: z.string().min(1),
});

export { CreateAddressDTO };
