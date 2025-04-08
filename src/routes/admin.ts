import { Router, Response, RequestHandler } from 'express';
import { db } from '../db/index.js';
import { admins, exams, questions, questionOptions, examSessions, users, examAnswers } from '../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { adminAuth } from '../middleware/admin-auth.js';
import { AuthRequest } from '../types/express.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendWelcomeEmail } from '../utils/email.js'; // Import the email utility

const router = Router();

// Admin Authentication Routes

router.post('/login', (async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
        },
      });
    }

    // Find admin
    const admin = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    if (!admin[0]) {
      return res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid credentials',
        },
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, admin[0].password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid credentials',
        },
      });
    }

    // Generate JWT
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign({ id: admin[0].id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      data: {
        admin: {
          id: admin[0].id,
          email: admin[0].email,
          name: admin[0].name,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error logging in',
      },
    });
  }
}) as unknown as RequestHandler);

// Protected Admin Routes

// Get all exams
router.get('/exams', adminAuth, (async (req: AuthRequest, res: Response) => {
  try {
    const allExams = await db.select().from(exams).orderBy(desc(exams.createdAt));
    res.json({ data: allExams });
  } catch (error) {
    console.error('Get all exams error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching exams',
      },
    });
  }
}) as unknown as RequestHandler);

// Create exam
router.post('/exams', adminAuth, (async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, duration, startTime, endTime, questions: questionsList } = req.body;

    // Validate input
    if (!title || !description || !duration || !startTime || !endTime || !questionsList?.length) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'All fields are required and exam must have at least one question',
        },
      });
    }

    // Create exam
    const [exam] = await db.insert(exams).values({
      title,
      description,
      duration,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    }).returning();

    // Create questions and their options
    for (const questionData of questionsList) {
      const [question] = await db.insert(questions).values({
        examId: exam.id,
        text: questionData.text,
      }).returning();

      const createdOptions = await Promise.all(
        questionData.options.map(async (option: { text: string; correct: boolean }) => {
          const [createdOption] = await db.insert(questionOptions).values({
            questionId: question.id,
            text: option.text,
          }).returning();
          return { ...createdOption, correct: option.correct };
        })
      );

      // Update question with correct option
      const correctOption = createdOptions.find(opt => opt.correct);
      if (correctOption) {
        await db.update(questions)
          .set({ correctOptionId: correctOption.id })
          .where(eq(questions.id, question.id));
      }
    }

    res.status(201).json({
      data: {
        message: 'Exam created successfully',
        exam,
      },
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error creating exam',
      },
    });
  }
}) as unknown as RequestHandler);

// Get exam details with questions and options
router.get('/exams/:examId', adminAuth, (async (req: AuthRequest, res: Response) => {
  try {
    const { examId } = req.params;
    const exam = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);

    if (!exam[0]) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Exam not found',
        },
      });
    }

    const examQuestions = await db.select().from(questions)
      .where(eq(questions.examId, examId));

    const questionIds = examQuestions.map(q => q.id);
    const options = await db.select().from(questionOptions)
      .where(inArray(questionOptions.questionId, questionIds));

    // Group options by question
    const questionMap = new Map();
    examQuestions.forEach(question => {
      questionMap.set(question.id, {
        ...question,
        options: [],
      });
    });

    options.forEach(option => {
      const question = questionMap.get(option.questionId);
      if (question) {
        question.options.push({
          id: option.id,
          text: option.text,
          correct: option.id === question.correctOptionId,
        });
      }
    });

    res.json({
      data: {
        ...exam[0],
        questions: Array.from(questionMap.values()),
      },
    });
  } catch (error) {
    console.error('Get exam details error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching exam details',
      },
    });
  }
}) as unknown as RequestHandler);

// Get exam results with user details
router.get('/exams/:examId/results', adminAuth, (async (req: AuthRequest, res: Response) => {
  try {
    const { examId } = req.params;
    
    const sessions = await db.select({
      sessionId: examSessions.id,
      startTime: examSessions.startTime,
      endTime: examSessions.endTime,
      completed: examSessions.completed,
      userId: users.id,
      userEmail: users.email,
      username: users.username,
    })
    .from(examSessions)
    .leftJoin(users, eq(examSessions.userId, users.id))
    .where(eq(examSessions.examId, examId));

    // Get all questions for this exam
    const examQuestions = await db.select().from(questions)
      .where(eq(questions.examId, examId));

    const results = await Promise.all(
      sessions.map(async (session) => {
        if (!session.completed) {
          return {
            ...session,
            score: null,
            totalQuestions: examQuestions.length,
            answers: [],
          };
        }

        const answers = await db.select().from(examAnswers)
          .where(eq(examAnswers.sessionId, session.sessionId));

        let correctAnswers = 0;
        const answersWithDetails = await Promise.all(
          answers.map(async (answer) => {
            const question = examQuestions.find(q => q.id === answer.questionId);
            const isCorrect = question?.correctOptionId === answer.selectedOptionId;
            if (isCorrect) correctAnswers++;

            // Get selected option text
            const [selectedOption] = await db.select()
              .from(questionOptions)
              .where(eq(questionOptions.id, answer.selectedOptionId))
              .limit(1);

            return {
              questionId: answer.questionId,
              selectedOptionId: answer.selectedOptionId,
              selectedOptionText: selectedOption?.text,
              isCorrect,
            };
          })
        );

        return {
          ...session,
          score: (correctAnswers / examQuestions.length) * 100,
          totalQuestions: examQuestions.length,
          answers: answersWithDetails,
        };
      })
    );

    res.json({ data: results });
  } catch (error) {
    console.error('Get exam results error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching exam results',
      },
    });
  }
}) as unknown as RequestHandler);

// Get specific student's result for an exam
router.get('/exams/:examId/results/:userId', adminAuth, (async (req: AuthRequest, res: Response) => {
  try {
    const { examId, userId } = req.params;

    // Find the specific exam session for this user and exam
    const [session] = await db.select({
      sessionId: examSessions.id,
      startTime: examSessions.startTime,
      endTime: examSessions.endTime,
      completed: examSessions.completed,
      userId: users.id,
      userEmail: users.email,
      username: users.username,
    })
    .from(examSessions)
    .leftJoin(users, eq(examSessions.userId, users.id))
    .where(and(eq(examSessions.examId, examId), eq(examSessions.userId, userId)))
    .limit(1);

    if (!session) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'No exam session found for this user and exam.',
        },
      });
    }

    // If the session wasn't completed, return basic info
    if (!session.completed) {
      return res.json({
        data: {
          ...session,
          score: null,
          totalQuestions: null, // We don't know total questions without fetching them
          answers: [],
          message: 'Exam session not completed.',
        },
      });
    }

    // Get all questions for this exam to calculate score and details
    const examQuestions = await db.select().from(questions)
      .where(eq(questions.examId, examId));

    // Get the answers submitted by the user in this session
    const answers = await db.select().from(examAnswers)
      .where(eq(examAnswers.sessionId, session.sessionId));

    let correctAnswers = 0;
    const answersWithDetails = await Promise.all(
      answers.map(async (answer) => {
        const question = examQuestions.find(q => q.id === answer.questionId);
        const isCorrect = question?.correctOptionId === answer.selectedOptionId;
        if (isCorrect) correctAnswers++;

        // Get question text
        const questionText = question?.text;

        // Get selected option text
        const [selectedOption] = await db.select({ text: questionOptions.text })
          .from(questionOptions)
          .where(eq(questionOptions.id, answer.selectedOptionId))
          .limit(1);

        // Get correct option text (if different from selected)
        let correctOptionText = null;
        if (question?.correctOptionId && !isCorrect) {
           const [correctOption] = await db.select({ text: questionOptions.text })
            .from(questionOptions)
            .where(eq(questionOptions.id, question.correctOptionId))
            .limit(1);
            correctOptionText = correctOption?.text;
        }


        return {
          questionId: answer.questionId,
          questionText: questionText,
          selectedOptionId: answer.selectedOptionId,
          selectedOptionText: selectedOption?.text,
          correctOptionId: question?.correctOptionId,
          correctOptionText: isCorrect ? selectedOption?.text : correctOptionText,
          isCorrect,
        };
      })
    );

    const score = examQuestions.length > 0 ? (correctAnswers / examQuestions.length) * 100 : 0;

    res.json({
      data: {
        ...session,
        score: score,
        totalQuestions: examQuestions.length,
        correctAnswers: correctAnswers,
        answers: answersWithDetails,
      },
    });

  } catch (error) {
    console.error('Get specific student exam result error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching specific student exam result',
      },
    });
  }
}) as unknown as RequestHandler);


// Delete exam
router.delete('/exams/:examId', adminAuth, (async (req: AuthRequest, res: Response) => {
  try {
    const { examId } = req.params;

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // 1. Find related exam sessions
      const sessionsToDelete = await tx.select({ id: examSessions.id })
        .from(examSessions)
        .where(eq(examSessions.examId, examId));

      if (sessionsToDelete.length > 0) {
        const sessionIds = sessionsToDelete.map(s => s.id);

        // 2. Delete related exam answers (dependent on sessions)
        await tx.delete(examAnswers)
          .where(inArray(examAnswers.sessionId, sessionIds));

        // 3. Delete related exam sessions (dependent on exam)
        await tx.delete(examSessions)
          .where(eq(examSessions.examId, examId));
      }

      // 4. Find related questions
      const questionsToDelete = await tx.select({ id: questions.id })
        .from(questions)
        .where(eq(questions.examId, examId));

      if (questionsToDelete.length > 0) {
        const questionIds = questionsToDelete.map(q => q.id);

        // 5. Delete related question options (dependent on questions)
        await tx.delete(questionOptions)
          .where(inArray(questionOptions.questionId, questionIds));

        // 6. Delete related questions (dependent on exam)
        await tx.delete(questions)
          .where(eq(questions.examId, examId));
      }

      // 7. Delete the exam itself
      const deleteResult = await tx.delete(exams).where(eq(exams.id, examId)).returning();

      if (deleteResult.length === 0) {
        // If the exam wasn't found (maybe deleted in another request)
        // Rollback transaction by throwing an error
        throw new Error('Exam not found'); 
      }
    });

    res.json({
      data: {
        message: 'Exam deleted successfully',
      },
    });
  } catch (error: any) {
    console.error('Delete exam error:', error);
    // Check if it was the 'Exam not found' error we threw
    if (error.message === 'Exam not found') {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Exam not found or already deleted',
        },
      });
    }
    // Handle potential database errors during transaction
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error deleting exam and its related data',
      },
    });
  }
}) as unknown as RequestHandler);

// Get all users
router.get('/users', adminAuth, (async (req: AuthRequest, res: Response) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));

    res.json({ data: allUsers });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching users',
      },
    });
  }
}) as unknown as RequestHandler);


// Bulk Create Users
router.post('/users/bulk', adminAuth, (async (req: AuthRequest, res: Response) => {
  try {
    const usersData = req.body.users; // Expecting { users: [ { email, password, username }, ... ] }

    if (!Array.isArray(usersData) || usersData.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body must contain a non-empty "users" array.',
        },
      });
    }

    const usersToInsert: (typeof users.$inferInsert)[] = [];
    const errors: { email: string; reason: string }[] = [];
    const existingEmails = new Set<string>();
    const plainTextPasswords = new Map<string, string>(); // To store plain text passwords temporarily

    // Fetch existing emails to avoid duplicates efficiently
    const allExistingUsers = await db.select({ email: users.email }).from(users);
    allExistingUsers.forEach(u => existingEmails.add(u.email));

    for (const userData of usersData) {
      const { email, password, username } = userData;

      // Basic validation for each user
      if (!email || !password || !username) {
        errors.push({ email: email || 'N/A', reason: 'Missing email, password, or username' });
        continue;
      }

      // Check if email already exists in DB or in the current batch
      if (existingEmails.has(email)) {
        errors.push({ email: email, reason: 'Email already exists' });
        continue;
      }

      // Store plain text password before hashing
      plainTextPasswords.set(email, password);

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      usersToInsert.push({
        email,
        password: hashedPassword,
        username,
      });
      existingEmails.add(email); // Add to set to catch duplicates within the request itself
    }

    // Define the type for the returned user data (excluding password)
    type CreatedUser = Omit<typeof users.$inferSelect, 'password'>; 
    let createdUsers: CreatedUser[] = [];

    if (usersToInsert.length > 0) {
      createdUsers = await db.insert(users).values(usersToInsert).returning({
        id: users.id,
        email: users.email,
        username: users.username,
        createdAt: users.createdAt,
      });
    }

    // Send welcome emails for successfully created users
    for (const createdUser of createdUsers) {
      const plainPassword = plainTextPasswords.get(createdUser.email);
      if (plainPassword) {
        // Send email asynchronously - don't block the response for email sending
        sendWelcomeEmail({
          to: createdUser.email,
          username: createdUser.username,
          passwordPlainText: plainPassword,
        }).catch(emailError => {
          // Log email sending errors separately, but don't fail the API request
          console.error(`Failed to send welcome email to ${createdUser.email}:`, emailError);
        });
      } else {
         console.error(`Could not find plain text password for created user ${createdUser.email} to send welcome email.`);
      }
    }


    res.status(201).json({
      data: {
        message: `Bulk user creation processed. ${createdUsers.length} users created, ${errors.length} skipped.`,
        created: createdUsers,
        skipped: errors,
      },
    });

  } catch (error) {
    console.error('Bulk create users error:', error);
    // Handle potential database errors during insertion (e.g., unexpected constraint)
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error processing bulk user creation.',
      },
    });
  }
}) as unknown as RequestHandler);


export default router;
