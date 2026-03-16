/** Structured error class for all Firemap errors */
export class FiremapError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: {
      collection?: string;
      field?: string;
      suggestion?: string;
    },
  ) {
    super(message);
    this.name = "FiremapError";
  }
}

/** Validation-specific error thrown by create/update operations */
export class FiremapValidationError extends FiremapError {
  constructor(
    code: string,
    message: string,
    details?: {
      collection?: string;
      field?: string;
      suggestion?: string;
      expectedType?: string;
      receivedType?: string;
    },
  ) {
    super(code, message, details);
    this.name = "FiremapValidationError";
  }
}
