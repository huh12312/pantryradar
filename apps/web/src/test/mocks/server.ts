import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * MSW server for Node.js environment (Vitest tests)
 */
export const server = setupServer(...handlers);
