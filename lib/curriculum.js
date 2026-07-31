// Curriculum tree for Degree -> Program -> Course -> Subject suggestions.
// Not exhaustive; user can also type any subject/topic freely.

export const CURRICULUM = {
  'Class 9 (NCERT/CBSE)': {
    programs: {
      'CBSE': {
        courses: {
          'Standard': {
            subjects: ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit', 'Computer Applications'],
          },
        },
      },
      'ICSE': {
        courses: { 'Standard': { subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History & Civics', 'Geography', 'English'] } },
      },
    },
  },
  'Class 10 (NCERT/CBSE)': {
    programs: {
      'CBSE': { courses: { 'Standard': { subjects: ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Information Technology'] } } },
      'ICSE': { courses: { 'Standard': { subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History & Civics', 'Geography', 'English'] } } },
    },
  },
  'Class 11 (NCERT/CBSE)': {
    programs: {
      'Science (PCM)': { courses: { 'Standard': { subjects: ['Physics', 'Chemistry', 'Mathematics', 'English'] } } },
      'Science (PCB)': { courses: { 'Standard': { subjects: ['Physics', 'Chemistry', 'Biology', 'English'] } } },
      'Commerce': { courses: { 'Standard': { subjects: ['Accountancy', 'Business Studies', 'Economics', 'Mathematics', 'English'] } } },
      'Humanities': { courses: { 'Standard': { subjects: ['History', 'Political Science', 'Geography', 'Economics', 'English'] } } },
    },
  },
  'Class 12 (NCERT/CBSE)': {
    programs: {
      'Science (PCM)': { courses: { 'Standard': { subjects: ['Physics', 'Chemistry', 'Mathematics', 'English', 'Computer Science'] } } },
      'Science (PCB)': { courses: { 'Standard': { subjects: ['Physics', 'Chemistry', 'Biology', 'English'] } } },
      'Commerce': { courses: { 'Standard': { subjects: ['Accountancy', 'Business Studies', 'Economics', 'Mathematics', 'English'] } } },
      'Humanities': { courses: { 'Standard': { subjects: ['History', 'Political Science', 'Geography', 'Economics', 'Psychology', 'Sociology'] } } },
    },
  },
  'ICSE Board': {
    programs: {
      'Class 9': { courses: { 'Standard': { subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History & Civics', 'Geography', 'English'] } } },
      'Class 10': { courses: { 'Standard': { subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History & Civics', 'Geography', 'English'] } } },
    },
  },
  'B.Sc': {
    programs: {
      'Physics': { courses: { '1st Year': { subjects: ['Mechanics', 'Waves & Oscillations', 'Mathematical Physics', 'Electricity & Magnetism'] }, '2nd Year': { subjects: ['Thermodynamics', 'Optics', 'Quantum Mechanics I', 'Electronics'] }, '3rd Year': { subjects: ['Solid State Physics', 'Nuclear Physics', 'Statistical Mechanics'] } } },
      'Chemistry': { courses: { '1st Year': { subjects: ['Inorganic Chemistry', 'Organic Chemistry', 'Physical Chemistry'] }, '2nd Year': { subjects: ['Coordination Chemistry', 'Reaction Mechanism', 'Thermodynamics'] } } },
      'Mathematics': { courses: { '1st Year': { subjects: ['Calculus', 'Algebra', 'Analytical Geometry'] }, '2nd Year': { subjects: ['Real Analysis', 'Linear Algebra', 'ODE'] }, '3rd Year': { subjects: ['Complex Analysis', 'Abstract Algebra', 'Topology'] } } },
      'Computer Science': { courses: { '1st Year': { subjects: ['Programming in C', 'Discrete Math', 'Digital Logic'] }, '2nd Year': { subjects: ['Data Structures', 'DBMS', 'Operating Systems'] } } },
    },
  },
  'B.Tech': {
    programs: {
      'Computer Science': { courses: {
        '1st Year': { subjects: ['Engineering Mathematics I', 'Programming in C', 'Physics', 'Chemistry', 'English'] },
        '2nd Year': { subjects: ['Data Structures', 'Discrete Mathematics', 'DBMS', 'Digital Logic Design', 'Object Oriented Programming'] },
        '3rd Year': { subjects: ['Operating Systems', 'Computer Networks', 'Algorithms', 'Compiler Design', 'Machine Learning'] },
        '4th Year': { subjects: ['Cloud Computing', 'Cyber Security', 'Deep Learning', 'Distributed Systems'] },
      } },
      'Electronics': { courses: { '2nd Year': { subjects: ['Signals & Systems', 'Analog Electronics', 'Digital Electronics', 'Network Theory'] }, '3rd Year': { subjects: ['Communication Systems', 'Microprocessors', 'Control Systems', 'VLSI Design'] } } },
      'Mechanical': { courses: { '2nd Year': { subjects: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing Processes', 'Strength of Materials'] } } },
      'Civil': { courses: { '2nd Year': { subjects: ['Surveying', 'Structural Analysis', 'Fluid Mechanics', 'Concrete Technology'] } } },
    },
  },
  'MBA': {
    programs: {
      'General': { courses: {
        'Semester 1': { subjects: ['Financial Accounting', 'Managerial Economics', 'Marketing Management', 'Organizational Behavior', 'Statistics for Managers'] },
        'Semester 2': { subjects: ['Corporate Finance', 'Operations Management', 'Human Resource Management', 'Business Research'] },
      } },
      'Finance': { courses: { 'Semester 3': { subjects: ['Security Analysis', 'Financial Derivatives', 'International Finance', 'Risk Management'] } } },
      'Marketing': { courses: { 'Semester 3': { subjects: ['Consumer Behavior', 'Sales & Distribution', 'Brand Management', 'Digital Marketing'] } } },
    },
  },
  'BBA': {
    programs: {
      'General': { courses: { '1st Year': { subjects: ['Principles of Management', 'Business Economics', 'Financial Accounting', 'Business Communication'] } } },
    },
  },
  'B.Com': {
    programs: {
      'General': { courses: { '1st Year': { subjects: ['Financial Accounting', 'Business Economics', 'Business Law', 'Business Communication'] } } },
    },
  },
}

export const DEGREES = Object.keys(CURRICULUM)

export function getPrograms(degree) {
  return degree && CURRICULUM[degree] ? Object.keys(CURRICULUM[degree].programs) : []
}
export function getCourses(degree, program) {
  return degree && program && CURRICULUM[degree]?.programs?.[program] ? Object.keys(CURRICULUM[degree].programs[program].courses) : []
}
export function getSubjects(degree, program, course) {
  return degree && program && course && CURRICULUM[degree]?.programs?.[program]?.courses?.[course]
    ? CURRICULUM[degree].programs[program].courses[course].subjects
    : []
}
