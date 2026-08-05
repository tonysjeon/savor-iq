export type DayPlan = {
  name: string;
  breakfast: string;
  lunch: string;
  dinner: string;
};

export type MealPlan = {
  days: DayPlan[];
};

export type PlannerQuestion = {
  question: string;
  options: readonly string[];
  answer: string;
};

export const PLANNER_QUESTIONS: PlannerQuestion[] = [
  {
    question: 'How would you describe your cooking skill level?',
    options: ['Beginner', 'Intermediate', 'Advanced'],
    answer: 'Beginner',
  },
  {
    question: 'How much time do you have for meal preparation?',
    options: ['15 minutes or less', '30 minutes', '1 hour or more'],
    answer: '30 minutes',
  },
  {
    question: 'Do you have any food allergies?',
    options: ['None', 'Dairy', 'Nuts', 'Gluten', 'Seafood'],
    answer: 'None',
  },
  {
    question: 'What is your primary goal for meal planning?',
    options: ['Weight loss', 'Muscle building', 'Maintenance', 'Energy boost'],
    answer: 'Maintenance',
  },
  {
    question: 'How many people are you cooking for?',
    options: ['Just me', '2 people', '3-4 people', '5+ people'],
    answer: 'Just me',
  },
  {
    question: 'Do you prefer seasonal ingredients?',
    options: ['Yes, always', 'When possible', 'No preference'],
    answer: 'When possible',
  },
  {
    question: 'How many meals would you like to prep in advance?',
    options: ['None', '1-2 meals', '3-5 meals', 'All meals'],
    answer: '1-2 meals',
  },
  {
    question: 'What is your budget per meal?',
    options: ['Budget-friendly', 'Moderate', 'Premium ingredients'],
    answer: 'Moderate',
  },
  {
    question: 'Do you have any cultural cuisine preferences?',
    options: [
      'Asian',
      'Mediterranean',
      'American',
      'Indian',
      'Bangladeshi',
      'International Mix',
      'No preference',
    ],
    answer: 'No preference',
  },
  {
    question: 'Would you like to include snacks in your meal plan?',
    options: ['Yes', 'No'],
    answer: 'Yes',
  },
];
