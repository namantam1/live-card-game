export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: string;
}

export const validatePlayerName = (name: string): ValidationResult => {
  // Check if name is empty
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Please enter your name' };
  }

  // Check length
  if (name.length > 20) {
    return { valid: false, error: 'Name too long (max 20 characters)' };
  }

  // Sanitize name (remove special characters that could break UI)
  const sanitized = name.replace(/[<>]/g, '');
  if (sanitized !== name) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  return { valid: true, value: sanitized.trim() };
};

export const validateRoomCode = (code: string): ValidationResult => {
  const upperCode = code.trim().toUpperCase();

  // Check length
  if (upperCode.length !== 4) {
    return {
      valid: false,
      error: 'Please enter a valid 4-character room code',
    };
  }

  // Check format (excluding confusing characters like I, O, 0, 1)
  const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
  if (!validChars.test(upperCode)) {
    return { valid: false, error: 'Invalid room code format' };
  }

  return { valid: true, value: upperCode };
};
