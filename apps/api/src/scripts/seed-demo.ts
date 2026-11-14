import { connectMongo, disconnectMongo } from '../db.js';
import { config } from '../config.js';
import { Crew, Delivery, Instruction, Organization, User, Variant, Worker, MagicLink } from '../models.js';
import { computeDisplayNames, LANGUAGES, type Language } from '@understood/shared';
import { encryptedSecret, randomToken, tokenHash } from '../auth/tokens.js';
import { normalizeWorkerName } from '../domain/names.js';

const CONTENT: Record<Language, { title: string; text: string; question: string; options: [string, string, string] }> = {
  en: {
    title: 'Roof safety check before work',
    text: 'Before starting today, check the roof edge for loose tiles and report any damage to your supervisor. Wear your harness whenever you are above ground level.',
    question: 'What should you do if you see loose tiles?',
    options: ['Report them to the supervisor', 'Ignore them', 'Throw them away'],
  },
  ar: {
    title: 'فحص سلامة السطح قبل العمل',
    text: 'قبل البدء اليوم، افحص حافة السطح بحثًا عن البلاطات المتراخية وأبلغ المشرف عن أي تلف. ارتدِ حزام الأمان كلما كنت فوق مستوى الأرض.',
    question: 'ماذا يجب أن تفعل إذا رأيت بلاطات متراخية؟',
    options: ['أبلغ المشرف عنها', 'تجاهلها', 'ارمِها بعيدًا'],
  },
  hi: {
    title: 'काम से पहले छत की सुरक्षा जाँच',
    text: 'आज काम शुरू करने से पहले छत के किनारे पर ढीली टाइलें जाँचें और किसी भी नुकसान की सूचना अपने सुपरवाइज़र को दें। ज़मीन से ऊपर होने पर हमेशा अपना हार्नेस पहनें।',
    question: 'ढीली टाइलें दिखने पर आपको क्या करना चाहिए?',
    options: ['सुपरवाइज़र को बताएं', 'अनदेखा करें', 'फेंक दें'],
  },
  ur: {
    title: 'کام سے پہلے چھت کی حفاظتی جانچ',
    text: 'آج کام شروع کرنے سے پہلے چھت کے کنارے پر ڈھیلی ٹائلیں چیک کریں اور کسی بھی نقصان کی اطلاع اپنے سپروائزر کو دیں۔ زمین سے اوپر ہونے پر ہمیشہ اپنا ہارنس پہنیں۔',
    question: 'ڈھیلی ٹائلیں نظر آنے پر آپ کو کیا کرنا چاہیے؟',
    options: ['سپروائز کو بتائیں', 'نظر انداز کریں', 'پھینک دیں'],
  },
  ml: {
    title: 'ജോലിക്ക് മുമ്പ് മേൽക്കൂര സുരക്ഷാ പരിശോധന',
    text: 'ഇന്ന് ജോലി തുടങ്ങുന്നതിന് മുമ്പ് മേൽക്കൂരയുടെ അരികിൽ അയഞ്ഞ ടൈലുകൾ പരിശോധിക്കുകയും കേടുപാടുകൾ സൂപ്പർവൈസറെ അറിയിക്കുകയും ചെയ്യുക. നിലത്തിന് മുകളിൽ ആകുമ്പോൾ എപ്പോഴും ഹാർനസ് ധരിക്കുക.',
    question: 'അയഞ്ഞ ടൈലുകൾ കണ്ടാൽ എന്ത് ചെയ്യണം?',
    options: ['സൂപ്പർവൈസറെ അറിയിക്കുക', 'അവഗണിക്കുക', 'എറിഞ്ഞുകളയുക'],
  },
  bn: {
    title: 'কাজের আগে ছাদের নিরাপত্তা পরীক্ষা',
    text: 'আজ কাজ শুরু করার আগে ছাদের প্রান্তে আলগা টাইলস পরীক্ষা করুন এবং কোনো ক্ষতির বিষয়ে আপনার সুপারভাইজারকে জানান। মাটির উপরে থাকলে সর্বদা আপনার হার্নেস পরুন।',
    question: 'আলগা টাইলস দেখলে আপনার কী করা উচিত?',
    options: ['সুপারভাইজারকে জানান', 'উপেক্ষা করুন', 'ফেলে দিন'],
  },
};

const DEMO_WORKERS: Array<{ name: string; language: Language }> = [
  { name: 'Ramesh Kumar', language: 'ml' },
  { name: 'Muhammad Ali', language: 'ur' },
  { name: 'Suresh Patel', language: 'hi' },
  { name: 'Abdul Rahman', language: 'ar' },
  { name: 'Rahim Uddin', language: 'bn' },
  { name: 'Ramesh Nair', language: 'ml' },
];

async function main(): Promise<void> {
  await connectMongo();

  const org = await Organization.findOneAndUpdate(
    { name: 'Demo Contracting' },
    { $setOnInsert: { name: 'Demo Contracting', timezone: 'Asia/Dubai', locale: 'en', plan: 'pilot' } },
    { upsert: true, new: true },
  );

  const user = await User.findOneAndUpdate(
    { email: 'owner@demo.understood.local' },
    { $setOnInsert: { orgId: org._id, email: 'owner@demo.understood.local', name: 'Demo Owner', role: 'owner' } },
    { upsert: true, new: true },
  );

  const crew = await Crew.findOneAndUpdate(
    { orgId: org._id, name: 'Morning Crew' },
    { $setOnInsert: { orgId: org._id, name: 'Morning Crew' } },
    { upsert: true, new: true },
  );

  const workers = [];
  for (const entry of DEMO_WORKERS) {
    const worker = await Worker.findOneAndUpdate(
      { orgId: org._id, normalizedName: normalizeWorkerName(entry.name), crewId: crew._id },
      {
        $setOnInsert: {
          orgId: org._id,
          crewId: crew._id,
          name: entry.name,
          normalizedName: normalizeWorkerName(entry.name),
          language: entry.language,
        },
      },
      { upsert: true, new: true },
    );
    workers.push(worker);
  }

  const shareToken = randomToken(32);
  const instruction = await Instruction.create({
    orgId: org._id,
    crewId: crew._id,
    audienceWorkerIds: workers.map((worker) => worker._id),
    title: CONTENT.en.title,
    type: 'task',
    content: { kind: 'text', text: CONTENT.en.text },
    sourceLanguage: 'en',
    status: 'shared',
    generation: 1,
    createdBy: user._id,
    sharedBy: user._id,
    sharedAt: new Date(),
    shareTokenHash: tokenHash(shareToken),
    shareTokenEnc: encryptedSecret(shareToken),
    shareTokenIssuedAt: new Date(),
    pipeline: { startedAt: new Date(), finishedAt: new Date(), lastError: null },
  });

  for (const language of LANGUAGES) {
    const content = CONTENT[language];
    const variant = await Variant.create({
      orgId: org._id,
      instructionId: instruction._id,
      language,
      title: content.title,
      text: content.text,
      audioStatus: 'skipped',
      question: { text: content.question, options: content.options, correctIndex: 0, source: 'manual' },
      questionStatus: 'ready',
      status: 'text_only',
      stages: { translate: 'done', question: 'done', audio: 'done' },
      revision: 1,
    });
    const audience = workers.filter((worker) => worker.language === language);
    await Delivery.insertMany(
      audience.map((worker) => ({
        orgId: org._id,
        instructionId: instruction._id,
        workerId: worker._id,
        variantId: variant._id,
        language,
        status: 'pending',
        attempts: [],
        deliveryTokens: [],
        help: { requested: false, reason: null, requestedAt: null, resolvedAt: null, resolvedBy: null },
        channel: 'link',
      })),
    );
  }

  const names = computeDisplayNames(workers.map((worker) => ({ id: String(worker._id), name: worker.name, language: worker.language })));
  const magicToken = randomToken(32);
  await MagicLink.create({
    email: user.email,
    tokenHash: tokenHash(magicToken),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  process.stdout.write(
    [
      'Demo data ready.',
      `Sign in: ${config.APP_URL}/api/v1/auth/verify?token=${magicToken}`,
      `Worker link: ${config.APP_URL}/i/${shareToken}`,
      `Working crew: ${crew.name} (${workers.length} workers)`,
      ...names.map((entry) => `  - ${entry.displayName}`),
      '',
    ].join('\n'),
  );

  await disconnectMongo();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
