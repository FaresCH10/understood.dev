import { LANGUAGE_META, LANGUAGES, type Language } from '@understood/shared';

export interface WorkerStrings {
  selectName: string;
  search: string;
  notHere: string;
  notHereBody: string;
  continueAs: string;
  yesMe: string;
  notMe: string;
  listen: string;
  listenAgain: string;
  quickCheck: string;
  done: string;
  gotIt: string;
  completedTitle: string;
  completedSub: string;
  correct: string;
  wrong1: string;
  wrong2: string;
  helpCta: string;
  helpTitle: string;
  helpSub: string;
  reasons: { dontUnderstand: string; tools: string; safety: string; other: string };
  cancel: string;
  send: string;
  helpSent: string;
  helpSentSub: string;
  close: string;
  closedTitle: string;
  closedSub: string;
  preview: string;
  offline: string;
  retry: string;
  langTitle: string;
  langNote: string;
  save: string;
  disclaimer: string;
  questionHint: string;
  tapPlay: string;
  answered: string;
  yourLanguage: string;
  pause: string;
  backToNames: string;
  helpRequested: string;
  noMatch: string;
}

export const STRINGS: Partial<Record<Language, WorkerStrings>> = {
  en: {
    selectName: 'Select your name',
    search: 'Search your name',
    notHere: "My name isn't here",
    notHereBody: 'Ask your supervisor to add you to this instruction.',
    continueAs: 'Continue as',
    yesMe: "Yes, that's me",
    notMe: "This isn't me",
    listen: 'Listen',
    listenAgain: 'Listen again',
    quickCheck: 'Quick check',
    done: 'Done',
    gotIt: 'Got it',
    completedTitle: 'You completed this instruction',
    completedSub: 'Today',
    correct: "Correct — you're ready.",
    wrong1: 'Not quite. Listen again, then try once more.',
    wrong2: 'The correct answer is highlighted. Your supervisor will be notified to help you.',
    helpCta: 'I need help',
    helpTitle: 'I need help',
    helpSub: 'Choose what you need. Your supervisor will be notified.',
    reasons: {
      dontUnderstand: "I don't understand",
      tools: 'Missing tools or materials',
      safety: 'Safety concern',
      other: 'Other',
    },
    cancel: 'Cancel',
    send: 'Send',
    helpSent: 'Your supervisor has been notified.',
    helpSentSub: 'Help is on the way.',
    close: 'Close',
    closedTitle: 'This instruction is closed.',
    closedSub: 'Ask your supervisor for a new link.',
    preview: 'Preview — responses are not recorded',
    offline: "You're offline. Your answer will send when you're back online.",
    retry: 'Retry',
    langTitle: 'Change language',
    langNote: 'This changes your language for future instructions too.',
    save: 'Save',
    disclaimer: "This instruction supports — and does not replace — your company's training and safety procedures.",
    questionHint: 'Choose one answer',
    tapPlay: 'Tap to listen',
    answered: 'Answer recorded',
    yourLanguage: 'Your language',
    pause: 'Pause',
    backToNames: 'Choose another name',
    helpRequested: 'Help requested',
    noMatch: 'No name matches',
  },
  ar: {
    selectName: 'اختر اسمك',
    search: 'ابحث عن اسمك',
    notHere: 'اسمي ليس هنا',
    notHereBody: 'اطلب من المشرف إضافتك إلى هذه التعليمات.',
    continueAs: 'المتابعة باسم',
    yesMe: 'نعم، هذا أنا',
    notMe: 'لست أنا',
    listen: 'استمع',
    listenAgain: 'استمع مرة أخرى',
    quickCheck: 'فحص سريع',
    done: 'تم',
    gotIt: 'فهمت',
    completedTitle: 'لقد أكملت هذه التعليمات',
    completedSub: 'اليوم',
    correct: 'أحسنت — أنت جاهز.',
    wrong1: 'ليس تمامًا. استمع مرة أخرى ثم حاول مرة ثانية.',
    wrong2: 'الإجابة الصحيحة موضّحة بالأخضر. سيتواصل معك المشرف لمساعدتك.',
    helpCta: 'أحتاج إلى مساعدة',
    helpTitle: 'أحتاج إلى مساعدة',
    helpSub: 'اختر ما تحتاجه. سيتم إشعار المشرف.',
    reasons: { dontUnderstand: 'لا أفهم', tools: 'أدوات أو مواد ناقصة', safety: 'مشكلة سلامة', other: 'أخرى' },
    cancel: 'إلغاء',
    send: 'إرسال',
    helpSent: 'تم إشعار المشرف.',
    helpSentSub: 'سيتم مساعدتك قريبًا.',
    close: 'إغلاق',
    closedTitle: 'هذه التعليمات مغلقة.',
    closedSub: 'اطلب من المشرف رابطًا جديدًا.',
    preview: 'معاينة — لن يتم تسجيل الردود',
    offline: 'أنت غير متصل. سيتم إرسال إجابتك عند عودة الاتصال.',
    retry: 'إعادة المحاولة',
    langTitle: 'تغيير اللغة',
    langNote: 'سيتم تغيير لغتك للتعليمات القادمة أيضًا.',
    save: 'حفظ',
    disclaimer: 'هذه التعليمات تدعم إجراءات التدريب والسلامة في شركتك ولا تحل محلها.',
    questionHint: 'اختر إجابة واحدة',
    tapPlay: 'اضغط للاستماع',
    answered: 'تم تسجيل الإجابة',
    yourLanguage: 'لغتك',
    pause: 'إيقاف مؤقت',
    backToNames: 'اختيار اسم آخر',
    helpRequested: 'تم طلب المساعدة',
    noMatch: 'لا يوجد اسم مطابق',
  },
  hi: {
    selectName: 'अपना नाम चुनें',
    search: 'अपना नाम खोजें',
    notHere: 'मेरा नाम यहाँ नहीं है',
    notHereBody: 'इस सूचना में आपको जोड़ने के लिए अपने सुपरवाइज़र से कहें।',
    continueAs: 'इस रूप में जारी रखें',
    yesMe: 'हाँ, यह मैं हूँ',
    notMe: 'यह मैं नहीं हूँ',
    listen: 'सुनें',
    listenAgain: 'फिर से सुनें',
    quickCheck: 'छोटी जाँच',
    done: 'हो गया',
    gotIt: 'समझ गया',
    completedTitle: 'आपने यह सूचना पूरी कर ली है',
    completedSub: 'आज',
    correct: 'सही — आप तैयार हैं।',
    wrong1: 'पूरी तरह सही नहीं। फिर से सुनें और एक बार और कोशिश करें।',
    wrong2: 'सही उत्तर हरे रंग में दिखाया गया है। मदद के लिए आपके सुपरवाइज़र को सूचित किया जाएगा।',
    helpCta: 'मुझे मदद चाहिए',
    helpTitle: 'मुझे मदद चाहिए',
    helpSub: 'चुनें कि आपको क्या चाहिए। सुपरवाइज़र को सूचित किया जाएगा।',
    reasons: { dontUnderstand: 'मैं समझ नहीं पाया', tools: 'औज़ार या सामान नहीं है', safety: 'सुरक्षा की चिंता', other: 'अन्य' },
    cancel: 'रद्द करें',
    send: 'भेजें',
    helpSent: 'आपके सुपरवाइज़र को सूचित किया गया है।',
    helpSentSub: 'मदद जल्द आएगी।',
    close: 'बंद करें',
    closedTitle: 'यह सूचना बंद है।',
    closedSub: 'नए लिंक के लिए अपने सुपरवाइज़र से कहें।',
    preview: 'पूर्वावलोकन — जवाब दर्ज नहीं होंगे',
    offline: 'आप ऑफ़लाइन हैं। कनेक्शन आने पर आपका जवाब भेजा जाएगा।',
    retry: 'फिर कोशिश करें',
    langTitle: 'भाषा बदलें',
    langNote: 'यह आगे की सूचनाओं के लिए भी आपकी भाषा बदल देगा।',
    save: 'सहेजें',
    disclaimer: 'यह सूचना आपकी कंपनी के प्रशिक्षण और सुरक्षा प्रक्रियाओं का समर्थन करती है — उनकी जगह नहीं लेती।',
    questionHint: 'एक उत्तर चुनें',
    tapPlay: 'सुनने के लिए दबाएँ',
    answered: 'उत्तर दर्ज हुआ',
    yourLanguage: 'आपकी भाषा',
    pause: 'रोकें',
    backToNames: 'दूसरा नाम चुनें',
    helpRequested: 'मदद का अनुरोध किया',
    noMatch: 'कोई नाम नहीं मिला',
  },
  ur: {
    selectName: 'اپنا نام منتخب کریں',
    search: 'اپنا نام تلاش کریں',
    notHere: 'میرا نام یہاں نہیں ہے',
    notHereBody: 'اس ہدایت میں آپ کو شامل کرنے کے لیے اپنے سپروائزر سے کہیں۔',
    continueAs: 'اس نام سے جاری رکھیں',
    yesMe: 'ہاں، یہ میں ہوں',
    notMe: 'یہ میں نہیں ہوں',
    listen: 'سنیں',
    listenAgain: 'دوبارہ سنیں',
    quickCheck: 'مختصر جانچ',
    done: 'ہو گیا',
    gotIt: 'سمجھ گیا',
    completedTitle: 'آپ نے یہ ہدایت مکمل کر لی ہے',
    completedSub: 'آج',
    correct: 'درست — آپ تیار ہیں۔',
    wrong1: 'بالکل درست نہیں۔ دوبارہ سنیں اور ایک بار پھر کوشش کریں۔',
    wrong2: 'درست جواب سبز رنگ میں دکھایا گیا ہے۔ مدد کے لیے آپ کے سپروائزر کو اطلاع دی جائے گی۔',
    helpCta: 'مجھے مدد چاہیے',
    helpTitle: 'مجھے مدد چاہیے',
    helpSub: 'منتخب کریں کہ آپ کو کیا چاہیے۔ سپروائزر کو اطلاع دی جائے گی۔',
    reasons: { dontUnderstand: 'میں سمجھ نہیں سکا', tools: 'اوزار یا سامان نہیں ہے', safety: 'حفاظت کا مسئلہ', other: 'دیگر' },
    cancel: 'منسوخ کریں',
    send: 'بھیجیں',
    helpSent: 'آپ کے سپروائزر کو اطلاع دے دی گئی ہے۔',
    helpSentSub: 'مدد جلد پہنچے گی۔',
    close: 'بند کریں',
    closedTitle: 'یہ ہدایت بند ہے۔',
    closedSub: 'نئے لنک کے لیے اپنے سپروائزر سے کہیں۔',
    preview: 'پیش منظر — جوابات درج نہیں ہوں گے',
    offline: 'آپ آف لائن ہیں۔ رابطہ آنے پر آپ کا جواب بھیجا جائے گا۔',
    retry: 'دوبارہ کوشش کریں',
    langTitle: 'زبان تبدیل کریں',
    langNote: 'یہ آگے کی ہدایات کے لیے بھی آپ کی زبان تبدیل کر دے گا۔',
    save: 'محفوظ کریں',
    disclaimer: 'یہ ہدایت آپ کی کمپنی کے تربیتی اور حفاظتی طریقوں کی تائید کرتی ہے — ان کی متبادل نہیں۔',
    questionHint: 'ایک جواب منتخب کریں',
    tapPlay: 'سننے کے لیے دبائیں',
    answered: 'جواب درج ہو گیا',
    yourLanguage: 'آپ کی زبان',
    pause: 'روکیں',
    backToNames: 'دوسرا نام منتخب کریں',
    helpRequested: 'مدد کی درخواست کی',
    noMatch: 'کوئی نام نہیں ملا',
  },
  ml: {
    selectName: 'നിങ്ങളുടെ പേര് തിരഞ്ഞെടുക്കുക',
    search: 'പേര് തിരയുക',
    notHere: 'എന്റെ പേര് ഇവിടെയില്ല',
    notHereBody: 'ഈ നിർദ്ദേശത്തിൽ നിങ്ങളെ ചേർക്കാൻ സൂപ്പർവൈസറിനോട് ആവശ്യപ്പെടുക.',
    continueAs: 'ഇതിൽ തുടരുക',
    yesMe: 'അതെ, ഇത് ഞാനാണ്',
    notMe: 'ഇത് ഞാനല്ല',
    listen: 'കേൾക്കുക',
    listenAgain: 'വീണ്ടും കേൾക്കുക',
    quickCheck: 'ചെറിയ പരിശോധന',
    done: 'കഴിഞ്ഞു',
    gotIt: 'മനസ്സിലായി',
    completedTitle: 'നിങ്ങൾ ഈ നിർദ്ദേശം പൂർത്തിയാക്കി',
    completedSub: 'ഇന്ന്',
    correct: 'ശരി — നിങ്ങൾ തയ്യാറാണ്.',
    wrong1: 'കൃത്യമല്ല. വീണ്ടും കേട്ടതിന് ശേഷം ഒരിക്കൽ കൂടി ശ്രമിക്കുക.',
    wrong2: 'ശരിയായ ഉത്തരം പച്ചയിൽ കാണിച്ചിരിക്കുന്നു. സഹായത്തിനായി സൂപ്പർവൈസറെ അറിയിക്കും.',
    helpCta: 'എനിക്ക് സഹായം വേണം',
    helpTitle: 'എനിക്ക് സഹായം വേണം',
    helpSub: 'നിങ്ങൾക്ക് എന്ത് വേണമെന്ന് തിരഞ്ഞെടുക്കുക. സൂപ്പർവൈസറെ അറിയിക്കും.',
    reasons: { dontUnderstand: 'എനിക്ക് മനസ്സിലാകുന്നില്ല', tools: 'ഉപകരണങ്ങളോ വസ്തുക്കളോ ഇല്ല', safety: 'സുരക്ഷാ പ്രശ്നം', other: 'മറ്റുള്ളവ' },
    cancel: 'റദ്ദാക്കുക',
    send: 'അയയ്ക്കുക',
    helpSent: 'സൂപ്പർവൈസറെ അറിയിച്ചിട്ടുണ്ട്.',
    helpSentSub: 'സഹായം ഉടൻ എത്തും.',
    close: 'അടയ്ക്കുക',
    closedTitle: 'ഈ നിർദ്ദേശം അടച്ചിരിക്കുന്നു.',
    closedSub: 'പുതിയ ലിങ്കിനായി സൂപ്പർവൈസറിനോട് ആവശ്യപ്പെടുക.',
    preview: 'പ്രിവ്യൂ — പ്രതികരണങ്ങൾ രേഖപ്പെടുത്തില്ല',
    offline: 'നിങ്ങൾ ഓഫ്‌ലൈനാണ്. കണക്ഷൻ തിരികെ വരുമ്പോൾ ഉത്തരം അയയ്ക്കും.',
    retry: 'വീണ്ടും ശ്രമിക്കുക',
    langTitle: 'ഭാഷ മാറ്റുക',
    langNote: 'ഇത് ഭാവി നിർദ്ദേശങ്ങൾക്കും നിങ്ങളുടെ ഭാഷ മാറ്റും.',
    save: 'സേവ് ചെയ്യുക',
    disclaimer: 'ഈ നിർദ്ദേശം നിങ്ങളുടെ കമ്പനിയുടെ പരിശീലന, സുരക്ഷാ നടപടികളെ പിന്തുണയ്ക്കുന്നു — അവയ്ക്ക് പകരമല്ല.',
    questionHint: 'ഒരു ഉത്തരം തിരഞ്ഞെടുക്കുക',
    tapPlay: 'കേൾക്കാൻ തൊടുക',
    answered: 'ഉത്തരം രേഖപ്പെടുത്തി',
    yourLanguage: 'നിങ്ങളുടെ ഭാഷ',
    pause: 'താൽക്കാലികമായി നിർത്തുക',
    backToNames: 'മറ്റൊരു പേര് തിരഞ്ഞെടുക്കുക',
    helpRequested: 'സഹായം അഭ്യർത്ഥിച്ചു',
    noMatch: 'പേര് കണ്ടെത്തിയില്ല',
  },
  bn: {
    selectName: 'আপনার নাম বেছে নিন',
    search: 'আপনার নাম খুঁজুন',
    notHere: 'আমার নাম এখানে নেই',
    notHereBody: 'এই নির্দেশে আপনাকে যুক্ত করতে আপনার সুপারভাইজারকে বলুন।',
    continueAs: 'এই নামে চালিয়ে যান',
    yesMe: 'হ্যাঁ, এটাই আমি',
    notMe: 'এটা আমি নই',
    listen: 'শুনুন',
    listenAgain: 'আবার শুনুন',
    quickCheck: 'ছোট যাচাই',
    done: 'হয়ে গেছে',
    gotIt: 'বুঝেছি',
    completedTitle: 'আপনি এই নির্দেশটি সম্পন্ন করেছেন',
    completedSub: 'আজ',
    correct: 'সঠিক — আপনি প্রস্তুত।',
    wrong1: 'পুরোপুরি সঠিক নয়। আবার শুনে আরেকবার চেষ্টা করুন।',
    wrong2: 'সঠিক উত্তর সবুজে দেখানো হয়েছে। সাহায্যের জন্য আপনার সুপারভাইজারকে জানানো হবে।',
    helpCta: 'আমার সাহায্য দরকার',
    helpTitle: 'আমার সাহায্য দরকার',
    helpSub: 'আপনার কী দরকার তা বেছে নিন। সুপারভাইজারকে জানানো হবে।',
    reasons: { dontUnderstand: 'আমি বুঝতে পারিনি', tools: 'যন্ত্রপাতি বা উপকরণ নেই', safety: 'নিরাপত্তার বিষয়', other: 'অন্য কিছু' },
    cancel: 'বাতিল',
    send: 'পাঠান',
    helpSent: 'আপনার সুপারভাইজারকে জানানো হয়েছে।',
    helpSentSub: 'সাহায্য শিগগিরই আসছে।',
    close: 'বন্ধ করুন',
    closedTitle: 'এই নির্দেশটি বন্ধ।',
    closedSub: 'নতুন লিংকের জন্য আপনার সুপারভাইজারকে বলুন।',
    preview: 'প্রিভিউ — উত্তর রেকর্ড করা হবে না',
    offline: 'আপনি অফলাইনে আছেন। সংযোগ ফিরলে আপনার উত্তর পাঠানো হবে।',
    retry: 'আবার চেষ্টা করুন',
    langTitle: 'ভাষা পরিবর্তন করুন',
    langNote: 'এটি ভবিষ্যতের নির্দেশের জন্যও আপনার ভাষা পরিবর্তন করবে।',
    save: 'সংরক্ষণ করুন',
    disclaimer: 'এই নির্দেশটি আপনার কোম্পানির প্রশিক্ষণ ও নিরাপত্তা পদ্ধতিকে সহায়তা করে — প্রতিস্থাপন করে না।',
    questionHint: 'একটি উত্তর বেছে নিন',
    tapPlay: 'শুনতে চাপ দিন',
    answered: 'উত্তর রেকর্ড হয়েছে',
    yourLanguage: 'আপনার ভাষা',
    pause: 'বিরতি',
    backToNames: 'অন্য নাম বেছে নিন',
    helpRequested: 'সহায়তা চাওয়া হয়েছে',
    noMatch: 'কোনো নাম মেলেনি',
  },
};

export const LANG_ORDER: Language[] = [...LANGUAGES];

export const LETTERS: Partial<Record<Language, [string, string, string]>> = {
  ar: ['أ', 'ب', 'ج'],
  en: ['A', 'B', 'C'],
  hi: ['अ', 'ब', 'स'],
  ur: ['ا', 'ب', 'ج'],
  ml: ['A', 'B', 'C'],
  bn: ['ক', 'খ', 'গ'],
};

export const FONT_CLASS: Partial<Record<Language, string>> = {
  ar: 'lang-ar',
  en: '',
  hi: 'lang-hi',
  ur: 'lang-ur',
  ml: 'lang-ml',
  bn: 'lang-bn',
};

export function metaOf(lang: Language) {
  return LANGUAGE_META[lang];
}

export function t(lang: Language): WorkerStrings {
  return STRINGS[lang] ?? STRINGS.en!;
}

export function isLanguage(value: string | null | undefined): value is Language {
  return !!value && (LANG_ORDER as string[]).includes(value);
}


