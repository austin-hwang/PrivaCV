declare module "cloudflare:workers" {
  export abstract class DurableObject<Env = unknown> {
    protected constructor(state: unknown, env: Env);
  }
}
