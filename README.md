# Unisphere Exam Backend

A TypeScript-based Express.js backend for the Unisphere examination system with PostgreSQL database using Drizzle ORM.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```env
DATABASE_URL=your_postgres_url
JWT_SECRET=your_jwt_secret
PORT=3000
```

3. Set up the database:
```bash
npm run db:push    # Create database schema

# Then either:
npm run db:seed    # Create sample exam via CLI script
# OR use the API endpoint:
# POST /api/admin/create-sample-exam
```

4. Start development server:
```bash
npm run dev
```

## API Endpoints

### Admin Endpoints

#### Create Sample Exam
```
POST /api/admin/create-sample-exam
Headers: {
  "Authorization": "Bearer {token}"
}
Response: {
  "data": {
    "message": "Sample exam created successfully",
    "exam": {
      "id": string,
      "title": string,
      "description": string,
      "duration": number
    }
  }
}
```

### Authentication

#### Register User
```
POST /api/auth/register
Body: {
  "email": string,
  "password": string,
  "username": string
}
```

#### Login
```
POST /api/auth/login
Body: {
  "email": string,
  "password": string
}
```

#### Get Current User
```
GET /api/auth/me
Headers: {
  "Authorization": "Bearer {token}"
}
```

#### Logout
```
POST /api/auth/logout
Headers: {
  "Authorization": "Bearer {token}"
}
```

### Exams

#### List Available Exams
```
GET /api/exams
Headers: {
  "Authorization": "Bearer {token}"
}
```

#### Get Exam Details
```
GET /api/exams/:examId
Headers: {
  "Authorization": "Bearer {token}"
}
```

#### Start Exam
```
POST /api/exams/:examId/start
Headers: {
  "Authorization": "Bearer {token}"
}
```

#### Submit Exam
```
POST /api/exams/:examId/submit
Headers: {
  "Authorization": "Bearer {token}"
}
Body: {
  "answers": [
    {
      "questionId": string,
      "selectedOptionId": string
    }
  ]
}
```

#### Get Exam Results
```
GET /api/exams/:examId/results
Headers: {
  "Authorization": "Bearer {token}"
}
```

#### Get All Results
```
GET /api/exams/results
Headers: {
  "Authorization": "Bearer {token}"
}
```

## Project Structure

```
src/
├── db/
│   ├── index.ts        # Database connection
│   ├── schema.ts       # Database schema definitions
│   └── migrations/     # Generated migrations
├── middleware/
│   └── auth.ts         # Authentication middleware
├── routes/
│   ├── admin.ts        # Admin routes
│   ├── auth.ts         # Authentication routes
│   └── exams.ts        # Exam routes
├── scripts/
│   └── init-data.ts    # Database seeding script
├── types/
│   └── express.ts      # Type definitions
└── index.ts            # Main application entry
```

## Response Format

All API responses follow this format:

Success:
```json
{
  "data": {
    // Response data
  }
}
```

Error:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

## Error Codes

- `VALIDATION_ERROR`: Invalid input data
- `AUTH_ERROR`: Authentication error
- `NOT_FOUND`: Resource not found
- `SESSION_EXISTS`: Active exam session already exists
- `INVALID_TIME`: Exam not available at this time
- `SESSION_NOT_FOUND`: No active exam session found
- `RESULTS_NOT_FOUND`: No completed exam session found
- `SERVER_ERROR`: Internal server error

## Development

- `npm run dev`: Start development server with hot reload
- `npm run build`: Build for production
- `npm start`: Start production server
- `npm run db:generate`: Generate database migrations
- `npm run db:push`: Push schema changes to database
- `npm run db:studio`: Open Drizzle Studio
- `npm run db:seed`: Seed database with sample exam
