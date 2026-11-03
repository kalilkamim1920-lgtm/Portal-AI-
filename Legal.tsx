/**
 * Legal pages (Terms of Service / Privacy Policy) — bilingual content.
 */
import { PublicLayout } from '../layouts/PublicLayout';
import { useLang } from '../i18n/LanguageContext';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-portal-text">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-7 text-portal-muted">{children}</div>
    </section>
  );
}

function TermsContent() {
  const { lang } = useLang();
  return lang === 'ar' ? (
    <>
      <Section title="1. قبول الشروط">
        <p>باستخدامك منصة PORTAL AI («المنصة»)، فإنك توافق على هذه الشروط. إذا لم توافق على أي جزء منها، يرجى التوقف عن استخدام المنصة.</p>
      </Section>
      <Section title="2. الحساب والمسؤولية">
        <p>أنت مسؤول عن الحفاظ على سرية بيانات حسابك وعن كل الأنشطة التي تتم من خلاله. يجب أن يكون عمرك 13 عامًا أو أكثر.</p>
      </Section>
      <Section title="3. الاستخدام المقبول">
        <p>يُحظر استخدام المنصة لأي غرض غير قانوني أو ضار، بما في ذلك توليد محتوى مسيء أو مضلل أو منتهك لحقوق الآخرين، أو محاولة تجاوز حدود الاستخدام أو اختراق أمن النظام.</p>
      </Section>
      <Section title="4. الاشتراكات والمدفوعات (تجريبية)">
        <p>نظام المدفوعات في هذا الإصدار تجريبي بالكامل (DEMO PAYMENT) ولا يتم خصم أي أموال حقيقية. الباقات وحدود الاستخدام اليومية توضحها صفحة الأسعار. قد تتغير الباقات بإشعار مسبق.</p>
      </Section>
      <Section title="5. حدود الخدمة">
        <p>تخضع الاستخدامات لحدود يومية حسب باقتك، وتُطبق حدود معدل الطلبات على الخادم. قد نعلق الحسابات المخالفة أو المتجاوزة للحدود المسموحة.</p>
      </Section>
      <Section title="6. إخلاء المسؤولية">
        <p>تُقدَّم خدمة الذكاء الاصطناعي «كما هي» دون ضمانات. قد تكون المخرجات غير دقيقة أحيانًا — تحقق من المعلومات المهمة قبل الاعتماد عليها.</p>
      </Section>
      <Section title="7. إنهاء الخدمة">
        <p>يمكنك حذف حسابك في أي وقت من الإعدادات. يمكننا تعليق أو إنهاء حسابات تنتهك هذه الشروط.</p>
      </Section>
    </>
  ) : (
    <>
      <Section title="1. Acceptance of terms">
        <p>By using PORTAL AI (the "Platform") you agree to these terms. If you disagree with any part, please stop using the Platform.</p>
      </Section>
      <Section title="2. Account & responsibility">
        <p>You are responsible for keeping your account credentials confidential and for all activity under your account. You must be at least 13 years old.</p>
      </Section>
      <Section title="3. Acceptable use">
        <p>You may not use the Platform for any illegal or harmful purpose, including generating abusive, misleading or infringing content, circumventing usage limits, or attacking system security.</p>
      </Section>
      <Section title="4. Subscriptions & payments (demo)">
        <p>The payment system in this build is fully demo (DEMO PAYMENT) — no real money is charged. Plans and daily limits are described on the Pricing page and may change with notice.</p>
      </Section>
      <Section title="5. Service limits">
        <p>Usage is subject to daily quotas per plan and server-side rate limits. Violating accounts may be suspended.</p>
      </Section>
      <Section title="6. Disclaimer">
        <p>The AI service is provided "as is" without warranties. Outputs may be inaccurate — verify important information before relying on it.</p>
      </Section>
      <Section title="7. Termination">
        <p>You may delete your account anytime from Settings. We may suspend or terminate accounts that violate these terms.</p>
      </Section>
    </>
  );
}

function PrivacyContent() {
  const { lang } = useLang();
  return lang === 'ar' ? (
    <>
      <Section title="1. البيانات التي نجمعها">
        <p>نجمع بيانات الحساب (البريد الإلكتروني، الاسم المعروض، الصورة)، ومحتوى استخدامك (المحادثات، الطلبات)، وبيانات تشغيلية محدودة (سجل النشاط، عدادات الاستخدام) لتشغيل الخدمة وحمايتها.</p>
      </Section>
      <Section title="2. كلمات المرور والأمان">
        <p>لا نرى ولا نخزن كلمات المرور كنص عادي — تُدار بالكامل عبر Firebase Authentication. مفاتيح API والاتصال بالنماذج تبقى على الخادم فقط ولا تصل إلى المتصفح.</p>
      </Section>
      <Section title="3. كيف نستخدم البيانات">
        <p>لتوفير الميزات، فرض حصص الاستخدام، منع الإساءة، تحسين الخدمة، وإرسال الإشعارات التي تختار استلامها.</p>
      </Section>
      <Section title="4. المشاركة مع أطراف ثالثة">
        <p>نشارك الحد الأدنى اللازم مع مزودي الخدمة (مثل Google/Firebase للمصادقة وقاعدة البيانات، ومزود نموذج الذكاء الاصطناعي لمعالجة طلباتك). لا نبيع بياناتك لأي طرف.</p>
      </Section>
      <Section title="5. حقوقك">
        <p>يمكنك الوصول إلى بياناتك وتعديلها من الصفحة الشخصية والإعدادات، وحذف حسابك نهائيًا في أي وقت من الإعدادات.</p>
      </Section>
      <Section title="6. ملفات تعريف الجلسة">
        <p>نستخدم تخزين الجلسة المحلي (IndexedDB) للحفاظ على تسجيل دخولك، وتخزينًا محليًا بسيطًا لتفضيلات مثل اللغة — لا نستخدم ملفات تعريف تتبع إعلاني.</p>
      </Section>
    </>
  ) : (
    <>
      <Section title="1. Data we collect">
        <p>We collect account data (email, display name, photo), usage content (conversations, requests), and limited operational data (activity logs, usage counters) to run and protect the service.</p>
      </Section>
      <Section title="2. Passwords & security">
        <p>We never see or store passwords in plaintext — they are fully managed by Firebase Authentication. API keys and model connections stay server-side only and never reach the browser.</p>
      </Section>
      <Section title="3. How we use data">
        <p>To provide features, enforce usage quotas, prevent abuse, improve the service, and send notifications you opt into.</p>
      </Section>
      <Section title="4. Third parties">
        <p>We share the minimum necessary with service providers (Google/Firebase for auth & database, and the AI model provider to process your requests). We never sell your data.</p>
      </Section>
      <Section title="5. Your rights">
        <p>You can access and edit your data from Profile & Settings, and permanently delete your account anytime from Settings.</p>
      </Section>
      <Section title="6. Session storage">
        <p>We use local session storage (IndexedDB) to keep you signed in and simple local storage for preferences like language — no advertising trackers.</p>
      </Section>
    </>
  );
}

export default function Terms({ variant }: { variant: 'terms' | 'privacy' }) {
  const { t, lang } = useLang();
  const isTerms = variant === 'terms';

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold gradient-text">
          {isTerms ? t.legal.termsTitle : t.legal.privacyTitle}
        </h1>
        <p className="mt-2 text-xs text-portal-muted">
          {t.legal.lastUpdated}: 2026-01-01 · {lang === 'ar' ? 'الإصدار التجريبي' : 'Demo build'}
        </p>

        <div className="glass-card mt-8 p-6 sm:p-8">
          {isTerms ? <TermsContent /> : <PrivacyContent />}
        </div>
      </div>
    </PublicLayout>
  );
}
