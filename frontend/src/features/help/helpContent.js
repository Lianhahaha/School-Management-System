/**
 * The Help page's answers per role: "How do I …?" questions, each answered in two to five short steps that
 * name the menu items, tabs and buttons exactly as the screen shows them. Every label here is copied from the
 * pages (navConfig, the page and modal components, the `can` permissions of utils/roles), so a renamed
 * button must be renamed here too. A role sees only what it can do: the student assistant's list leaves out
 * the administrator's actions and says so in one answer. Menu items that are not one of the phone's four
 * bottom tabs carry "(on a phone: More)" once per answer. `to` is the page the answer starts on.
 */

/** @typedef {{ id: string, topic: string, question: string, steps: string[], to?: string, toLabel?: string }} HelpEntry */

// ---------------------------------------------------------------------------
// Every role: the account menu, the bell and the theme switch in the top bar
// ---------------------------------------------------------------------------

const ACCOUNT = [
  {
    id: 'edit-profile',
    topic: 'Your account',
    question: 'How do I change my phone number or contact details?',
    steps: [
      'Press your initials at the top right and choose "Profile".',
      'Under "Contact details", change your "Phone" (students can also change their address and guardian).',
      'Press "Save changes".',
      'The details under "School record" can only be changed by the school office.',
    ],
    to: '/profile',
    toLabel: 'Open Profile',
  },
  {
    id: 'change-password',
    topic: 'Your account',
    question: 'How do I change my password?',
    steps: [
      'Press your initials at the top right and choose "Profile".',
      'Under "Security", press "Email me a reset link".',
      'Open the email and choose a new password.',
    ],
    to: '/profile',
    toLabel: 'Open Profile',
  },
  {
    id: 'privacy-request',
    topic: 'Your account',
    question: 'How do I see, correct or delete my data, or withdraw my consent?',
    steps: [
      'Open "Privacy Notice" in the menu to read what the school keeps and why.',
      'Press your initials at the top right, choose "Profile" and find "Privacy".',
      'Press "Email the Data Protection Officer" and say what you want; you can also ask the school office.',
      'The school answers within 30 working days.',
    ],
    to: '/profile',
    toLabel: 'Open Profile',
  },
  {
    id: 'forgot-password',
    topic: 'Your account',
    question: 'How do I sign in if I forgot my password?',
    steps: [
      'On the sign-in page, press "Forgot password?".',
      'Enter your "Email" and press "Send reset link".',
      'Open the email, choose a new password and sign in with it.',
    ],
  },
  {
    id: 'notifications',
    topic: 'Your account',
    question: 'How do I see my notifications?',
    steps: [
      'Press the bell at the top of the screen; the red number counts what is new.',
      'Press a notification to open what it is about.',
      'Press "Mark all read" to clear the count.',
    ],
  },
  {
    id: 'theme',
    topic: 'Your account',
    question: 'How do I switch between the dark and the light look?',
    steps: [
      'Press the sun or moon switch at the top of the screen.',
      'Press it again to switch back; this device remembers your choice.',
    ],
  },
  {
    id: 'install-app',
    topic: 'Your account',
    question: 'How do I add Skole to my phone or computer like an app?',
    steps: [
      'Press your initials at the top right.',
      'Choose "Install app" and confirm. It is there only when your browser can install Skole.',
    ],
  },
  {
    id: 'sign-out',
    topic: 'Your account',
    question: 'How do I sign out?',
    steps: [
      'Press your initials at the top right.',
      'Choose "Sign out". On a shared computer, always sign out when you are done.',
    ],
  },
];

// ---------------------------------------------------------------------------
// The school office: what the administrator and the student assistant both do
// ---------------------------------------------------------------------------

const SEARCH = {
  id: 'search',
  topic: 'Getting started',
  question: 'How do I find a student, teacher or class quickly?',
  steps: [
    'Press "Search" at the top of the screen, or press Ctrl K (⌘K on a Mac) on any page.',
    'Type at least two letters of a name, student number, class or subject.',
    'Press a result, or use the arrow keys and Enter, to open it.',
  ],
};

const CREATE_CLASS = {
  id: 'create-class',
  topic: 'Classes and subjects',
  question: 'How do I create a class?',
  steps: [
    'Open "Classes" and press "Create class".',
    'Enter the "Name" (for example Grade 10 - A), the "Grade level" and the "Academic year" (for example 2026-2027).',
    'Choose a "Homeroom teacher" if the class has one; you can add one later with "Edit".',
    'Press "Create class".',
  ],
  to: '/admin/classes',
  toLabel: 'Open Classes',
};

const ASSIGN_TEACHER = {
  id: 'assign-teacher',
  topic: 'Classes and subjects',
  question: 'How do I assign a teacher to a subject?',
  steps: [
    'Open "Classes" and choose the class.',
    'Open the "Subjects & Teachers" tab and press "Add subject".',
    'Choose the "Subject" and the "Teacher" who teaches it in this class. Both must be added to the school first.',
    'Press "Add subject". The teacher now finds it under "My classes" and can take attendance and grade it.',
  ],
  to: '/admin/classes',
  toLabel: 'Open Classes',
};

const CHANGE_TEACHER = {
  id: 'change-teacher',
  topic: 'Classes and subjects',
  question: 'How do I change who teaches a subject?',
  steps: [
    'Open "Classes", choose the class and open the "Subjects & Teachers" tab.',
    'Press the three dots (…) on the subject\'s row and choose "Change teacher".',
    'Choose the new "Teacher" and press "Change teacher". Attendance and grades recorded so far stay with the subject.',
    'If the new teacher already teaches at those times, the clashing periods are listed: move them on the "Schedule" tab or pick another teacher.',
  ],
  to: '/admin/classes',
  toLabel: 'Open Classes',
};

const ENROLL_STUDENT = {
  id: 'enroll-student',
  topic: 'People',
  question: 'How do I put a student in a class?',
  steps: [
    'Open "Students". A note says how many students have no class; press "Show them" to list them.',
    'Press "Enroll" on the student\'s row, choose the "Class" and press "Enroll".',
    'To put many students in one class at once, press "Enroll several", choose the "Class", tick the students and press the button that counts them, for example "Enroll 3 students".',
    'You can also open a class, go to its "Students" tab and press "Enroll students". Only classes of this school year or a later one take students.',
  ],
  to: '/admin/students',
  toLabel: 'Open Students',
};

const MOVE_STUDENT = {
  id: 'move-student',
  topic: 'People',
  question: 'How do I move a student to another class or take them out of one?',
  steps: [
    'To move a student, open "Students" and press "Transfer" on their row.',
    'Choose the new "Class" (of the same school year) and press "Transfer".',
    'To take a student out, open "Classes", choose their class, open its "Students" tab, press the three dots (…) on their row and choose "Withdraw".',
    'A withdrawn student has no class until you enroll them again; their past grades and attendance stay.',
  ],
  to: '/admin/students',
  toLabel: 'Open Students',
};

const STUDENT_DETAILS = {
  id: 'student-details',
  topic: 'People',
  question: "How do I see or change a student's details?",
  steps: [
    'Open "Students" and press the student\'s name.',
    'Open the "Profile" tab, change the details and press "Save changes".',
    'The "Enrollments", "Attendance" and "Grades" tabs show their history; "Print report card" is on the "Grades" tab.',
  ],
  to: '/admin/students',
  toLabel: 'Open Students',
};

const ADMISSIONS = {
  id: 'admissions',
  topic: 'People',
  question: 'How do I check the documents of a student who signed up?',
  steps: [
    'Open "Admissions" in the menu (on a phone: More). It lists the students who are "Waiting to pick a class".',
    'Tick "Birth certificate (PSA)" and "Report card (SF9)" as each document arrives; each tick is saved at once.',
    'Students pick their own class after signing up. To place one yourself, press "Admit", choose the "Class" and press "Enroll".',
    'Switch the status filter to "Admitted" to see the students already placed.',
  ],
  to: '/admin/admissions',
  toLabel: 'Open Admissions',
};

const ASSISTANT_REQUESTS = {
  id: 'assistant-requests',
  topic: 'People',
  question: 'How do I approve a student assistant?',
  steps: [
    'Open "Assistant requests" in the menu (on a phone: More); the number beside it counts the requests waiting.',
    'Press "Approve" on the person\'s row and confirm with "Approve". They get the office pages on their next visit.',
    'To say no, press "Decline", write the "Reason" they will read, and press "Decline".',
    'Email the person to tell them; the copy button next to their email helps.',
  ],
  to: '/admin/assistant-requests',
  toLabel: 'Open Assistant requests',
};

const BUILD_SCHEDULE = {
  id: 'build-schedule',
  topic: 'Schedule',
  question: 'How do I build the weekly schedule of a class?',
  steps: [
    'Open "Classes", choose the class and open the "Schedule" tab.',
    'The class needs its subjects and teachers first ("Subjects & Teachers" tab); until then "Add period" is greyed out.',
    'Press "Add period", choose the "Subject", "Day", "Start time" and "End time" (and a "Room" if you like), and press "Add period".',
    'If the class, the teacher or the room is already busy then, the clashing periods are listed; pick another time.',
    'Press a period on the schedule to change it, or to remove it with "Delete period".',
  ],
  to: '/admin/classes',
  toLabel: 'Open Classes',
};

const POST_ANNOUNCEMENT = {
  id: 'post-announcement',
  topic: 'Messages and calendar',
  question: 'How do I post an announcement?',
  steps: [
    'Open "Announcements" in the menu (on a phone: More) and press "New announcement".',
    'Write a "Title" and a "Message", and choose the "Audience": "Everyone", "Students" or "Teachers".',
    'Leave "Class" empty for the whole school, or choose one class.',
    'Leave "Publish at" empty to post it now, set "Expires at" if it should go away by itself, and press "Publish".',
    'To change or remove an announcement later, press the pencil or the bin button on it.',
  ],
  to: '/admin/announcements',
  toLabel: 'Open Announcements',
};

const NO_CLASS_DAY = {
  id: 'no-class-day',
  topic: 'Messages and calendar',
  question: 'How do I mark a holiday or a day with no classes?',
  steps: [
    'Open "Calendar" in the menu (on a phone: More) and press "Add entry" (on a bigger screen, the + on a day works too).',
    'Enter a "Title" and, under "Kind", choose "No classes" ("School event" leaves classes as usual).',
    'Choose the "First day" and, for several days, the "Last day".',
    'Press "Add entry". Nobody can mark attendance on a day with no classes.',
    'To change or remove an entry, press the pencil or the bin button next to it.',
  ],
  to: '/admin/calendar',
  toLabel: 'Open Calendar',
};

const ACTIVITY = {
  id: 'activity',
  topic: 'People',
  question: 'How do I see who changed something?',
  steps: [
    'Open "Activity" in the menu (on a phone: More). The newest changes come first.',
    'Search for a name or a title, or narrow the list by area and by dates.',
    'Press the arrow on an entry to see its details.',
  ],
  to: '/admin/activity',
  toLabel: 'Open Activity',
};

// ---------------------------------------------------------------------------
// The administrator only
// ---------------------------------------------------------------------------

const SET_UP_SCHOOL = {
  id: 'set-up-school',
  topic: 'Getting started',
  question: 'How do I set up a new school?',
  steps: [
    'Open "Dashboard" (on a phone: "Home") and find "Set up your school". It stays there until every step is done.',
    'Work through it in order: "Add teachers", "Add subjects", "Create this year\'s classes", "Assign teachers to subjects", "Enroll students", "Build the schedule".',
    'Press "Start" on the next step to open the page where it is done. Each step needs the ones before it.',
    'A step ticks itself off once it is done.',
  ],
  to: '/admin',
  toLabel: 'Open Dashboard',
};

const CREATE_ACCOUNT = {
  id: 'create-account',
  topic: 'People',
  question: 'How do I create an account for a teacher, a student or another administrator?',
  steps: [
    'Open "Users" in the menu (on a phone: More) and press "Create user".',
    'Fill in the name, the "Email" and a "Temporary password", and choose the "Role".',
    'For a teacher or a student, fill in the record that appears; leave the number empty and it is made for you.',
    'Press "Create user", then give the person their email and temporary password. They can change it with "Forgot password?".',
    '"Add teacher" on "Teachers" and "Add student" on "Students" do the same for one role.',
  ],
  to: '/admin/users',
  toLabel: 'Open Users',
};

const ADD_SUBJECT = {
  id: 'add-subject',
  topic: 'Classes and subjects',
  question: 'How do I add a subject?',
  steps: [
    'Open "Subjects" in the menu (on a phone: More) and press "Create subject".',
    'Enter a "Code" (for example BIO-7) and a "Name".',
    'Under "Grading", choose "K-12 components" and the subject\'s group, "On points", or "Weighted by type" (the weights must add up to 100%).',
    'Press "Create subject". Then add it to each class with its teacher, on the class\'s "Subjects & Teachers" tab.',
  ],
  to: '/admin/subjects',
  toLabel: 'Open Subjects',
};

const ADMIN_ATTENDANCE = {
  id: 'take-attendance',
  topic: 'Attendance',
  question: 'How do I take or check attendance?',
  steps: [
    'Open "Attendance".',
    'Choose the "Class", the "Subject" and the "Date" (today or earlier).',
    'Mark each student "Present", "Absent", "Late" or "Excused", or press "Mark all present". Students left unmarked are saved as Present.',
    'Press "Save attendance".',
    'To see how a whole class is doing, open "Classes", choose the class and open its "Attendance" tab.',
  ],
  to: '/admin/attendance',
  toLabel: 'Open Attendance',
};

const ADMIN_GRADES = {
  id: 'grades',
  topic: 'Grades',
  question: 'How do I see or enter grades?',
  steps: [
    'Open "Grades" in the menu (on a phone: More) and choose the "Class" and the "Subject".',
    'Press "Grade sheet" on an assessment to see every student\'s score, type scores and press "Save grades".',
    'To add an assessment, press "Create assessment"; usually the subject\'s teacher does this.',
    'A student\'s results and report card are on their page: open "Students", choose the student and open the "Grades" tab.',
  ],
  to: '/admin/grades',
  toLabel: 'Open Grades',
};

const END_OF_YEAR = {
  id: 'end-of-year',
  topic: 'End of year',
  question: 'How do I end the school year and move students up?',
  steps: [
    "Create next year's classes first if the students should move straight into one of them.",
    'Open "Classes", choose this year\'s class and open its "Students" tab.',
    'Press "End of school year" and untick any student who stays in the class.',
    'Choose the "Next class", or leave it on "Don\'t enroll them yet": students who passed, or must repeat the grade, then pick a section themselves on their dashboard.',
    'Press "Complete the year for …" (it says how many students). Grades and attendance stay on record.',
  ],
  to: '/admin/classes',
  toLabel: 'Open Classes',
};

const DEACTIVATE_ACCOUNT = {
  id: 'deactivate-account',
  topic: 'People',
  question: 'How do I turn off or delete an account?',
  steps: [
    'Open "Users" in the menu (on a phone: More) and find the person.',
    'Press "Deactivate" to stop them signing in, and "Reactivate" to let them back. Deactivating a student also takes them out of their class.',
    "A teacher who still teaches a subject this year can't be deactivated: give those subjects another teacher first.",
    'To delete an account made by mistake, press "Edit", then "Delete account". Only an account without school records can be deleted.',
  ],
  to: '/admin/users',
  toLabel: 'Open Users',
};

// ---------------------------------------------------------------------------
// The student assistant only
// ---------------------------------------------------------------------------

const ASSISTANT_LIMITS = {
  id: 'assistant-limits',
  topic: 'Getting started',
  question: "Why can't I see some pages or buttons?",
  steps: [
    "Some work is the administrator's, so those pages and buttons are hidden for a student assistant.",
    'You can\'t open "Users", edit a teacher\'s record, delete a class or remove a subject from a class.',
    "You can look at attendance and grade sheets, but only the subject's teacher or the administrator can save them.",
    "You can't end the school year, mark an enrollment completed, or deactivate or delete accounts.",
    'Ask the administrator when one of these needs doing.',
  ],
};

const ADD_STUDENT = {
  id: 'add-student',
  topic: 'People',
  question: 'How do I add a new student?',
  steps: [
    'Open "Students" and press "Add student" (the dashboard has the same button).',
    'Fill in the name, the "Email" and a "Temporary password", and the student record below.',
    'Leave "Student number" empty and it is made for you.',
    'Press "Add student", then give the student their email and temporary password. Next, put them in a class.',
  ],
  to: '/admin/students',
  toLabel: 'Open Students',
};

const ADD_TEACHER = {
  id: 'add-teacher',
  topic: 'People',
  question: 'How do I add a new teacher?',
  steps: [
    'Open "Teachers" in the menu (on a phone: More) and press "Add teacher".',
    'Fill in the name, the "Email" and a "Temporary password", and the teacher record below.',
    'Leave "Employee number" empty and it is made for you.',
    'Press "Add teacher", then give the teacher their email and temporary password. Next, assign them subjects in a class.',
  ],
  to: '/admin/teachers',
  toLabel: 'Open Teachers',
};

const ASSISTANT_ATTENDANCE = {
  id: 'check-attendance',
  topic: 'Attendance',
  question: 'How do I check attendance?',
  steps: [
    'Open "Attendance".',
    'Choose the "Class", the "Subject" and the "Date".',
    "The sheet shows who was present, absent, late or excused. You can view it; only the subject's teacher or the administrator saves it.",
    'To see how a whole class is doing, open "Classes", choose the class and open its "Attendance" tab.',
  ],
  to: '/admin/attendance',
  toLabel: 'Open Attendance',
};

const ASSISTANT_GRADES = {
  id: 'grades',
  topic: 'Grades',
  question: 'How do I look up grades?',
  steps: [
    'Open "Grades" in the menu (on a phone: More) and choose the "Class" and the "Subject".',
    'Press "Grade sheet" on an assessment to see every student\'s score. Only the teacher or the administrator can change them.',
    'A student\'s results and report card are on their page: open "Students", choose the student and open the "Grades" tab.',
  ],
  to: '/admin/grades',
  toLabel: 'Open Grades',
};

// ---------------------------------------------------------------------------
// Teachers and students: reading the school calendar
// ---------------------------------------------------------------------------

/** @param {string} to the role's calendar page */
const viewCalendar = (to) => ({
  id: 'view-calendar',
  topic: 'Messages and calendar',
  question: 'How do I see the school holidays and events?',
  steps: [
    'Open "Calendar" in the menu (on a phone: More).',
    'Use the arrows to move between months; "This month" brings you back.',
    'An entry marked "No classes" is a day without classes; a "School event" leaves classes as usual.',
  ],
  to,
  toLabel: 'Open Calendar',
});

// ---------------------------------------------------------------------------
// The answers per role, most common first
// ---------------------------------------------------------------------------

/** @type {Readonly<Record<'admin' | 'assistant' | 'teacher' | 'student', HelpEntry[]>>} */
export const HELP = Object.freeze({
  admin: [
    SET_UP_SCHOOL,
    SEARCH,
    ASSIGN_TEACHER,
    CHANGE_TEACHER,
    CREATE_ACCOUNT,
    ENROLL_STUDENT,
    MOVE_STUDENT,
    STUDENT_DETAILS,
    ASSISTANT_REQUESTS,
    ADMISSIONS,
    DEACTIVATE_ACCOUNT,
    ACTIVITY,
    ADD_SUBJECT,
    CREATE_CLASS,
    BUILD_SCHEDULE,
    ADMIN_ATTENDANCE,
    ADMIN_GRADES,
    POST_ANNOUNCEMENT,
    NO_CLASS_DAY,
    END_OF_YEAR,
    ...ACCOUNT,
  ],
  assistant: [
    SET_UP_SCHOOL,
    ASSISTANT_LIMITS,
    SEARCH,
    ADD_STUDENT,
    ADD_TEACHER,
    ENROLL_STUDENT,
    MOVE_STUDENT,
    STUDENT_DETAILS,
    ADMISSIONS,
    ASSISTANT_REQUESTS,
    ACTIVITY,
    ASSIGN_TEACHER,
    CHANGE_TEACHER,
    ADD_SUBJECT,
    CREATE_CLASS,
    BUILD_SCHEDULE,
    ASSISTANT_ATTENDANCE,
    ASSISTANT_GRADES,
    POST_ANNOUNCEMENT,
    NO_CLASS_DAY,
    ...ACCOUNT,
  ],
  teacher: [
    {
      id: 'my-classes',
      topic: 'Classes and subjects',
      question: 'How do I see the classes I teach?',
      steps: [
        'Open "My classes" (on a phone: "Classes").',
        'Under "Teaching", each subject you teach shows its class, its next period and the buttons "Students", "Attendance" and "Grades".',
        "If the page says you haven't been assigned to any class yet, ask the administrator to add you to a subject in a class.",
      ],
      to: '/teacher/classes',
      toLabel: 'Open My classes',
    },
    {
      id: 'take-attendance',
      topic: 'Attendance',
      question: 'How do I take attendance?',
      steps: [
        'Open "Attendance", or press "Mark attendance" on your dashboard when a period is due.',
        'Choose the "Class and subject" and the "Date" (today or earlier).',
        'Mark each student "Present", "Absent", "Late" or "Excused", or press "Mark all present"; add a remark if you like.',
        'Press "Save attendance". Students left unmarked are saved as Present.',
        "On a day with no classes, or a day the subject has no period, the sheet can't be marked.",
      ],
      to: '/teacher/attendance',
      toLabel: 'Open Attendance',
    },
    {
      id: 'reload-sheet',
      topic: 'Attendance',
      question: 'Why does the sheet ask me to reload it?',
      steps: [
        'Someone else, for example the administrator, saved the same attendance or grade sheet after you opened it.',
        'Press "Reload sheet" to see their marks. Changes you had not saved are dropped.',
        'Make your changes again and save.',
        'A note "Already marked by …" tells you who saved an attendance sheet last; saving again replaces their marks.',
      ],
      to: '/teacher/attendance',
      toLabel: 'Open Attendance',
    },
    {
      id: 'create-assessment',
      topic: 'Grades',
      question: 'How do I create a test, exam or assignment?',
      steps: [
        'Open "Grades" and choose the "Class and subject".',
        'Press "Create assessment".',
        'Enter the "Title", "Type", "Max score", "Semester", "Quarter" and "Date".',
        'Press "Create assessment". It appears in the list, ready for scores.',
      ],
      to: '/teacher/grades',
      toLabel: 'Open Grades',
    },
    {
      id: 'enter-scores',
      topic: 'Grades',
      question: 'How do I enter scores?',
      steps: [
        'Open "Grades", choose the "Class and subject" and press "Grade sheet" on the assessment.',
        "Type each student's score (Enter moves to the next one) and a remark if you like.",
        'Press "Save grades".',
        'A blank score counts as 0 once the assessment has scores, so fill in every student.',
        'To remove a saved score, press "Clear"; the message that follows lets you "Undo".',
      ],
      to: '/teacher/grades',
      toLabel: 'Open Grades',
    },
    {
      id: 'edit-assessment',
      topic: 'Grades',
      question: 'How do I change or delete an assessment?',
      steps: [
        'Open "Grades" and choose the "Class and subject".',
        'Press the pencil button on the assessment, change it and press "Save changes".',
        'The "Max score" can\'t go below a score already recorded.',
        'Press the bin button to delete it. Its recorded scores are deleted with it.',
      ],
      to: '/teacher/grades',
      toLabel: 'Open Grades',
    },
    {
      id: 'homeroom',
      topic: 'Classes and subjects',
      question: 'How do I see my homeroom class?',
      steps: [
        'Open "My classes" (on a phone: "Classes").',
        'Under "Homeroom", each class you look after lists its subjects and their teachers.',
        'Press "Students" next to a subject to see its students and attendance. You can look, but only the subject\'s teacher can change them.',
      ],
      to: '/teacher/classes',
      toLabel: 'Open My classes',
    },
    {
      id: 'schedule',
      topic: 'Schedule',
      question: 'How do I see my weekly schedule?',
      steps: [
        'Open "Schedule" in the menu (on a phone: More).',
        'Your periods for the week are shown, with today highlighted.',
        'Press "Print schedule" for a paper copy.',
        'The school office makes the schedule; tell them if a period is missing or wrong.',
      ],
      to: '/teacher/schedule',
      toLabel: 'Open Schedule',
    },
    {
      id: 'post-announcement',
      topic: 'Messages and calendar',
      question: 'How do I send an announcement to my class?',
      steps: [
        'Open "Announcements" in the menu (on a phone: More) and press "New announcement".',
        'Write a "Title" and a "Message", and choose the "Audience".',
        'Choose the "Class"; only people of that class in the audience see it.',
        'Press "Publish". To change or remove it later, press the pencil or the bin button on it; tick "Mine" to see only yours.',
      ],
      to: '/teacher/announcements',
      toLabel: 'Open Announcements',
    },
    viewCalendar('/teacher/calendar'),
    ...ACCOUNT,
  ],
  student: [
    {
      id: 'pick-class',
      topic: 'Getting started',
      question: 'How do I pick my class after signing up?',
      steps: [
        'Open "Dashboard" (on a phone: "Home").',
        'Under "Pick your Grade … class for …", choose a section. Each shows its homeroom teacher and how many seats are taken; a full one says "Full".',
        'Press "Enroll in …" and confirm. After that, only the school office can move you to another section.',
        'If no sections are open yet, check back soon.',
        'Bring your PSA birth certificate and last report card (SF9) to the school office.',
      ],
      to: '/student',
      toLabel: 'Open Dashboard',
    },
    {
      id: 'not-in-class',
      topic: 'Getting started',
      question: "Why don't I see my class or schedule?",
      steps: [
        'Your class and schedule appear only once you are in a class.',
        'Open "Dashboard" (on a phone: "Home"): if it shows sections, pick one there.',
        'If it says "You\'re not in a class right now", an administrator puts you in a class. Complete your profile meanwhile.',
        'If it takes long, tell the school office the email you sign in with.',
        'Grades and attendance from earlier classes stay on "Grades" and "Attendance".',
      ],
      to: '/student',
      toLabel: 'Open Dashboard',
    },
    {
      id: 'grades',
      topic: 'Grades',
      question: 'How do I see my grades?',
      steps: [
        'Open "Grades".',
        'At the top, choose the school year and "1st Semester", "2nd Semester" or "Whole year".',
        'The table shows each subject\'s quarter grades, its "Final" grade (the average of its quarters; for the whole year, of its two semesters) and your "General average". 75 is passing.',
        'Choose a subject in the list to see your score on each assessment.',
        'Press "Print report card" for a paper copy.',
      ],
      to: '/student/grades',
      toLabel: 'Open Grades',
    },
    {
      id: 'schedule',
      topic: 'Schedule',
      question: 'How do I see my class schedule?',
      steps: [
        'Open "Schedule".',
        "Your periods for the week are shown, with today highlighted. Today's periods are on your dashboard too.",
        'Press "Print schedule" for a paper copy.',
      ],
      to: '/student/schedule',
      toLabel: 'Open Schedule',
    },
    {
      id: 'attendance',
      topic: 'Attendance',
      question: 'How do I see my attendance?',
      steps: [
        'Open "Attendance".',
        'The top shows how often you were present this school year.',
        'Under "Records", narrow the list with "From", "To", a subject or a status.',
        'Choose another school year at the top to see an earlier year.',
      ],
      to: '/student/attendance',
      toLabel: 'Open Attendance',
    },
    {
      id: 'my-class',
      topic: 'Getting started',
      question: 'How do I see my class and my teachers?',
      steps: [
        'Open "My class" in the menu (on a phone: More).',
        'It shows your class, your homeroom teacher and how many classmates you have.',
        '"Subjects and teachers" lists each subject, who teaches it and its periods per week.',
      ],
      to: '/student/class',
      toLabel: 'Open My class',
    },
    {
      id: 'announcements',
      topic: 'Messages and calendar',
      question: 'How do I read announcements?',
      steps: [
        'Open "Announcements" in the menu (on a phone: More).',
        'New ones are marked "New"; press "Mark as read" on one, or "Mark all as read".',
        'Search with the box at the top, and press "Load more" for older ones.',
      ],
      to: '/student/announcements',
      toLabel: 'Open Announcements',
    },
    {
      id: 'next-year',
      topic: 'End of year',
      question: 'How do I enroll for the next school year?',
      steps: [
        'Once your class has finished the year, your dashboard shows whether you passed and your general average.',
        'If you passed, or will take the same grade again, choose a section and press "Enroll in …".',
        'If you need remedial classes first, the school office enrolls you once you pass them.',
      ],
      to: '/student',
      toLabel: 'Open Dashboard',
    },
    viewCalendar('/student/calendar'),
    ...ACCOUNT,
  ],
});
