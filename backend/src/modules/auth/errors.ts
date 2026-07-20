export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = 'AUTH_ERROR',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
