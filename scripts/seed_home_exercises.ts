import { prisma } from '../lib/prisma';

const HOME_EXERCISES = {
  'workout-push': [
    { name: 'Feet-Elevated Decline Push-Ups', order: 101 },
    { name: 'Pike Push-Ups (or Wall Handstand Press)', order: 102 },
    { name: 'Dumbbell / Water-Bottle Lateral Raises', order: 103 },
    { name: 'Diamond Push-Ups (or Chair Tricep Dips)', order: 104 },
    { name: 'Overhead Dumbbell / Backpack Tricep Extension', order: 105 },
    { name: 'Floor Isometric Squeeze Press / Floor Flyes', order: 106 },
  ],
  'workout-pull': [
    { name: 'Doorframe / Towel Inverted Rows', order: 101 },
    { name: 'Prone Cobra / Floor Y-T-W Raises', order: 102 },
    { name: 'Dumbbell / Backpack / Resistance Band Bicep Curls', order: 103 },
    { name: 'Hammer Curls (Dumbbell or Loaded Backpack)', order: 104 },
    { name: 'Bent-Over Rear Delt Flyes', order: 105 },
    { name: 'Superman Lat Pulls (Floor Lat Drive)', order: 106 },
  ],
  'workout-legs-core': [
    { name: 'Bulgarian Split Squats (Rear Foot on Chair)', order: 101 },
    { name: 'Bodyweight / Dumbbell Goblet Squats', order: 102 },
    { name: 'Single-Leg Glute Bridges / Romanian Deadlifts', order: 103 },
    { name: 'Bicycle Crunches & Deadbugs', order: 104 },
    { name: 'Lying Leg Raises / Reverse Crunches', order: 105 },
    { name: 'Plank to Shoulder Taps & Side Planks', order: 106 },
  ],
};

async function main() {
  console.log('Seeding HOME protocol exercises into database...');
  for (const [dayId, exercises] of Object.entries(HOME_EXERCISES)) {
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const exId = `${dayId}-home-${i + 1}`;
      await prisma.workoutExercise.upsert({
        where: { id: exId },
        update: { name: ex.name, order: ex.order, workoutDayId: dayId },
        create: { id: exId, name: ex.name, order: ex.order, workoutDayId: dayId },
      });
      console.log(`Upserted ${exId}: ${ex.name}`);
    }
  }
  console.log('✅ Home exercises successfully seeded!');
  await prisma.$disconnect();
}

main().catch(console.error);
