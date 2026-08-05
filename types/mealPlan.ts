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
};

/** JS `Date#getDay()` order: Sunday = 0 */
export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function weekdaysStartingFrom(date: Date = new Date()): string[] {
  const start = date.getDay();
  return Array.from({ length: 7 }, (_, offset) => {
    return WEEKDAY_NAMES[(start + offset) % 7];
  });
}

export const PLANNER_QUESTIONS: PlannerQuestion[] = [
  {
    question: 'How would you describe your cooking skill level?',
    options: ['Beginner', 'Intermediate', 'Advanced'],
  },
  {
    question: 'How much time do you have for meal preparation?',
    options: ['15 minutes or less', '30 minutes', '1 hour or more'],
  },
  {
    question: 'Do you have any food allergies?',
    options: ['None', 'Dairy', 'Nuts', 'Gluten', 'Seafood'],
  },
  {
    question: 'What is your primary goal for meal planning?',
    options: ['Weight loss', 'Muscle building', 'Maintenance', 'Energy boost'],
  },
  {
    question: 'How many people are you cooking for?',
    options: ['Just me', '2 people', '3-4 people', '5+ people'],
  },
  {
    question: 'Do you prefer seasonal ingredients?',
    options: ['Yes, always', 'When possible', 'No preference'],
  },
  {
    question: 'How many meals would you like to prep in advance?',
    options: ['None', '1-2 meals', '3-5 meals', 'All meals'],
  },
  {
    question: 'What is your budget per meal?',
    options: ['Budget-friendly', 'Moderate', 'Premium ingredients'],
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
  },
  {
    question: 'Would you like to include snacks in your meal plan?',
    options: ['Yes', 'No'],
  },
];
