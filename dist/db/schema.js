import { pgTable, text, timestamp, boolean, integer, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
// Users table
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').unique().notNull(),
    username: text('username').notNull(),
    password: text('password').notNull(), // Will be hashed
    createdAt: timestamp('created_at').defaultNow().notNull()
});
// Questions table
export const questions = pgTable('questions', {
    id: uuid('id').defaultRandom().primaryKey(),
    examId: uuid('exam_id').references(() => exams.id).notNull(),
    text: text('text').notNull(),
    correctOptionId: uuid('correct_option_id'),
    createdAt: timestamp('created_at').defaultNow().notNull()
});
// Question options table
export const questionOptions = pgTable('question_options', {
    id: uuid('id').defaultRandom().primaryKey(),
    questionId: uuid('question_id').references(() => questions.id).notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
});
// Add correct option reference after options table is defined
export const questionsRelations = relations(questions, ({ one }) => ({
    correctOption: one(questionOptions, {
        fields: [questions.correctOptionId],
        references: [questionOptions.id]
    })
}));
// Exams table
export const exams = pgTable('exams', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    duration: integer('duration').notNull(), // in minutes
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
});
// Exam sessions table
export const examSessions = pgTable('exam_sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    examId: uuid('exam_id').references(() => exams.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time'),
    completed: boolean('completed').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
});
// Exam answers table
export const examAnswers = pgTable('exam_answers', {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id').references(() => examSessions.id).notNull(),
    questionId: uuid('question_id').references(() => questions.id).notNull(),
    selectedOptionId: uuid('selected_option_id').references(() => questionOptions.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
});
// Define relationships
export const examToQuestions = relations(exams, ({ many }) => ({
    questions: many(questions)
}));
export const questionToExam = relations(questions, ({ one }) => ({
    exam: one(exams, {
        fields: [questions.examId],
        references: [exams.id],
    })
}));
export const questionToOptions = relations(questions, ({ many }) => ({
    options: many(questionOptions)
}));
export const optionToQuestion = relations(questionOptions, ({ one }) => ({
    question: one(questions, {
        fields: [questionOptions.questionId],
        references: [questions.id],
    })
}));
export const examSessionToExam = relations(examSessions, ({ one }) => ({
    exam: one(exams, {
        fields: [examSessions.examId],
        references: [exams.id],
    })
}));
export const examSessionToUser = relations(examSessions, ({ one }) => ({
    user: one(users, {
        fields: [examSessions.userId],
        references: [users.id],
    })
}));
export const examAnswerRelations = relations(examAnswers, ({ one }) => ({
    session: one(examSessions, {
        fields: [examAnswers.sessionId],
        references: [examSessions.id],
    }),
    question: one(questions, {
        fields: [examAnswers.questionId],
        references: [questions.id],
    }),
    selectedOption: one(questionOptions, {
        fields: [examAnswers.selectedOptionId],
        references: [questionOptions.id],
    })
}));
