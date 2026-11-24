import { describe, expect, it } from 'vitest';
import type { StandardQuestion } from '../models/Question';
import {
    getShortAnswer,
    convertQuestionsToLastLetter,
} from './answerService';

const makeQuestion = (
    answerText: string,
    id = 1,
    shortAnswer = 'OLD'
): StandardQuestion => ({
    type: 'standard',
    questionInfo: {
        id,
        userView: 'letters',
        questionText: `Question ${id}`,
        pictureBaseString: '',
        info: ''
    },
    answer: { answerText, shortAnswer },
});

describe('getShortAnswer', () => {
    it.each([
        ['The Matrix', 'M'],
        ['A Series of Unfortunate Events', 'S'],
        ['The   Lion King', 'L'],
        ['A  Big Question', 'B'],
        ['The \t Example', 'E'],
        ['The ', ''],
        ['A ', ''],
        ['The \t ', ''],
    ])('skips a recognised leading article: %j -> %j', (input, expected) => {
        expect(getShortAnswer(input)).toBe(expected);
    });

    it.each([
        ['', ''],
        ['Hello', 'H'],
        ['hello', 'h'],
        ['the Matrix', 't'],
        ['THE Matrix', 'T'],
        ['a Series', 'a'],
        ['An Answer', 'A'],
        ['Aardvark', 'A'],
        ['Theatre', 'T'],
        ['The\tMatrix', 'T'],
        ['  Hello', ' '],
        ['\tHello', '\t'],
        ['7 wonders', '7'],
        ['?Who', '?'],
        ['Éclair', 'É'],
        ['The Éclair', 'É'],
    ])('preserves non-article behaviour: %j -> %j', (input, expected) => {
        expect(getShortAnswer(input)).toBe(expected);
    });

    it('does not mutate its input and returns a one-character string or empty string', () => {
        const value = 'A   Sample';
        expect(getShortAnswer(value)).toBe('S');
        expect(value).toBe('A   Sample');
        expect(getShortAnswer(value).length).toBeLessThanOrEqual(1);
    });

    it('preserves the existing case-sensitive, no-uppercase semantics', () => {
        expect(getShortAnswer('The lion')).toBe('l');
        expect(getShortAnswer('the lion')).toBe('t');
    });

    it('matches the original implementation for exhaustive short ASCII inputs', () => {
        const legacy = (text: string): string => {
            const skip = text.indexOf('The ') === 0 || text.indexOf('A ') === 0;
            return skip
                ? text.substring(text.indexOf(' ') + 1).trim().substring(0, 1)
                : text.substring(0, 1);
        };

        const alphabet = ['T', 'h', 'e', 'A', ' ', 'q', '!'];
        let values = [''];

        for (let length = 0; length <= 4; length++) {
            for (const value of values) {
                expect(getShortAnswer(value)).toBe(legacy(value));
            }
            values = values.flatMap(value =>
                alphabet.map(character => value + character)
            );
        }
    });
});

describe('convertQuestionsToLastLetter', () => {
    it.each([
        ['Matrix', 'X'],
        ['The Matrix', 'X'],
        ['example', 'E'],
        ['a', 'A'],
        ['Z', 'Z'],
        ['42', '2'],
        ['hello!', '!'],
        ['', ''],
        ['   ', ''],
        ['  Alpha', 'A'],
        ['Alpha   ', 'A'],
        ['  Alpha   ', 'A'],
        ['Final\n', 'L'],
        ['Été', 'É'],
    ])('converts the last character: %j -> %j', (input, expected) => {
        const [result] = convertQuestionsToLastLetter([makeQuestion(input)]);
        expect(result.answer.shortAnswer).toBe(expected);
        expect(result.answer.answerText).toBe(input);
    });

    it('returns an empty array for an empty array', () => {
        const input: StandardQuestion[] = [];
        const result = convertQuestionsToLastLetter(input);
        expect(result).toEqual([]);
        expect(result).not.toBe(input);
    });

    it('processes multiple questions in their original order', () => {
        const input = [
            makeQuestion('One', 11),
            makeQuestion('Two', 12),
            makeQuestion('Three', 13),
        ];
        const result = convertQuestionsToLastLetter(input);
        expect(result.map(q => q.questionInfo.id)).toEqual([11, 12, 13]);
        expect(result.map(q => q.answer.shortAnswer)).toEqual(['E', 'O', 'E']);
        expect(result).toHaveLength(input.length);
    });

    it('does not mutate the input array, question objects, or answer objects', () => {
        const first = makeQuestion('  Happy  ', 7, 'H');
        const input = [first];
        const result = convertQuestionsToLastLetter(input);

        expect(result).not.toBe(input);
        expect(result[0]).not.toBe(first);
        expect(result[0].answer).not.toBe(first.answer);
        expect(result[0].questionInfo).toBe(first.questionInfo);
        expect(result[0].answer.shortAnswer).toBe('Y');
        expect(first.answer.shortAnswer).toBe('H');
        expect(first.answer.answerText).toBe('  Happy  ');
    });

    it('preserves question information including picture and optional info', () => {
        const question = makeQuestion('Sun', 21);
        question.questionInfo.pictureBaseString = '/9j/4AAQSkZJRgABAQ...';
        question.questionInfo.info = 'A clue';
        const [result] = convertQuestionsToLastLetter([question]);

        expect(result.questionInfo).toEqual(question.questionInfo);
        expect(result.questionInfo.pictureBaseString).toBe('/9j/4AAQSkZJRgABAQ...');
        expect(result.questionInfo.info).toBe('A clue');
        expect(result.type).toBe('standard');
    });

    it('works consistently for a large question array', () => {
        const input = Array.from({ length: 1000 }, (_, index) =>
            makeQuestion(`Answer ${index}  `, index)
        );
        const output = convertQuestionsToLastLetter(input);

        expect(output).toHaveLength(1000);
        for (let index = 0; index < input.length; index++) {
            expect(output[index].questionInfo.id).toBe(index);
            expect(output[index].answer.shortAnswer).toBe(
                String(index).slice(-1)
            );
        }
    });
});
