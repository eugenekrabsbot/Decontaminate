# TOTP-based Two-Factor Authentication (2FA) for AhoyVPN

This document describes the implementation of TOTP-based two-factor authentication for AhoyVPN customers, including setup, login flows, recovery codes, and optional enforcement for sensitive actions.

## Database Schema Updates

The `users` table already includes the following columns relevant to 2FA:

- `totp_secret` VARCHAR(255) – stores the base32 TOTP secret (should be encrypted at rest)
- `totp_enabled` BOOLEAN NOT NULL DEFAULT false – indicates whether 2FA is active
- `recovery_codes` JSONB DEFAULT '[]' – stores hashed recovery codes as an array of `{ codeHash, used }`
- `last_2fa_verification` TIMESTAMP – timestamp of the last successful 2FA verification (used for step‑up authentication)
- `backup_codes_generated_at` TIMESTAMP – when recovery codes were last generated

## Dependencies

- `speakeasy` – TOTP secret generation and verification
- `qrcode` – QR code generation for authenticator app setup

These are already installed via `npm install`.

## API Endpoints

### 1. Enable 2FA (Setup)

**POST** `/api/auth/2fa/enable`  
*Protected (requires valid JWT)*

Generates a new TOTP secret and returns a QR code (as a data URL) and the secret for manual entry. The secret is stored in the database but 2FA remains disabled until verified.

**Request body:** none

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "otpauthUrl": "otpauth://totp/AhoyVPN:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=AhoyVPN",
    "qrCodeDataUrl": "data:image/png;base64,..."
  }
}
```

### 2. Verify 2FA Setup

**POST** `/api/auth/2fa/verify`  
*Protected (requires valid JWT)*

Verifies the TOTP token from the user's authenticator app. If valid, enables 2FA for the account, generates 10 recovery codes, and stores them as bcrypt‑hashed entries.

**Request body:**
```json
{
  "token": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recoveryCodes": ["ABCDE-12345", "FGHIJ-67890", ...],
    "message": "Two-factor authentication enabled successfully"
  }
}
```

**Important:** The plain‑text recovery codes are returned **only once**. They must be shown to the user and stored securely by the user.

### 3. Disable 2FA

**POST** `/api/auth/2fa/disable`  
*Protected (requires valid JWT)*

Disables 2FA for the account. Requires the user's password for confirmation. Removes the TOTP secret and clears all recovery codes.

**Request body:**
```json
{
  "password": "userPassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Two-factor authentication disabled successfully"
}
```

### 4. Login with 2FA

The standard login endpoint (`POST /api/auth/login`) automatically detects if 2FA is enabled for the user.

**Normal login (2FA not enabled):**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```
Response includes access and refresh tokens.

**When 2FA is enabled:**
Response:
```json
{
  "success": true,
  "requires2fa": true,
  "tempToken": "a1b2c3d4e5...",
  "message": "Two-factor authentication required"
}
```

The client must then call the 2FA verification endpoint.

### 5. Verify 2FA during Login

**POST** `/api/auth/2fa/verify-login`  
*Public*

Verifies the TOTP token using the temporary token obtained from the login response.

**Request body:**
```json
{
  "tempToken": "a1b2c3d4e5...",
  "token": "123456"
}
```

**Response:** Same as normal login (access + refresh tokens). The JWT will contain a `twoFactorVerified: true` claim.

### 6. Generate New Recovery Codes

**POST** `/api/auth/recovery-codes/generate`  
*Protected (requires valid JWT)*

Generates 10 new recovery codes, replacing any existing ones. Returns the plain‑text codes (one time only).

**Request body:** none

**Response:**
```json
{
  "success": true,
  "data": {
    "recoveryCodes": ["NEWCO-DE123", ...],
    "message": "New recovery codes generated. Save them securely."
  }
}
```

### 7. Login with a Recovery Code

**POST** `/api/auth/recovery-codes/verify`  
*Public*

Allows a user to authenticate using a recovery code as the second factor. Requires email, password, and a recovery code.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "password",
  "recoveryCode": "ABCDE-12345"
}
```

**Response:** Same as normal login (access + refresh tokens). The used recovery code is consumed (marked as used) and cannot be reused.

## Step‑Up Authentication for Sensitive Actions

Sensitive endpoints (e.g., updating profile, changing payment method) can be protected with the `require2FA` middleware. This middleware checks:

1. If the user has 2FA enabled (`totp_enabled = true`).
2. If `last_2fa_verification` is within the last 15 minutes.

If either condition fails, the endpoint returns a `403` error with a message indicating that 2FA verification is required.

### Example Protected Route

```javascript
router.put('/profile', authMiddleware.protect, authMiddleware.require2FA, userController.updateProfile);
```

### Re‑verification Endpoint

The same `POST /api/auth/2fa/verify` endpoint can be used to refresh the `last_2fa_verification` timestamp, provided the user supplies a valid TOTP token.

## Security Considerations

1. **TOTP Secret Storage:** The `totp_secret` is stored in plain text in the database. In a production environment, it should be encrypted at rest using a strong encryption key (e.g., AES‑256‑GCM). Consider adding an `encryption_key` environment variable and a utility to encrypt/decrypt the secret.

2. **Recovery Codes:** Each recovery code is hashed individually using bcrypt (salt rounds = 10). The plain codes are never stored and are shown to the user only once.

3. **Temporary Tokens:** Temporary tokens for pending 2FA logins are stored in‑memory (`Map`) and expire after 5 minutes. In a multi‑server setup, a shared store (Redis) should be used.

4. **JWT Claims:** The access token includes a `twoFactorVerified` boolean claim that indicates whether the user passed 2FA during the current session. This claim is set to `true` when 2FA is verified (or when the user does not have 2FA enabled).

5. **Rate Limiting:** All authentication endpoints are already protected by global rate limiting (100 requests per 15 minutes). Consider stricter limits for 2FA verification endpoints.

## Frontend Integration Guidelines

1. **Setup Flow:**
   - Call `POST /api/auth/2fa/enable` to get secret & QR code.
   - Display QR code and secret (for manual entry).
   - Prompt user to enter a token from their authenticator app.
   - Call `POST /api/auth/2fa/verify` with the token.
   - Show the generated recovery codes and instruct the user to save them.

2. **Login Flow:**
   - Call `POST /api/auth/login` with email/password.
   - If response contains `requires2fa: true`, show a TOTP input field and pass the `tempToken` along with the token to `POST /api/auth/2fa/verify-login`.
   - Optionally, provide a “Use a recovery code” link that redirects to a form that calls `POST /api/auth/recovery-codes/verify` with email, password, and recovery code.

3. **Recovery Code Management:**
   - Allow users to view/generate new recovery codes via a protected settings page (calls `POST /api/auth/recovery-codes/generate`).

## Testing

To test the 2FA flow locally:

1. Run the database migrations (including the new columns).
2. Start the backend server.
3. Register a new user or use an existing one.
4. Enable 2FA and verify with a TOTP token (use an authenticator app like Google Authenticator or Authy).
5. Log out and log in again – you should be prompted for a 2FA token.
6. Test recovery codes by using one during login.

## Future Improvements

- Add support for WebAuthn (FIDO2) as a second factor.
- Allow users to remember a device for 30 days (by issuing a long‑lived token that bypasses 2FA on that device).
- Implement a “trusted device” feature using device fingerprints.
- Send email notifications when 2FA is enabled/disabled or when a recovery code is used.
- Add audit logging for all 2FA‑related actions.

---

*This implementation provides a robust, user‑friendly TOTP‑based 2FA system that integrates seamlessly with the existing AhoyVPN authentication framework.*