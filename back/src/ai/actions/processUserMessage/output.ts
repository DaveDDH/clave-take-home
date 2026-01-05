import { z } from "zod";

export const ResponseSchema = z.object({
  msg: z.string().describe("Message to the user"),
});

export type ResponseSchemaStype = z.infer<typeof ResponseSchema>;
