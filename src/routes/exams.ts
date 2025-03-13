import { Router, Response, RequestHandler } from 'express';
import { AuthRequest } from '../types/express.js';
import { db } from '../db/index.js';
import { exams, questions, questionOptions, examSessions, examAnswers } from '../db/schema.js';
import { eq, and, lt, gt, inArray } from 'drizzle-orm';
import { auth } from '../middleware/auth.js';
import type { InferSelectModel } from 'drizzle-orm';

type Question = InferSelectModel<typeof questions>;
type ExamSession = InferSelectModel<typeof examSessions>;

const router = Router();

// Get all available exams
router.get('/', auth, (async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const availableExams = await db.select().from(exams)
      .where(and(
        lt(exams.startTime, now),
        gt(exams.endTime, now)
      ));

    res.json({ data: availableExams });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching exams',
      },
    });
  }
}) as RequestHandler);

// Get all exam results for user (MOVED UP)
router.get('/results', auth, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new Error('User not found');
    const userId = req.user.id;

    const completedSessions = await db.select({
      examId: exams.id,
      examTitle: exams.title,
      sessionId: examSessions.id,
      completedAt: examSessions.endTime,
    })
    .from(examSessions)
    .where(
      and(
        eq(examSessions.userId, userId),
        eq(examSessions.completed, true)
      )
    )
    .leftJoin(exams, eq(examSessions.examId, exams.id));

    const results = await Promise.all(
      completedSessions.map(async (session) => {
        const [examQuestions, answers] = await Promise.all([
          db.select().from(questions)
            .where(eq(questions.examId, session.examId!)),
          db.select().from(examAnswers)
            .where(eq(examAnswers.sessionId, session.sessionId))
        ]);

        let correctAnswers = 0;
        examQuestions.forEach(question => {
          const answer = answers.find(a => a.questionId === question.id);
          if (answer && answer.selectedOptionId === question.correctOptionId) {
            correctAnswers++;
          }
        });

        return {
          examId: session.examId,
          examTitle: session.examTitle,
          score: (correctAnswers / examQuestions.length) * 100,
          totalQuestions: examQuestions.length,
          completedAt: session.completedAt,
        };
      })
    );

    res.json({ data: results });
  } catch (error) {
    console.error('Get all results error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching exam results',
      },
    });
  }
}) as RequestHandler);

// Get exam by ID
router.get('/:examId', auth, (async (req: AuthRequest, res: Response) => {
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
    const questionMap = new Map<string, Question & { options: { id: string; text: string; }[] }>();
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
    console.error('Get exam error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching exam details',
      },
    });
  }
}) as RequestHandler);

// Start exam session
router.post('/:examId/start', auth, (async (req: AuthRequest, res: Response) => {
  try {
    const { examId } = req.params;
    if (!req.user) throw new Error('User not found');
    const userId = req.user.id;

    // Check if exam exists and is available
    const exam = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    if (!exam[0]) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Exam not found',
        },
      });
    }

    const now = new Date();
    if (now < exam[0].startTime || now > exam[0].endTime) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TIME',
          message: 'Exam is not available at this time',
        },
      });
    }

    // Check if user has already completed this exam
    const completedSession = await db.select()
      .from(examSessions)
      .where(
        and(
          eq(examSessions.examId, examId),
          eq(examSessions.userId, userId),
          eq(examSessions.completed, true)
        )
      )
      .limit(1);
    
    if (completedSession[0]) {
      return res.status(400).json({
        error: {
          code: 'EXAM_ALREADY_TAKEN',
          message: 'You have already completed this exam',
        },
      });
    }

    // Check if user already has a session
    const existingSession = await db.select()
      .from(examSessions)
      .where(
        and(
          eq(examSessions.examId, examId),
          eq(examSessions.userId, userId),
          eq(examSessions.completed, false)
        )
      )
      .limit(1);

    if (existingSession[0]) {
      return res.status(400).json({
        error: {
          code: 'SESSION_EXISTS',
          message: 'Active exam session already exists',
        },
      });
    }

    // Create new session
    const [session] = await db.insert(examSessions)
      .values({
        examId,
        userId,
        startTime: now,
      })
      .returning();

    res.status(201).json({ data: session });
  } catch (error) {
    console.error('Start exam error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error starting exam session',
      },
    });
  }
}) as RequestHandler);

// Submit exam
router.post('/:examId/submit', auth, (async (req: AuthRequest, res: Response) => {
  try {
    const { examId } = req.params;
    const { answers } = req.body as { answers: Array<{ questionId: string; selectedOptionId: string }> };
    if (!req.user) throw new Error('User not found');
    const userId = req.user.id;

    // Get active session
    const session = await db.select()
      .from(examSessions)
      .where(
        and(
          eq(examSessions.examId, examId),
          eq(examSessions.userId, userId),
          eq(examSessions.completed, false)
        )
      )
      .limit(1);

    if (!session[0]) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'No active exam session found',
        },
      });
    }

    // Save answers
    const answersToInsert = answers.map(answer => ({
      sessionId: session[0].id,
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId,
    }));

    await db.insert(examAnswers).values(answersToInsert);

    // Complete session
    await db.update(examSessions)
      .set({
        completed: true,
        endTime: new Date(),
      })
      .where(eq(examSessions.id, session[0].id));

    res.json({
      data: { message: 'Exam submitted successfully' },
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error submitting exam',
      },
    });
  }
}) as RequestHandler);

// Get exam results
router.get('/:examId/results', auth, (async (req: AuthRequest, res: Response) => {
  try {
    const { examId } = req.params;
    if (!req.user) throw new Error('User not found');
    const userId = req.user.id;

    // Get completed session
    const session = await db.select()
      .from(examSessions)
      .where(
        and(
          eq(examSessions.examId, examId),
          eq(examSessions.userId, userId),
          eq(examSessions.completed, true)
        )
      )
      .limit(1);

    if (!session[0]) {
      return res.status(404).json({
        error: {
          code: 'RESULTS_NOT_FOUND',
          message: 'No completed exam session found',
        },
      });
    }

    // Get exam questions and user answers
    const [examQuestions, userAnswers] = await Promise.all([
      db.select().from(questions).where(eq(questions.examId, examId)),
      db.select().from(examAnswers).where(eq(examAnswers.sessionId, session[0].id))
    ]);

    // Calculate score
    let correctAnswers = 0;
    examQuestions.forEach(question => {
      const userAnswer = userAnswers.find(a => a.questionId === question.id);
      if (userAnswer && userAnswer.selectedOptionId === question.correctOptionId) {
        correctAnswers++;
      }
    });

    res.json({
      data: {
        score: (correctAnswers / examQuestions.length) * 100,
        totalQuestions: examQuestions.length,
        correctAnswers,
        incorrectAnswers: examQuestions.length - correctAnswers,
      },
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Error fetching exam results',
      },
    });
  }
}) as RequestHandler);

export default router;
