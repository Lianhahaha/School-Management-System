import { NPC_COMPLAINTS_URL, SCHOOL } from '../../../constants/privacy';
import { PRIVACY_NOTICE_VERSION } from '../../../constants/shared';
import { formatDate } from '../../../utils/date';
import { NoticeList, NoticeSection } from './NoticeParts';

/**
 * The full Privacy Notice: what the Data Privacy Act of 2012 (RA 10173, IRR Sec. 34) and NPC Circular
 * 2023-04 ask a notice to say: who is responsible, what is collected and why, the legal basis, who receives
 * it (abroad included), how long it is kept, the rights of the person and how to use them.
 */
export function FullNotice() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">Version of {formatDate(PRIVACY_NOTICE_VERSION)}.</p>

      <NoticeSection title="1. Who is responsible for your data">
        <p>
          {[SCHOOL.name, SCHOOL.address].filter(Boolean).join(', ')} decides how the personal data in this app
          is used. Under the Data Privacy Act of 2012 the school is the personal information controller.
        </p>
        <p>
          Data Protection Officer:{' '}
          {[SCHOOL.dpoName, SCHOOL.dpoEmail, SCHOOL.dpoPhone].filter(Boolean).join(', ')}.
        </p>
      </NoticeSection>

      <NoticeSection title="2. What we collect">
        <NoticeList
          items={[
            'Your account: name, email address and, if you give it, a phone number. Your password is kept by Google Firebase; the school never sees it.',
            'A student’s application: the grade applied for, the guardian’s name and phone and, if given, the previous school, LRN, date of birth, gender and address.',
            'School records: student number, class, enrollments, schedule, attendance, assessments and grades, and which admission documents the office has received (a checklist only; no copies are stored).',
            'For teachers: employee number and the subjects and classes they teach.',
            'Use of the app: notifications, which announcements you have read, a log of changes made in the app (who changed what, and when), and technical logs of requests to the server (IP address, address requested, time).',
          ]}
        />
        <p>
          Date of birth, LRN and school records such as grades and attendance are sensitive personal
          information under the law, and get the stricter protection the law requires.
        </p>
      </NoticeSection>

      <NoticeSection title="3. Why we use it">
        <NoticeList
          items={[
            'To handle applications and enrollment, and to place students in classes.',
            'To run classes: schedules, attendance, assessments, grades and report cards.',
            'To tell students, teachers and staff what concerns them: announcements and notifications.',
            'To keep the school records that the law and DepEd rules require.',
            'To keep accounts secure and to find and fix problems.',
          ]}
        />
        <p>
          The app works out from a student’s final grades whether they may enroll in the next grade
          themselves. When it cannot, the school office places the student, and anyone may ask the office to
          review a result. We do not use your data for advertising, and we do not sell it.
        </p>
      </NoticeSection>

      <NoticeSection title="4. Our legal basis">
        <NoticeList
          items={[
            'Personal information: it is needed for the enrollment contract between you and the school, and for the school’s duties under the law (Data Privacy Act, Sec. 12(b) and (c)).',
            'Sensitive personal information: your consent, given when you sign up and in the enrollment contract, and processing that existing laws and DepEd rules require (Sec. 13(a) and (b)).',
          ]}
        />
      </NoticeSection>

      <NoticeSection title="5. Who can see it">
        <NoticeList
          items={[
            'You can see your own account and records.',
            'Your teachers see your profile and your records in the classes they teach or lead.',
            'The school office sees the records it needs for its work: administrators, and student assistants that the office has approved.',
            'Other students see none of your details.',
            'Companies that run the app for the school, only on the school’s instructions: Google (Firebase sign-in and website hosting), Render (the application server, in Singapore) and Aiven (the database).',
            'DepEd and other government offices, when the law requires the school to report.',
          ]}
        />
      </NoticeSection>

      <NoticeSection title="6. Data kept outside the Philippines">
        <p>
          Google, Render and Aiven keep data on servers outside the Philippines. The school stays responsible
          for it there, and uses providers whose terms protect it as the Data Privacy Act requires.
        </p>
      </NoticeSection>

      <NoticeSection title="7. How long we keep it">
        <p>
          A student’s records are kept while they study at the school, and afterwards as long as DepEd rules
          require school records to be kept; the permanent record (SF10, Form 137) is kept permanently. An
          account that never led to an enrollment is deleted when you ask, or when the office no longer needs
          it. Technical logs are kept only for a short time.
        </p>
      </NoticeSection>

      <NoticeSection title="8. How we protect it">
        <p>
          Every connection is encrypted. Each person sees only what their role needs. Changes are logged with
          who made them, and the school keeps backups. No system is completely safe: keep your password to
          yourself and sign out on shared computers.
        </p>
      </NoticeSection>

      <NoticeSection title="9. Your rights">
        <NoticeList
          items={[
            'To be told how your data is used (this notice).',
            'To see your data and get a copy of it, also in a format another system can read.',
            'To have wrong or incomplete data corrected.',
            'To object, and to withdraw your consent at any time.',
            'To have data blocked or deleted when the school has no reason to keep it.',
            'To be paid damages if your data is misused.',
            'To file a complaint.',
          ]}
        />
        <p>
          A parent or guardian may use these rights for a student under 18. To use a right, write to the Data
          Protection Officer at {SCHOOL.dpoEmail} or ask the school office. We answer within 30 working days;
          if we need 15 more, we tell you why. It is free; only copies may cost a reasonable fee.
        </p>
        <p>
          If you withdraw your consent, we stop the use that depended on it. Records that the law requires us
          to keep stay, and without some of them the school may be unable to keep a student enrolled.
        </p>
      </NoticeSection>

      <NoticeSection title="10. Complaints">
        <p>
          Contact the Data Protection Officer first. You may also complain to the National Privacy Commission
          at{' '}
          <a
            href={NPC_COMPLAINTS_URL}
            className="font-medium text-gray-900 underline"
            target="_blank"
            rel="noreferrer"
          >
            privacy.gov.ph
          </a>
          .
        </p>
      </NoticeSection>

      <NoticeSection title="11. If something goes wrong">
        <p>
          If personal data is lost, stolen or seen by someone who should not see it, and harm is likely, we
          tell the National Privacy Commission and the people affected (and a student’s parents or guardians)
          within 72 hours of finding out.
        </p>
      </NoticeSection>

      <NoticeSection title="12. Changes to this notice">
        <p>
          The date at the top shows the current version. If we change what we collect, why, or who receives
          it, we tell you in the app and, where the law requires, ask for your consent again.
        </p>
      </NoticeSection>
    </div>
  );
}
