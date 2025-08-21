<p align="center">
  <a href="#" target="_blank">
    <img src="https://i.imgur.com/E7v3q4Z.png" alt="Unisphere Logo" width="120">
  </a>
</p>

<h1 align="center">Unisphere Exam Platform - Backend</h1>

<p align="center">
  <strong>A robust and scalable backend for the Unisphere examination system.</strong>
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8.2-blue?style=for-the-badge&logo=typescript">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22.13.10-green?style=for-the-badge&logo=node.js">
  <img alt="Express.js" src="https://img.shields.io/badge/Express.js-4.21.2-lightgrey?style=for-the-badge&logo=express">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-8.14.1-blue?style=for-the-badge&logo=postgresql">
  <img alt="Drizzle ORM" src="https://img.shields.io/badge/Drizzle%20ORM-0.41.0-green?style=for-the-badge&logo=drizzle">
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-api-documentation">API Documentation</a> •
  <a href="#-database-schema">Database Schema</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="#-license">License</a>
</p>

---

## ✨ Features

*   **Secure Authentication**: JWT-based authentication for both students and administrators.
*   **Exam Management**: Create, read, update, and delete exams with questions and options.
*   **Exam Sessions**: Start, submit, and review exam sessions.
*   **Automated Grading**: Automatic scoring of exams upon submission.
*   **User Management**: Manage users and their roles.
*   **Bulk User Creation**: Easily create multiple user accounts at once.
*   **Image Uploads**: Support for uploading images for questions.
*   **Email Notifications**: Automated welcome emails for new users.
*   **Detailed Results**: In-depth exam results for both students and administrators.

---

## 🚀 Tech Stack

*   **Backend**: [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/), [TypeScript](https://www.typescriptlang.org/)
*   **Database**: [PostgreSQL](https://www.postgresql.org/)
*   **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
*   **Authentication**: [JSON Web Tokens (JWT)](https://jwt.io/)
*   **Validation**: [express-validator](https://express-validator.github.io/)
*   **Email**: [Nodemailer](https://nodemailer.com/)
*   **File Uploads**: [Multer](https://github.com/expressjs/multer)

---

## 🏁 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/en/download/) (v18 or higher)
*   [PostgreSQL](https://www.postgresql.org/download/)
*   [Bun](https://bun.sh/) (optional, for faster package management)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/Exam-Platform-backend.git
    cd Exam-Platform-backend
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    # or
    bun install
    ```

3.  **Set up environment variables:**

    Create a `.env` file in the root directory and add the following variables:

    ```env
    # Database
    DATABASE_URL=postgres://user:password@localhost:5432/dbname

    # JWT
    JWT_SECRET=your-super-secret-jwt-key

    # Server
    PORT=3000

    # Email (for sending welcome emails)
    EMAIL=your-email@gmail.com
    PASSWORD=your-email-password
    ```

4.  **Set up the database:**

    ```bash
    # Apply migrations to create the database schema
    npm run db:push
    ```

5.  **Start the development server:**

    ```bash
    npm run dev
    ```

The server will be running at `http://localhost:3000`.

---

## 📖 API Documentation

The API is documented using a combination of the existing `context.txt` and `context-admin-updated.txt` files. Here is a summary of the available endpoints.

### Response Format

All API responses follow a consistent format:

**Success:**

```json
{
  "data": {
    // ... response data
  }
}
```

**Error:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "A descriptive error message."
  }
}
```

### Authentication

*   `POST /api/auth/login`: Login as a student.
*   `GET /api/auth/me`: Get the current user's information.
*   `POST /api/auth/logout`: Logout the current user.

### Admin

*   `POST /api/admin/login`: Login as an administrator.
*   `GET /api/admin/exams`: Get a list of all exams.
*   `POST /api/admin/exams`: Create a new exam.
*   `GET /api/admin/exams/:examId`: Get details of a specific exam.
*   `GET /api/admin/exams/:examId/results`: Get results for a specific exam.
*   `GET /api/admin/exams/:examId/results/:userId`: Get results for a specific student on a specific exam.
*   `DELETE /api/admin/exams/:examId`: Delete an exam.
*   `GET /api/admin/users`: Get a list of all users.
*   `POST /api/admin/users/bulk`: Create multiple users at once.
*   `POST /api/admin/upload-image`: Upload an image for a question.

### Exams

*   `GET /api/exams`: Get a list of available exams.
*   `GET /api/exams/results`: Get all exam results for the current user.
*   `GET /api/exams/:examId`: Get details of a specific exam.
*   `POST /api/exams/:examId/start`: Start an exam session.
*   `POST /api/exams/:examId/submit`: Submit an exam.
*   `GET /api/exams/:examId/results`: Get the results for a specific exam.

---

## 🗄️ Database Schema

The database schema is designed to be simple and efficient. It consists of the following tables:

*   `admins`: Stores administrator accounts.
*   `users`: Stores student accounts.
*   `exams`: Stores exam information.
*   `questions`: Stores exam questions.
*   `question_options`: Stores the options for each question.
*   `exam_sessions`: Stores information about each exam session.
*   `exam_answers`: Stores the answers submitted by students.

Here is a diagram of the database schema:

```mermaid
erDiagram
    admins {
        uuid id PK
        text email
        text password
        text name
        timestamp created_at
    }

    users {
        uuid id PK
        text email
        text username
        text password
        timestamp created_at
    }

    exams {
        uuid id PK
        text title
        text description
        integer duration
        timestamp start_time
        timestamp end_time
        timestamp created_at
    }

    questions {
        uuid id PK
        uuid exam_id FK
        text text
        text[] image_urls
        uuid correct_option_id
        timestamp created_at
    }

    question_options {
        uuid id PK
        uuid question_id FK
        text text
        timestamp created_at
    }

    exam_sessions {
        uuid id PK
        uuid exam_id FK
        uuid user_id FK
        timestamp start_time
        timestamp end_time
        boolean completed
        timestamp created_at
    }

    exam_answers {
        uuid id PK
        uuid session_id FK
        uuid question_id FK
        uuid selected_option_id FK
        timestamp created_at
    }

    exams ||--o{ questions : "has"
    questions ||--o{ question_options : "has"
    users ||--o{ exam_sessions : "has"
    exams ||--o{ exam_sessions : "has"
    exam_sessions ||--o{ exam_answers : "has"
    questions ||--o{ exam_answers : "has"
    question_options ||--o{ exam_answers : "has"
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 📞 Contact

If you have any questions or suggestions, feel free to reach out to me at [your-email@example.com](mailto:your-email@example.com).