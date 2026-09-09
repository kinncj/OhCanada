/**
 * The content adapter: the bundled `content/` tree behind the application's
 * content ports. Wired in `app/bootstrap`, nowhere else (ADR-0005).
 */

export {
  bundledQuestionBank,
  createQuestionBank,
  type QuestionBankOptions,
} from './bundled-question-bank';
export {
  BUNDLED_QUESTION_MODULES,
  fetchSubjectModules,
  indexQuestionModules,
  questionAddress,
  type QuestionAddress,
  type QuestionEntry,
  type QuestionModuleMap,
  type SubjectEntry,
} from './question-catalog';
export { parseQuestionDocument } from './question-document';
