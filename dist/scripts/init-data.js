import { sampleQuiz } from '../routes/admin.js';
import { db } from '../db/index.js';
import { exams, questions, questionOptions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import 'dotenv/config';
// This script provides a CLI way to create the sample exam
// You can also use the API endpoint: POST /api/admin/create-sample-exam
async function createSampleExam() {
    try {
        // Create an exam
        const [exam] = await db.insert(exams).values({
            title: sampleQuiz.title,
            description: sampleQuiz.description,
            duration: sampleQuiz.duration,
            startTime: new Date(),
            endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }).returning();
        console.log('Created exam:', exam);
        // Create questions and their options
        for (const questionData of sampleQuiz.questions) {
            const [question] = await db.insert(questions).values({
                examId: exam.id,
                text: questionData.text,
            }).returning();
            console.log('Created question:', question);
            const createdOptions = await Promise.all(questionData.options.map(async (option) => {
                const [createdOption] = await db.insert(questionOptions).values({
                    questionId: question.id,
                    text: option.text,
                }).returning();
                return createdOption;
            }));
            console.log('Created options:', createdOptions);
            const correctOption = createdOptions[questionData.options.findIndex((opt) => opt.correct)];
            await db.update(questions)
                .set({ correctOptionId: correctOption.id })
                .where(eq(questions.id, question.id));
            console.log('Updated question with correct option');
        }
        console.log('Sample exam created successfully!');
    }
    catch (error) {
        console.error('Error creating sample exam:', error);
    }
    finally {
        process.exit();
    }
}
// Run the initialization
createSampleExam();
