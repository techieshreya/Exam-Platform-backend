import { Router } from 'express';
import { db } from '../db/index.js';
import { exams, questions, questionOptions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
const router = Router();
export const sampleQuiz = {
    title: "Sample Programming Quiz",
    description: "A basic quiz about programming concepts",
    duration: 30, // 30 minutes
    questions: [
        {
            text: "What is TypeScript?",
            options: [
                { text: "A JavaScript framework", correct: false },
                { text: "A superset of JavaScript with static typing", correct: true },
                { text: "A new programming language", correct: false },
                { text: "A JavaScript runtime", correct: false },
            ],
        },
        {
            text: "What does REST stand for?",
            options: [
                { text: "React Express Server Time", correct: false },
                { text: "Representational State Transfer", correct: true },
                { text: "Remote Endpoint Service Transfer", correct: false },
                { text: "Regular Expression State Test", correct: false },
            ],
        },
        {
            text: "Which of these is NOT a JavaScript data type?",
            options: [
                { text: "undefined", correct: false },
                { text: "boolean", correct: false },
                { text: "string", correct: false },
                { text: "integer", correct: true },
            ],
        },
    ],
};
router.post('/create-sample-exam', async (req, res) => {
    try {
        // Create an exam
        const [exam] = await db.insert(exams).values({
            title: sampleQuiz.title,
            description: sampleQuiz.description,
            duration: sampleQuiz.duration,
            startTime: new Date(), // Starts now
            endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Ends in 7 days
        }).returning();
        // Create questions and their options
        for (const questionData of sampleQuiz.questions) {
            // Create question first
            const [question] = await db.insert(questions).values({
                examId: exam.id,
                text: questionData.text,
            }).returning();
            // Create options for the question
            const createdOptions = await Promise.all(questionData.options.map(async (option) => {
                const [createdOption] = await db.insert(questionOptions).values({
                    questionId: question.id,
                    text: option.text,
                }).returning();
                return createdOption;
            }));
            // Update question with correct option
            const correctOption = createdOptions[questionData.options.findIndex(opt => opt.correct)];
            await db.update(questions)
                .set({ correctOptionId: correctOption.id })
                .where(eq(questions.id, question.id));
        }
        res.status(201).json({
            data: {
                message: 'Sample exam created successfully',
                exam: {
                    id: exam.id,
                    title: exam.title,
                    description: exam.description,
                    duration: exam.duration,
                },
            },
        });
    }
    catch (error) {
        console.error('Error creating sample exam:', error);
        res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'Error creating sample exam',
            },
        });
    }
});
export default router;
