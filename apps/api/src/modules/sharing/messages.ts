import type { InstructionDoc } from '../../models.js';

export interface ShareMessages {
  whatsappMessage: { en: string; ar: string };
  reminderMessage: { en: string; ar: string };
}

export function shareMessages(input: {
  url: string;
  instruction: Pick<InstructionDoc, 'title' | 'type'>;
}): ShareMessages {
  const titleEn = input.instruction.title?.trim() || 'New instruction';
  const titleAr = input.instruction.title?.trim() || 'تعليمات جديدة';
  const typeEn = input.instruction.type === 'info' ? 'today’s update' : 'today’s instruction';
  const typeAr = input.instruction.type === 'info' ? 'تحديث اليوم' : 'تعليمات اليوم';

  const en = `Morning crew — ${typeEn}: ${titleEn}. Listen in your language and confirm when done: ${input.url}`;
  const ar = `فريق الصباح — ${typeAr}: ${titleAr}. يرجى الاستماع بلغتك والتأكيد عند الانتهاء: ${input.url}`;
  const reminderEn = `Reminder — ${titleEn}. Open the instruction in your language and confirm when done: ${input.url}`;
  const reminderAr = `تذكير — ${titleAr}. افتح التعليمات بلغتك وأكد عند الانتهاء: ${input.url}`;

  return {
    whatsappMessage: { en, ar },
    reminderMessage: { en: reminderEn, ar: reminderAr },
  };
}
