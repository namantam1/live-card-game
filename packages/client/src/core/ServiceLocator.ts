/**
 * Service Locator - Global registry for application services
 * Pattern: Service Locator (anti-pattern in large apps, but fine for game scope)
 *
 * Services registered at bootstrap (main.ts) and accessed anywhere.
 */
export class ServiceLocator {
  private static services: Map<string, any> = new Map();

  static register<T>(name: string, instance: T): void {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} already registered`);
    }
    this.services.set(name, instance);
  }

  static get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found. Did you register it?`);
    }
    return service as T;
  }

  static has(name: string): boolean {
    return this.services.has(name);
  }

  static clear(): void {
    this.services.clear();
  }
}
