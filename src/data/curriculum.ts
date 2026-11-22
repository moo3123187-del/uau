import { LessonDefinition, LessonProgressRecord } from '../types/studio';
import { CURRICULUM_PART_1 } from './curriculumPart1';
import { CURRICULUM_PART_2 } from './curriculumPart2';

export const CURRICULUM_LESSONS: LessonDefinition[] = [
  ...CURRICULUM_PART_1,
  ...CURRICULUM_PART_2,
];

export interface CurriculumModuleSummary {
  moduleId: string;
  moduleNumber: number;
  moduleTitle: string;
  lessons: LessonDefinition[];
}

export function getCurriculumModules(): CurriculumModuleSummary[] {
  const map = new Map<string, CurriculumModuleSummary>();
  for (const lesson of CURRICULUM_LESSONS) {
    if (!map.has(lesson.moduleId)) {
      map.set(lesson.moduleId, {
        moduleId: lesson.moduleId,
        moduleNumber: lesson.moduleNumber,
        moduleTitle: lesson.moduleTitle,
        lessons: [],
      });
    }
    map.get(lesson.moduleId)!.lessons.push(lesson);
  }
  return Array.from(map.values()).sort((a, b) => a.moduleNumber - b.moduleNumber);
}

export function getFrontierLessonId(
  progressMap: Record<string, LessonProgressRecord>
): string {
  const firstIncomplete = CURRICULUM_LESSONS.find(
    (lesson) => !progressMap[lesson.id]?.completed
  );
  return firstIncomplete?.id ?? CURRICULUM_LESSONS[CURRICULUM_LESSONS.length - 1].id;
}

export function getUnlockedLessonIds(
  progressMap: Record<string, LessonProgressRecord>
): Set<string> {
  const unlocked = new Set<string>();
  const firstIncompleteIdx = CURRICULUM_LESSONS.findIndex(
    (lesson) => !progressMap[lesson.id]?.completed
  );
  const frontierIdx =
    firstIncompleteIdx === -1 ? CURRICULUM_LESSONS.length - 1 : firstIncompleteIdx;

  CURRICULUM_LESSONS.forEach((lesson, idx) => {
    if (idx <= frontierIdx || progressMap[lesson.id]?.completed) {
      unlocked.add(lesson.id);
    }
  });
  return unlocked;
}
