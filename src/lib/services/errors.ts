/** A user-safe error raised by services; any other error is logged and shown generically. */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}
