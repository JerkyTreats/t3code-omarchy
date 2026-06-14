declare module "vitest" {
  export { vi } from "@effect/vitest";
}

declare module "vitest/browser" {
  export const page: any;
}
