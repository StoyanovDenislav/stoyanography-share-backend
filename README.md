# 🔒 Stoyanography Share - Privacy-First Photo Sharing Platform

## 📋 System Overview

A secure, multi-tier photo sharing platform with **email privacy protection** and **encrypted B64 image storage** in the database.

## 🏗️ Architecture

### 👥 4-Tier User System

1. **Administrator** - System management
2. **Photographer** - Photo uploaders and client managers
3. **Client** - Photo viewers and guest managers
4. **Guest** - Temporary photo viewers

### 🔐 Key Privacy Features

#### Email Privacy Protection

- ✅ **Plain emails are NEVER stored in the database**
- ✅ Only encrypted emails are stored for duplicate prevention
- ✅ Emails used only for sending credentials, then discarded
- ✅ API responses exclude email addresses for privacy
- ✅ User lookups work with encrypted email hashes

#### Auto-Generated Credentials

- ✅ Secure username/password generation
- ✅ Credentials sent via email notification
- ✅ No manual registration process
- ✅ Photographer creates clients, clients create guests

#### Encrypted Image Storage

- ✅ Images stored as encrypted Base64 in database
- ✅ Thumbnail generation with compression
- ✅ Metadata extraction and storage
- ✅ No file system storage required

## 🚀 Implementation Status

### ✅ Completed Features

#### Backend Services

- **DatabaseService** - OrientDB integration with complete schema
- **EncryptionService** - AES encryption for emails and images
- **EmailService** - Nodemailer integration for credential delivery
- **UserCredentialsService** - Secure credential generation
- **EnhancedPhotoService** - B64 image processing with Sharp
- **PhotographerService** - Client management and photo sharing
- **ClientService** - Guest management and photo access
- **GuestService** - Temporary access with expiration
- **AdminService** - Photographer management

#### Database Schema

- **User** - System administrators
- **Photographer** - Photo uploaders with business info
- **Client** - Photo viewers (NO plain email stored)
- **Guest** - Temporary viewers (NO plain email stored)
- **Photo** - Encrypted B64 storage with metadata
- **PhotoGroup** - Photo organization
- **PhotoAccess** - Fine-grained permissions
- **GuestAccess** - Temporary access tracking

#### Authentication & Security

- **JWT token-based authentication**
- **Role-based access control**
- **Password hashing with bcrypt**
- **Rate limiting and CORS protection**
- **Helmet security headers**

#### API Endpoints

- **Admin Routes** - `/api/admin/*`
- **Photographer Routes** - `/api/photographer/*`
- **Client Routes** - `/api/client/*`
- **Guest Routes** - `/api/guest/*`
- **Auth Routes** - `/api/auth/*`
- **Photo Routes** - `/api/photos/*`

### 🔄 Workflow Examples

#### Client Creation (Email Privacy)

1. Photographer enters client email + name
2. System generates secure credentials
3. Email sent with login details
4. **Email address is NOT stored in database**
5. Only encrypted hash stored for duplicate prevention
6. Client receives credentials via email

#### Guest Creation (Email Privacy)

1. Client selects photos to share
2. Client enters guest email + expiration
3. System generates temporary credentials
4. Email sent with access details
5. **Email address is NOT stored in database**
6. Guest gets time-limited access

#### Photo Upload & Storage

1. Photographer uploads photos
2. Sharp processes and compresses images
3. Generates thumbnails automatically
4. Encrypts image data
5. Stores as Base64 in database
6. Extracts and stores metadata

## 📁 File Structure

```
backend/
├── services/
│   ├── emailService.js          # 📧 Email notifications
│   ├── encryptionService.js     # 🔐 AES encryption
│   ├── enhancedPhotoService.js  # 📸 B64 image processing
│   ├── photographerService.js   # 👨‍💼 Client management
│   ├── clientService.js         # 👤 Guest management
│   ├── guestService.js          # 👥 Temporary access
│   └── adminService.js          # ⚙️ System admin
├── routes/
│   ├── admin.js                 # Admin endpoints
│   ├── photographer.js          # Photographer endpoints
│   ├── client.js                # Client endpoints
│   ├── guest.js                 # Guest endpoints
│   ├── auth.js                  # Authentication
│   └── api.js                   # Main router
├── scripts/
│   ├── initDbComplete.js        # 🗄️ Database initialization
│   ├── testEmailPrivacy.js     # 🧪 Privacy tests
│   └── testSystem.js            # 🧪 Full system tests
├── middleware/
│   └── auth.js                  # JWT middleware
├── Database/
│   └── databaseClass.js         # OrientDB connection
└── UserManagement/
    └── generateUserCredentials.js # Credential generation
```

## 🧪 Testing

### Run Tests

```bash
# Test email privacy system
node scripts/testEmailPrivacy.js

# Test complete system
node scripts/testSystem.js

# Initialize database
node scripts/initDbComplete.js
```

### Test Scenarios

- ✅ Admin creates photographers
- ✅ Photographer creates clients (email privacy)
- ✅ Client creates guests (email privacy)
- ✅ Auto-generated secure credentials
- ✅ Email notifications (development logging)
- ✅ JWT authentication across all roles
- ✅ Encrypted data storage

## 🚀 Deployment Notes

### Environment Variables

```env
# Database
DB_HOST=192.168.0.104
DB_PORT=2424
DB_USERNAME=Denislav
DB_PASSWORD=pr1t3j4t3l!
DB_NAME=Share

# Server
PORT=9001
NODE_ENV=development

# Security
JWT_SECRET=your_super_secret_jwt_key
ENCRYPTION_KEY=your_super_secret_encryption_key_32_chars

# Email (for production)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password
SMTP_FROM="Stoyanography Share" <noreply@domain.com>

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Production Checklist

- [ ] Configure real SMTP settings
- [ ] Update JWT secrets
- [ ] Update encryption keys
- [ ] Configure CORS origins
- [ ] Set up SSL certificates
- [ ] Configure rate limiting
- [ ] Set up monitoring

## 🔒 Security Features

### Email Privacy

- Plain emails never stored in database
- Encrypted email hashes for duplicate prevention
- Credentials sent via secure email delivery
- API responses exclude email addresses

### Data Protection

- AES encryption for sensitive data
- Bcrypt password hashing (12 rounds)
- JWT tokens with expiration
- Role-based access control
- Input validation and sanitization

### Photo Security

- Encrypted Base64 storage in database
- No file system exposure
- Compressed thumbnails for performance
- Metadata extraction and storage
- Access control per photo

## 📈 Performance Features

### Image Optimization

- Sharp library for fast processing
- Automatic compression (configurable quality)
- Thumbnail generation
- Base64 encoding for database storage

### Database Optimization

- Strategic indexes on lookup fields
- Encrypted email indexing
- Date-based queries for expiration
- Efficient photo access queries

## 🎯 Next Steps for Frontend

1. **Update login forms** for 4-tier authentication
2. **Implement photo upload** with preview
3. **Create client management** interface for photographers
4. **Build guest sharing** interface for clients
5. **Add photo gallery** with access controls
6. **Implement admin dashboard** for photographer management

---

**🎉 The backend is now complete with email privacy protection and encrypted B64 image storage!**
