import { LessonDefinition } from '../types/studio';
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
