# JWT Authentication Guide

## 1. Definition
JWT (JSON Web Token) is a compact, URL-safe token format used to securely transmit user identity claims between client and server.

A JWT has 3 parts:
- `header`: token metadata (algorithm + token type)
- `payload`: claims like user id, role, email
- `signature`: cryptographic signature using server secret

## 2. Core Concept
- User sends credentials to `/signin`.
- Server validates credentials from database.
- If valid, server signs a JWT using `JWT_SECRET`.
- Client stores token and sends it in future API calls:
  - `Authorization: Bearer <token>`
- Server verifies token before allowing protected operations.

JWT is stateless: server does not need session storage for each user login.

## 3. Implementation In This Project

### Files Added/Updated
- `backend/src/lib/jwt.ts`
- `backend/src/lib/tokenHash.ts`
- `backend/src/controllers/user.controller.ts`
- `backend/src/routes/user.routes.ts`
- `backend/src/prisma/modals/user.prisma`

### Environment Variables
Add in backend `.env`:

```env
JWT_SECRET=replace_with_a_long_random_secret
JWT_REFRESH_SECRET=replace_with_another_long_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## 4. `/signin` API (Implemented)

### Endpoint
`POST /api/user/signin`

### Request Body
Use either email or phone, with password:

```json
{
  "email": "user@example.com",
  "password": "your_password"
}
```

or

```json
{
  "phone": "9876543210",
  "password": "your_password"
}
```

### Validation Rules
- email or phone is required
- password is required
- invalid user/password returns `401 Invalid credentials`

### Success Response (200)
```json
{
  "message": "Sign in successful.",
  "code": 200,
  "data": {
    "id": "uuid",
    "name": "Test User",
    "phone": "9876543210",
    "email": "user@example.com",
    "alternatePhone": null,
    "createdAt": "2026-03-25T00:00:00.000Z",
    "updatedAt": "2026-03-25T00:00:00.000Z"
  },
  "auth": {
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "tokenType": "Bearer",
    "accessExpiresIn": "15m",
    "refreshExpiresIn": "7d"
  }
}
```

## 5. Step-by-Step Flow (Code Level)
1. Read and sanitize `email`, `phone`, `password` from request body.
2. Validate input and return `400` if fields are missing.
3. Fetch user from Prisma using email/phone.
4. Compare password with `bcrypt.compare`.
5. On successful signin, generate `sessionId` and sign:
   - access token payload: `sub`, `role`, `sid`, `email`, `phone`
   - refresh token payload: `sub`, `sid`, `type=refresh`
6. Hash refresh token with SHA-256 and store in DB.
7. Save single active session in user table:
   - `activeSessionId`
   - `refreshTokenHash`
   - `refreshTokenExpiresAt`
8. Return safe user object (without password) + access and refresh tokens.

## 6. Refresh Token API

### Endpoint
`POST /api/user/refresh-token`

### Request
```json
{
  "refreshToken": "your_refresh_token"
}
```

### What It Does
- verifies JWT signature/type
- checks DB session id match (`sid === activeSessionId`)
- checks hashed token match (`hash(refreshToken) === refreshTokenHash`)
- rotates refresh token (issues new refresh token + updates DB hash)
- returns new access token and refresh token

If user signs in on another device, old device refresh token becomes invalid immediately (single-device session).

## 7. Logout API

### Endpoint
`POST /api/user/logout`

### Request
```json
{
  "refreshToken": "your_refresh_token"
}
```

### What It Does
- verifies refresh token
- clears `activeSessionId`, `refreshTokenHash`, `refreshTokenExpiresAt`
- session is terminated

## 8. Security Notes (Important)
- Never include password in JWT payload.
- Keep `JWT_SECRET` private and strong.
- Use short expiry in production and add refresh-token flow if required.
- Use HTTPS in production so token is not exposed over plain HTTP.
- Add auth middleware to verify JWT for protected routes.

## 9. Test With cURL

```bash
curl --location 'http://localhost:3000/api/user/signin' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "user@example.com",
  "password": "your_password"
}'
```

## 10. Next Extension (Recommended)
- Create middleware to verify `Authorization` bearer token.
- Add protected endpoints like `/api/user/me`.
- Add device metadata (ip, user-agent) in session table for session auditing.
