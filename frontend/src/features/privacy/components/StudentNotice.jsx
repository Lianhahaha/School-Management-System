import { SCHOOL } from '../../../constants/privacy';
import { NoticeList, NoticeSection } from './NoticeParts';

/**
 * The notice in words a child can follow. NPC Advisory 2024-03 (child-oriented transparency) asks for one
 * next to the full notice, covering the processing, its purpose, the risks, why privacy settings matter,
 * the child's rights and how to use them.
 */
export function StudentNotice() {
  return (
    <div className="space-y-6">
      <NoticeSection title="Who looks after your information?">
        <p>
          Your school, {SCHOOL.name}. If you have a question, ask the school office or write to{' '}
          {SCHOOL.dpoEmail}.
        </p>
      </NoticeSection>

      <NoticeSection title="What we keep about you">
        <NoticeList
          items={[
            'Your name, email and the details you type when you sign up.',
            'Your class, schedule, attendance and grades.',
            'Your parent’s or guardian’s name and phone, so the school can reach them.',
          ]}
        />
      </NoticeSection>

      <NoticeSection title="Why we keep it">
        <NoticeList
          items={[
            'To put you in a class and run your lessons.',
            'To show you your grades, attendance and school news.',
            'Because the law says schools must keep student records.',
          ]}
        />
        <p>We never sell it or use it for ads.</p>
      </NoticeSection>

      <NoticeSection title="Who can see it">
        <NoticeList
          items={[
            'You.',
            'Your teachers and the school office.',
            'Not other students.',
            'The companies that run this app for the school (Google, Render and Aiven). Some of their computers are in other countries.',
            'DepEd, when the law says the school must tell them.',
          ]}
        />
      </NoticeSection>

      <NoticeSection title="Keeping it safe">
        <p>
          No app is 100% safe. Keep your password secret, never let anyone else use your account, and sign out
          on a computer other people use. That keeps your grades and details private.
        </p>
      </NoticeSection>

      <NoticeSection title="What you can ask for">
        <NoticeList
          items={[
            'To see what we keep about you.',
            'To fix something that is wrong.',
            'To stop or delete what we do not need.',
            'To complain if you think we did something wrong.',
          ]}
        />
        <p>
          Ask the school office, or ask your parent or guardian to help you. They can also ask for you. We
          answer within 30 working days.
        </p>
      </NoticeSection>

      <NoticeSection title="If we change this">
        <p>We will tell you in the app.</p>
      </NoticeSection>
    </div>
  );
}
