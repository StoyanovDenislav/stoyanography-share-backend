# Stoyanography Share API Documentation

## Base URL

```
http://localhost:9001/api
```

## Photo Sharing Client Endpoints

### 1. Generate Credentials

**POST** `/client/generate-credentials`

Generate auto-credentials for a new photo sharing client (only email required).

**Request Body:**

```json
{
  "email": "client@example.com"
}
```

**Response (201 - Success):**

```json
{
  "success": true,
  "message": "Client credentials generated successfully",
  "credentials": {
    "username": "auto_generated_username",
    "password": "auto_generated_password",
    "email": "client@example.com"
  },
  "token": "jwt_token_here",
  "warning": "Please save these credentials securely. The password will not be shown again."
}
```

### 2. Client Login

**POST** `/client/login`

Login with auto-generated credentials.

**Request Body:**

```json
{
  "username": "auto_generated_username",
  "password": "auto_generated_password"
}
```

**Response (200 - Success):**

```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "client": {
    "id": "client_id",
    "username": "auto_generated_username",
    "email": "client@example.com",
    "lastLogin": "2025-01-01T00:00:00.000Z"
  }
}
```

### 3. Get Client Profile

**GET** `/client/profile`

Get current client's profile. Requires authentication.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

**Response (200 - Success):**

```json
{
  "success": true,
  "client": {
    "username": "auto_generated_username",
    "email": "client@example.com",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLogin": "2025-01-01T00:00:00.000Z",
    "isActive": true
  }
}
```

### 4. Deactivate Account

**POST** `/client/deactivate`

Deactivate client account. Requires authentication.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

**Response (200 - Success):**

```json
{
  "success": true,
  "message": "Client account deactivated successfully"
}
```

## Photo Management Endpoints

### 1. Upload Photo

**POST** `/photos/upload`

Upload a photo (protected route). Requires authentication.

**Headers:**

```
Authorization: Bearer jwt_token_here
Content-Type: multipart/form-data
```

**Form Data:**

```
photo: [image file]
```

**Response (201 - Success):**

```json
{
  "success": true,
  "message": "Photo uploaded successfully",
  "photo": {
    "id": "photo_id",
    "filename": "encrypted_filename",
    "originalName": "original_photo.jpg",
    "size": 1234567,
    "shareToken": "unique_share_token",
    "shareUrl": "http://localhost:9001/api/photos/share/unique_share_token",
    "uploadedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### 2. Get Client Photos

**GET** `/photos/my-photos`

Get all photos for the authenticated client.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

**Response (200 - Success):**

```json
{
  "success": true,
  "photos": [
    {
      "id": "photo_id",
      "filename": "encrypted_filename",
      "originalName": "original_photo.jpg",
      "size": 1234567,
      "shareToken": "unique_share_token",
      "shareUrl": "http://localhost:9001/api/photos/share/unique_share_token",
      "uploadedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### 3. Share Photo (Public)

**GET** `/photos/share/:shareToken`

Access a shared photo using its share token (public route).

**Response:**
Returns the image file with appropriate headers.

### 4. Delete Photo

**DELETE** `/photos/:photoId`

Delete a photo. Requires authentication.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

**Response (200 - Success):**

```json
{
  "success": true,
  "message": "Photo deleted successfully"
}
```

## Admin Authentication Endpoints (Optional)

### 1. Admin Register

**POST** `/auth/register`

Register an admin user (for system management).

**Request Body:**

```json
{
  "username": "admin_username",
  "email": "admin@example.com",
  "password": "SecurePassword123"
}
```

### 2. Admin Login

**POST** `/auth/login`

Admin authentication.

**Request Body:**

```json
{
  "username": "admin_username",
  "password": "SecurePassword123"
}
```

## Security Features

### Data Encryption

- **Client emails** are encrypted in the database
- **Photo metadata** (original names, mime types) are encrypted
- **Passwords** are hashed with bcrypt (12 salt rounds)
- **File names** are randomized and not guessable

### Authentication

- **JWT tokens** for session management
- **Auto-generated credentials** for clients (no manual registration)
- **Share tokens** for secure photo sharing without authentication

### Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Authentication routes**: 5 requests per 15 minutes per IP

### File Upload Security

- **File type validation**: Only image files allowed
- **File size limit**: 10MB maximum
- **Secure file names**: Randomized to prevent guessing
- **Upload directory**: Isolated from web root

## Frontend Features

### Client Interface

- **Email-only registration**: Clients only need to provide email
- **Credential display**: Auto-generated username/password shown once
- **Photo upload**: Drag & drop interface with progress
- **Photo gallery**: Grid view with management options
- **Share links**: One-click copy to clipboard
- **Responsive design**: Works on desktop and mobile

### User Experience

- **No manual registration**: Streamlined for clients
- **Secure credential generation**: Strong passwords auto-created
- **Easy sharing**: Direct links that work without login
- **File management**: Upload, view, share, and delete photos
- **Real-time updates**: Gallery refreshes after uploads

## Environment Variables

Create a `.env` file with:

```env
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
NODE_ENV=development
DB_HOST=192.168.0.104
DB_PORT=2424
DB_USERNAME=Denislav
DB_PASSWORD=pr1t3j4t3l!
DB_NAME=Share
PORT=9001
ENCRYPTION_KEY=your_super_secret_encryption_key_32_chars_long_change_this
```

## Database Schema

### Client Table

- `username` (STRING, UNIQUE): Auto-generated username
- `email` (STRING): Encrypted email address
- `plainEmail` (STRING, UNIQUE): Plain email for queries
- `password` (STRING): Bcrypt hashed password
- `createdAt` (DATETIME): Account creation timestamp
- `lastLogin` (DATETIME): Last login timestamp
- `isActive` (BOOLEAN): Account status
- `deactivatedAt` (DATETIME): Deactivation timestamp

### Photo Table

- `clientId` (STRING): Reference to client
- `filename` (STRING): Physical file name (randomized)
- `originalName` (STRING): Encrypted original file name
- `mimetype` (STRING): Encrypted MIME type
- `size` (LONG): File size in bytes
- `shareToken` (STRING, UNIQUE): Public sharing token
- `uploadedAt` (DATETIME): Upload timestamp
- `isActive` (BOOLEAN): Photo status
- `deletedAt` (DATETIME): Deletion timestamp

## Getting Started

1. **Setup Backend:**

   ```bash
   cd backend
   npm install
   npm run init-db
   npm run dev
   ```

2. **Setup Frontend:**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Access Application:**

   - Frontend: http://localhost:3000
   - Backend API: http://localhost:9001/api

4. **Test the Flow:**
   - Enter email to generate credentials
   - Login with generated credentials
   - Upload photos via drag & drop
   - Share photos using the generated links

## Error Codes

- **400**: Validation error or bad request
- **401**: Authentication required
- **403**: Invalid or expired token
- **404**: Resource not found
- **429**: Rate limit exceeded
- **500**: Internal server error

## Authentication Endpoints

### 1. Register User

**POST** `/auth/register`

Register a new user account.

**Request Body:**

```json
{
  "username": "string (3-30 chars, alphanumeric + underscore)",
  "email": "string (valid email)",
  "password": "string (min 8 chars, must contain uppercase, lowercase, number)"
}
```

**Response (201 - Success):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "username": "username",
    "email": "email@example.com"
  }
}
```

**Response (400 - Validation Error):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Username must be between 3 and 30 characters",
      "param": "username",
      "location": "body"
    }
  ]
}
```

### 2. Login User

**POST** `/auth/login`

Authenticate user and receive JWT token.

**Request Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200 - Success):**

```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "username": "username",
    "email": "email@example.com",
    "lastLogin": "2025-01-01T00:00:00.000Z"
  }
}
```

**Response (401 - Invalid Credentials):**

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### 3. Get User Profile

**GET** `/auth/profile`

Get current user's profile information. Requires authentication.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

**Response (200 - Success):**

```json
{
  "success": true,
  "user": {
    "username": "username",
    "email": "email@example.com",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLogin": "2025-01-01T00:00:00.000Z"
  }
}
```

### 4. Verify Token

**GET** `/auth/verify`

Verify if the provided token is valid. Requires authentication.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

**Response (200 - Success):**

```json
{
  "success": true,
  "message": "Token is valid",
  "user": {
    "userId": "user_id",
    "username": "username",
    "email": "email@example.com"
  }
}
```

### 5. Logout

**POST** `/auth/logout`

Logout user (client should remove token). Requires authentication.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

**Response (200 - Success):**

```json
{
  "success": true,
  "message": "Logout successful. Please remove the token from client storage."
}
```

## Protected Routes

### Example Protected Route

**GET** `/protected`

Example of a protected route that requires authentication.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

**Response (200 - Success):**

```json
{
  "success": true,
  "message": "This is a protected route",
  "user": {
    "userId": "user_id",
    "username": "username",
    "email": "email@example.com"
  }
}
```

## General Endpoints

### Health Check

**GET** `/health`

Check if the API is running.

**Response (200):**

```json
{
  "success": true,
  "message": "API is working",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Error Responses

### 401 - Unauthorized

```json
{
  "success": false,
  "message": "Access token required"
}
```

### 403 - Forbidden

```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### 404 - Not Found

```json
{
  "success": false,
  "message": "Route not found"
}
```

### 429 - Rate Limited

```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

### 500 - Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Authentication Flow

1. **Register** a new user with `/auth/register`
2. **Login** with credentials using `/auth/login`
3. **Store** the received JWT token securely on the client
4. **Include** the token in the `Authorization` header for protected routes:
   ```
   Authorization: Bearer YOUR_JWT_TOKEN
   ```
5. **Verify** token validity with `/auth/verify` if needed
6. **Logout** and remove token from client storage

## Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Authentication routes**: 5 requests per 15 minutes per IP

## Security Features

- Password hashing with bcrypt (12 salt rounds)
- JWT token-based authentication
- Input validation and sanitization
- Rate limiting
- CORS protection
- Security headers with Helmet.js
- Unique username and email constraints

## Environment Variables

Create a `.env` file with:

```env
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
NODE_ENV=development
DB_HOST=192.168.0.104
DB_PORT=2424
DB_USERNAME=Denislav
DB_PASSWORD=pr1t3j4t3l!
DB_NAME=Share
PORT=7000
```
